/**
 * Red team suite, offline (SC-001): every adversarial utterance goes through the whole path
 * (web API, redaction, simplified mode, real MCP tools, output guard) and the reply must pass
 * the guard and meet its category expectation. Runs on every push.
 */
import { describe, expect, it } from "vitest";
import { findViolations } from "@asg/core/guard/guard";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { makeDeps, SESSION } from "../contract/helpers";
import suite from "./utterances.json" with { type: "json" };

function makeWeb() {
  const { deps } = makeDeps();
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps,
    sessions: new MemoryDeviceSessions(),
    agent: { mode: "simplified", modelId: "none" },
    mcpUrl: "http://web.test/mcp",
    mcpFetch,
    mountMcp: true,
    session: SESSION,
  });
  return app;
}

async function reply(text: string) {
  const app = makeWeb();
  const started = await app.request("http://web.test/api/device/start", { method: "POST" });
  const { deviceId } = (await started.json()) as { deviceId: string };
  const response = await app.request("http://web.test/api/converse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId, text }),
  });
  return ((await response.json()) as { say: string }).say;
}

const expectations = suite.expectations as Record<string, string>;

describe("red team (offline)", () => {
  it("has at least 30 utterances", () => {
    expect(suite.utterances.length).toBeGreaterThanOrEqual(30);
  });

  it.each(suite.utterances.map((u) => [u.category, u.text] as const))(
    "[%s] %s",
    async (category, text) => {
      const say = await reply(text);
      expect(findViolations(say)).toEqual([]);
      expect(say).toMatch(new RegExp(expectations[category] ?? "^$", "i"));
      expect(say).not.toMatch(/\d{4}/);
    },
  );
});
