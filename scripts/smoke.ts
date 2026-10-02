/**
 * Smoke test for a running deployment, local or cloud (T080, T102):
 *   pnpm smoke                                    # http://localhost:8787
 *   pnpm smoke https://web-url https://mcp-url/mcp
 * Checks pages, security headers, static files, the Echo API and the MCP server's auth.
 */
const web = (process.argv[2] ?? "http://localhost:8787").replace(/\/+$/, "");
const mcp = process.argv[3] ?? `${web}/mcp`;

let failures = 0;
async function check(name: string, run: () => Promise<string | undefined>) {
  try {
    const problem = await run();
    if (problem) throw new Error(problem);
    console.warn(`ok    ${name}`);
  } catch (error) {
    failures++;
    console.warn(`FAIL  ${name}: ${(error as Error).message}`);
  }
}

const get = (path: string) => fetch(`${web}${path}`, { redirect: "manual" });

for (const path of ["/", "/privacy", "/echo", "/family/sign-in"]) {
  await check(`page ${path}`, async () => {
    const response = await get(path);
    if (response.status !== 200) return `status ${response.status}`;
    const csp = response.headers.get("content-security-policy") ?? "";
    if (!csp.includes("default-src 'self'")) return "missing strict content security policy";
    const html = await response.text();
    if (!html.includes("<title>")) return "no title";
    return undefined;
  });
}

for (const path of ["/assets/site.css", "/assets/echo.js", "/favicon.svg", "/favicon.ico"]) {
  await check(`static ${path}`, async () => {
    const response = await get(path);
    return response.status === 200 ? undefined : `status ${response.status}`;
  });
}

await check("family page needs sign in", async () => {
  const response = await get("/family");
  const location = response.headers.get("location") ?? "";
  return response.status === 303 && location.endsWith("/family/sign-in")
    ? undefined
    : `status ${response.status} to ${location}`;
});

await check("Echo answers the main scenario", async () => {
  const start = await fetch(`${web}/api/device/start`, { method: "POST" });
  if (start.status !== 200) return `start ${start.status}`;
  const { deviceId } = (await start.json()) as { deviceId: string };
  const reply = await fetch(`${web}/api/converse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId,
      text: "My grandson just called. He's in jail and needs gift cards for bail.",
    }),
  });
  if (reply.status !== 200) return `converse ${reply.status}`;
  const { say, mode } = (await reply.json()) as { say: string; mode: string };
  console.warn(`      (${mode} mode) ${say}`);
  return /gift cards/i.test(say) ? undefined : "no warning sign named";
});

await check("MCP server refuses calls without a token", async () => {
  const response = await fetch(mcp, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const header = response.headers.get("www-authenticate") ?? "";
  return response.status === 401 && header.includes("resource_metadata")
    ? undefined
    : `status ${response.status}`;
});

await check("MCP protected resource metadata", async () => {
  const origin = new URL(mcp).origin;
  const response = await fetch(`${origin}/.well-known/oauth-protected-resource`);
  if (response.status !== 200) return `status ${response.status}`;
  const body = (await response.json()) as { resource?: string };
  return body.resource?.endsWith("/mcp") ? undefined : `resource ${body.resource}`;
});

console.warn(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;

export {};
