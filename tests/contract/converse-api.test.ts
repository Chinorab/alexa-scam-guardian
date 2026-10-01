import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it } from "vitest";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import type { ConverseFn } from "../../apps/web/src/agent/bedrock-agent";
import { createWebApp } from "@asg/web";
import { makeDeps } from "./helpers";

function textReply(text: string): ConverseCommandOutput {
  return {
    output: { message: { role: "assistant", content: [{ text }] } },
    stopReason: "end_turn",
    $metadata: {},
  } as ConverseCommandOutput;
}

function makeWeb(agent: {
  mode: "full" | "simplified";
  converse?: ConverseFn;
  deadlineMs?: number;
}) {
  const { deps } = makeDeps();
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps,
    sessions: new MemoryDeviceSessions(),
    agent: { modelId: "test-model", ...agent },
    mcpUrl: "http://web.test/mcp",
    mcpFetch,
    mountMcp: true,
  });
  return app;
}

async function start(app: ReturnType<typeof createWebApp>) {
  const response = await app.request("http://web.test/api/device/start", { method: "POST" });
  return ((await response.json()) as { deviceId: string }).deviceId;
}

async function say(app: ReturnType<typeof createWebApp>, deviceId: string, text: string) {
  const response = await app.request("http://web.test/api/converse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId, text }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { say: string; mode: string };
}

describe("POST /api/converse", () => {
  it("runs a simplified turn through the real MCP server", async () => {
    const app = makeWeb({ mode: "simplified" });
    const deviceId = await start(app);
    const reply = await say(app, deviceId, "So can I pay him?");
    expect(reply.say).toBe(
      "Let's not send any money yet. First, call your family on a number you know.",
    );
    expect(reply.mode).toBe("simplified");
  });

  it("stops a dictated card number before anything else runs", async () => {
    let called = false;
    const app = makeWeb({
      mode: "full",
      converse: async () => {
        called = true;
        return textReply("ok");
      },
    });
    const deviceId = await start(app);
    const reply = await say(app, deviceId, "my card number is four one two two");
    expect(reply.say).toMatch(/^Let me stop you there\./);
    expect(called).toBe(false);
  });

  it("replaces an unsafe model answer with a safe line", async () => {
    const app = makeWeb({ mode: "full", converse: async () => textReply("It's safe to pay him.") });
    const deviceId = await start(app);
    const reply = await say(app, deviceId, "He sounded just like my grandson");
    expect(reply.say).toBe("Let's not send any money for now.");
    expect(reply.mode).toBe("full");
  });

  it("falls back to the simplified mode when the model is too slow", async () => {
    const slow: ConverseFn = (_input, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    const app = makeWeb({ mode: "full", converse: slow, deadlineMs: 50 });
    const deviceId = await start(app);
    const reply = await say(app, deviceId, "Can I send the money?");
    expect(reply.mode).toBe("simplified");
    expect(reply.say).toMatch(/^Let's not send any money yet/);
  });

  it("rejects unknown devices and bad bodies", async () => {
    const app = makeWeb({ mode: "simplified" });
    const unknown = await app.request("http://web.test/api/converse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: "nope", text: "hi" }),
    });
    expect(unknown.status).toBe(404);
    const bad = await app.request("http://web.test/api/converse", { method: "POST", body: "x" });
    expect(bad.status).toBe(400);
  });
});
