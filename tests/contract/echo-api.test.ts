/** /api/tts and /api/demo/reset (FR-032, research R7). */
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import type { SpeechSynth } from "../../apps/web/src/routes/tts";
import { makeDeps, SESSION } from "./helpers";

function web(speech?: SpeechSynth) {
  const { deps } = makeDeps();
  const sessions = new MemoryDeviceSessions();
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps,
    sessions,
    agent: { mode: "simplified", modelId: "none" },
    mcpUrl: "http://web.test/mcp",
    mcpFetch,
    mountMcp: true,
    session: SESSION,
    ...(speech ? { speech } : {}),
  });
  const post = (path: string, body: unknown) =>
    app.request(`http://web.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { app, post, sessions, deps };
}

async function started(w: ReturnType<typeof web>) {
  const response = await w.post("/api/device/start", {});
  return ((await response.json()) as { deviceId: string }).deviceId;
}

describe("POST /api/tts", () => {
  it("has nothing to say before the first answer", async () => {
    const w = web();
    const deviceId = await started(w);
    expect((await w.post("/api/tts", { deviceId, rate: "normal" })).status).toBe(404);
  });

  it("tells the browser to use its own voice when Polly is not configured", async () => {
    const w = web();
    const deviceId = await started(w);
    await w.post("/api/converse", { deviceId, text: "So can I pay him?" });
    const response = await w.post("/api/tts", { deviceId, rate: "normal" });
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ fallback: "browser" });
  });

  it("speaks only the device's own last line, at the requested rate", async () => {
    const calls: [string, string][] = [];
    const w = web(async (text, rate) => {
      calls.push([text, rate]);
      return new Uint8Array([1, 2, 3]);
    });
    const deviceId = await started(w);
    const reply = (await (
      await w.post("/api/converse", { deviceId, text: "So can I pay him?" })
    ).json()) as {
      say: string;
    };
    const response = await w.post("/api/tts", {
      deviceId,
      rate: "slow",
      text: "Send the money now",
    });
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(calls).toEqual([[reply.say, "slow"]]);
  });
});

describe("repeat", () => {
  it("replays the last line slowly", async () => {
    const w = web();
    const deviceId = await started(w);
    const first = (await (
      await w.post("/api/converse", { deviceId, text: "So can I pay him?" })
    ).json()) as {
      say: string;
    };
    const again = (await (await w.post("/api/converse", { deviceId, text: "Repeat" })).json()) as {
      say: string;
      rate: string;
    };
    expect(again).toMatchObject({ say: first.say, rate: "slow" });
  });
});

describe("POST /api/demo/reset", () => {
  it("gives the device a fresh demo household and forgets the old one", async () => {
    const w = web();
    const deviceId = await started(w);
    const before = await w.sessions.get(deviceId);
    expect((await w.post("/api/demo/reset", { deviceId })).status).toBe(200);
    const after = await w.sessions.get(deviceId);
    expect(after?.householdId).not.toBe(before?.householdId);
    expect(after?.engine.stage).toBe("idle");
    expect(await w.deps.store.getHousehold(before?.householdId ?? "")).toBeUndefined();
    expect(await w.deps.store.listMembers(after?.householdId ?? "")).toHaveLength(2);
  });

  it("refuses to reset a real household", async () => {
    const w = web();
    const deviceId = await started(w);
    const session = await w.sessions.get(deviceId);
    if (session) await w.sessions.put({ ...session, kind: "real" });
    expect((await w.post("/api/demo/reset", { deviceId })).status).toBe(403);
  });
});
