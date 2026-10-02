/**
 * Bundles the two Lambda functions with esbuild into infra/build, and copies the web app's
 * static files next to its handler. Run before `cdk synth` or `cdk deploy`.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(root, "infra/build");

// ESM bundles still meet CommonJS dependencies that call require().
const banner = {
  js: [
    "import { createRequire as __createRequire } from 'node:module';",
    "const require = __createRequire(import.meta.url);",
  ].join("\n"),
};

async function bundle(name: string, entry: string, tsconfig: string) {
  const dir = join(out, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  await build({
    entryPoints: [join(root, entry)],
    outfile: join(dir, "index.mjs"),
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    minify: true,
    sourcemap: true,
    tsconfig: join(root, tsconfig),
    banner,
    legalComments: "linked",
    logLevel: "warning",
  });
  // Lambda treats the folder as ESM only with this marker or the .mjs extension; keep both.
  writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
  const size = statSync(join(dir, "index.mjs")).size;
  console.warn(`${name}: ${(size / 1024 / 1024).toFixed(1)} MB`);
  return dir;
}

if (process.argv.includes("--container")) {
  // AgentCore Runtime image only (apps/mcp-server/Dockerfile).
  await bundle("container", "apps/mcp-server/src/container.ts", "apps/mcp-server/tsconfig.json");
  process.exit(0);
}

execSync("pnpm --filter @asg/web build:assets", { cwd: root, stdio: "inherit" });

await bundle("mcp", "apps/mcp-server/src/lambda.ts", "apps/mcp-server/tsconfig.json");
const web = await bundle("web", "apps/web/src/lambda.ts", "apps/web/tsconfig.json");

for (const folder of ["dist", "public"]) {
  const source = join(root, "apps/web", folder);
  if (!existsSync(source)) throw new Error(`Missing apps/web/${folder}; run the web build first`);
  cpSync(source, join(web, folder), { recursive: true });
}
