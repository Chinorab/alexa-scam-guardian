/**
 * The web app's public endpoints against malformed requests: never a server error, and the
 * private pages never open without a session.
 */
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { makeDeps, SESSION } from "./helpers";

const ORIGIN = "https://guardian.test";

function web() {
  const { deps } = makeDeps();
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps,
    sessions: new MemoryDeviceSessions(),
    agent: { mode: "simplified", modelId: "none" },
    mcpUrl: `${ORIGIN}/mcp`,
    mcpFetch,
    mountMcp: true,
    session: SESSION,
  });
  return app;
}

type Probe = [method: string, path: string, body?: string, type?: string];

const JSON_TYPE = "application/json";
const FORM_TYPE = "application/x-www-form-urlencoded";

const PROBES: Probe[] = [
  ["POST", "/api/converse", "not json", JSON_TYPE],
  ["POST", "/api/converse", "[]", JSON_TYPE],
  ["POST", "/api/converse", JSON.stringify({ deviceId: "x".repeat(500), text: "hi" }), JSON_TYPE],
  [
    "POST",
    "/api/converse",
    JSON.stringify({ deviceId: "nope", text: "y".repeat(10_000) }),
    JSON_TYPE,
  ],
  ["POST", "/api/interim", JSON.stringify({ deviceId: 1, partialText: null }), JSON_TYPE],
  ["POST", "/api/tts", JSON.stringify({ deviceId: "nope", rate: "fast" }), JSON_TYPE],
  ["POST", "/api/demo/reset", "{", JSON_TYPE],
  ["POST", "/api/device/start", JSON.stringify({ deviceId: { $gt: "" } }), JSON_TYPE],
  ["GET", "/api/device/%00/events"],
  ["GET", "/api/device/../../etc/passwd/demo-phone"],
  ["GET", "/r/not-a-token"],
  ["POST", "/r/not-a-token", "answer=it_was_me", FORM_TYPE],
  ["GET", "/stop/not.a.token"],
  ["POST", "/stop/x.y", "", FORM_TYPE],
  ["GET", "/family/sign-in/" + "z".repeat(300)],
  ["POST", "/family/sign-in/bogus", "", FORM_TYPE],
  ["POST", "/family/sign-in", "email=" + "a".repeat(5000) + "@x.com", FORM_TYPE],
  ["POST", "/family/demo", "deviceId=" + "q".repeat(2000), FORM_TYPE],
  ["GET", "/frame/nope/ui%3A%2F%2Fguardian%2Fwarning-signs"],
  ["GET", "/does-not-exist"],
];

describe("web endpoints with malformed requests", () => {
  it(`never answer with a server error across ${PROBES.length} probes`, async () => {
    const app = web();
    const errors: string[] = [];
    for (const [method, path, body, type] of PROBES) {
      const response = await app.request(`${ORIGIN}${path}`, {
        method,
        headers: { origin: ORIGIN, ...(type ? { "content-type": type } : {}) },
        ...(body !== undefined ? { body } : {}),
        redirect: "manual",
      });
      if (response.status >= 500)
        errors.push(`${method} ${path.slice(0, 50)} -> ${response.status}`);
    }
    expect(errors).toEqual([]);
  });

  it("keeps every private family page behind sign in", async () => {
    const app = web();
    for (const path of [
      "/family",
      "/family/members/new",
      "/family/activity",
      "/family/delete-all",
      "/family/members/mem_x",
    ]) {
      const response = await app.request(`${ORIGIN}${path}`, { redirect: "manual" });
      expect(response.status, path).toBe(303);
      expect(response.headers.get("location"), path).toBe("/family/sign-in");
    }
  });
});
