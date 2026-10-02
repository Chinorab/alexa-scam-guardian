/**
 * Exports packages/scam-patterns as the standalone open source repository (T105):
 *   pnpm export:dataset ../us-scam-patterns
 * The monorepo stays the source of truth; run this after every dataset change.
 */
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Usage: pnpm export:dataset <target folder>");
  process.exit(1);
}
const root = resolve(import.meta.dirname, "..");
const from = (path: string) => join(root, "packages/scam-patterns", path);
const to = (path: string) => join(resolve(target), path);

mkdirSync(to(".github/workflows"), { recursive: true });
for (const path of [
  "data",
  "schema",
  "src/check.ts",
  "src/types.ts",
  "src/index.ts",
  "scripts/check-sources.ts",
]) {
  cpSync(from(path), to(path), { recursive: true });
}
cpSync(from("export/README.md"), to("README.md"));
cpSync(from("export/package.json"), to("package.json"));
cpSync(from("export/check.yml"), to(".github/workflows/check.yml"));
cpSync(join(root, "LICENSE"), to("LICENSE"));
writeFileSync(
  to("tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2023",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        noEmit: true,
        types: ["node"],
      },
      include: ["src", "scripts"],
    },
    null,
    2,
  )}\n`,
);
writeFileSync(to(".gitignore"), "node_modules/\n");
writeFileSync(to(".gitattributes"), "* text=auto eol=lf\n");
console.warn(`Dataset exported to ${resolve(target)}`);
