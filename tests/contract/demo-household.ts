/**
 * The seeded demo household (Michael, grandson, text; Sarah, daughter, email) driven through
 * the web API in simplified mode against the real MCP server. Every reply must pass the guard.
 */
import { expect } from "vitest";
import { findViolations } from "@asg/core/guard/guard";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { makeDeps, SESSION } from "./helpers";

export function demo() {
  const { deps, advance } = makeDeps();
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
  let deviceId = "";
  const say = async (text: string) => {
    const response = await app.request("http://web.test/api/converse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId, text }),
    });
    const body = (await response.json()) as { say: string; cards: { uri: string }[] };
    expect(findViolations(body.say), body.say).toEqual([]);
    return body;
  };
  const phone = async () => {
    const response = await app.request(`http://web.test/api/device/${deviceId}/demo-phone`);
    return (
      (await response.json()) as {
        messages: { to: string; kind: string; body: string; replyPath?: string }[];
      }
    ).messages;
  };
  const tap = async (replyPath: string, answer: "it_was_me" | "it_wasnt_me") =>
    app.request(`http://web.test${replyPath}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `answer=${answer}`,
    });
  const events = async () =>
    (await (await app.request(`http://web.test/api/device/${deviceId}/events`)).json()) as {
      unread: number;
      light: string;
    };
  return {
    app,
    advance,
    say,
    phone,
    tap,
    events,
    async start() {
      const response = await app.request("http://web.test/api/device/start", { method: "POST" });
      deviceId = ((await response.json()) as { deviceId: string }).deviceId;
    },
  };
}
