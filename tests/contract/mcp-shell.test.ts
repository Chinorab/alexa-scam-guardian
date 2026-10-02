import { Client } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { openMcpSession } from "../../apps/web/src/agent/mcp-client";
import { HOUSEHOLD_ID, SECRET, makeApp, makeDeps, tokenFor } from "./helpers";

const ACCEPT = "application/json, text/event-stream";

async function rpc(app: ReturnType<typeof makeApp>, body: unknown, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", accept: ACCEPT };
  if (token) headers.authorization = `Bearer ${token}`;
  return app.request("http://mcp.test/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("MCP server shell", () => {
  it("rejects calls without a valid household token and points to the metadata", async () => {
    const app = makeApp(makeDeps().deps);
    const response = await rpc(app, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="http://mcp.test/.well-known/oauth-protected-resource"',
    );
    const bad = await rpc(app, { jsonrpc: "2.0", id: 1, method: "tools/list" }, "not-a-token");
    expect(bad.status).toBe(401);
  });

  it("publishes protected resource metadata", async () => {
    const app = makeApp(makeDeps().deps);
    const response = await app.request("http://mcp.test/.well-known/oauth-protected-resource");
    expect(await response.json()).toMatchObject({
      resource: "http://mcp.test/mcp",
      bearer_methods_supported: ["header"],
    });
  });

  it("answers a 2025-11-25 initialize", async () => {
    const app = makeApp(makeDeps().deps);
    const response = await rpc(
      app,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "contract-test", version: "1.0.0" },
        },
      },
      await tokenFor("hh_test"),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"protocolVersion":"2025-11-25"');
    expect(text).toContain('"name":"scam-guardian"');
  });

  it("serves the official MCP client end to end over Streamable HTTP", async () => {
    const app = makeApp(makeDeps().deps);
    const token = await tokenFor("hh_test");
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/client");
    const transport = new StreamableHTTPClientTransport(new URL("http://mcp.test/mcp"), {
      fetch: async (input, init) =>
        app.request(input instanceof URL ? input.href : input, init as RequestInit),
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(Array.isArray(tools)).toBe(true);
    await client.close();
  });
});

describe("tool latency in the logs (T080)", () => {
  it("every tool logs its name, outcome and time", async () => {
    const events: { event: string; tool?: string; ok?: boolean; durationMs?: number }[] = [];
    const { deps } = makeDeps({
      logger: { log: (event) => events.push(event as (typeof events)[number]) },
    } as Partial<ReturnType<typeof makeDeps>["deps"]>);
    const app = makeApp(deps);
    const session = await openMcpSession(
      { householdId: HOUSEHOLD_ID, kind: "demo" },
      {
        url: "http://mcp.test/mcp",
        tokenSecret: SECRET,
        fetch: (async (input: string | URL | Request, init?: RequestInit) =>
          app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch,
      },
    );
    await session.call("assess_call", { description: "The IRS called about gift cards." });
    await session.call("get_updates", {});
    await session.call("prepare_report", { checkId: "missing" });
    await session.close();
    const timed = events.filter((e) => e.event === "tool_call");
    expect(timed.map((e) => e.tool)).toEqual(["assess_call", "get_updates", "prepare_report"]);
    expect(timed.map((e) => e.ok)).toEqual([true, true, false]);
    for (const e of timed) expect(typeof e.durationMs).toBe("number");
  });
});
