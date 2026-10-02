/**
 * A relative asked about someone else (Sarah, after Michael did not answer) is asked whether
 * the story is true, not "Was it you?": in her email, on the reply page, on the demo phone,
 * in what Alexa says, and on the family page.
 */
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { SESSION, makeDeps } from "./helpers";

const ORIGIN = "https://guardian.test";
const OPENING =
  "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.";

function echo() {
  const made = makeDeps();
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps: made.deps,
    sessions: new MemoryDeviceSessions(),
    agent: { mode: "simplified", modelId: "none" },
    mcpUrl: `${ORIGIN}/mcp`,
    mcpFetch,
    mountMcp: true,
    session: SESSION,
  });
  let cookie = "";
  let deviceId = "";
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("origin", ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    const response = await app.request(`${ORIGIN}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0] ?? "";
    return response;
  };
  const post = (path: string, body: unknown) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const form = (path: string, fields: Record<string, string>) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  return {
    advance: made.advance,
    request,
    form,
    async start() {
      deviceId = ((await (await post("/api/device/start", {})).json()) as { deviceId: string })
        .deviceId;
    },
    async say(text: string) {
      return ((await (await post("/api/converse", { deviceId, text })).json()) as { say: string })
        .say;
    },
    async phone() {
      const response = await request(`/api/device/${deviceId}/demo-phone`);
      return (
        (await response.json()) as {
          messages: { to: string; body: string; replyPath?: string; aboutThemselves?: boolean }[];
        }
      ).messages;
    },
    get deviceId() {
      return deviceId;
    },
  };
}

async function sarahAsked() {
  const e = echo();
  await e.start();
  await e.say(OPENING);
  await e.say("Yes");
  e.advance(3 * 60_000);
  expect(await e.say("What's new?")).toContain("Should I email Sarah");
  expect(await e.say("Yes")).toMatch(/^Done\. I'll tell you when Sarah answers\./);
  const sarah = (await e.phone()).find((m) => m.to === "Sarah" && m.replyPath);
  expect(sarah).toBeDefined();
  return { e, sarah: sarah as { body: string; replyPath: string; aboutThemselves?: boolean } };
}

describe("a relative asked about someone else", () => {
  it("is asked whether the story is true, by email, on the page and on the demo phone", async () => {
    const { e, sarah } = await sarahAsked();
    expect(sarah.body).toContain("someone saying they were Ruth's grandson");
    expect(sarah.body).toContain("Do you know if this is true?");
    expect(sarah.aboutThemselves).toBe(false);
    const michael = (await e.phone()).find((m) => m.to === "Michael");
    expect(michael?.aboutThemselves).toBe(true);

    const page = await (await e.request(sarah.replyPath)).text();
    expect(page).toContain("can you help Ruth check a call?");
    expect(page).toContain("said they were Ruth&#39;s grandson");
    expect(page).toContain("It&#39;s not true");
    expect(page).not.toContain("did you just call");
    expect(page).not.toContain("It wasn&#39;t me");
  });

  it("not true: Alexa says so, the thanks page and the family page agree", async () => {
    const { e, sarah } = await sarahAsked();
    const thanks = await (await e.form(sarah.replyPath, { answer: "it_wasnt_me" })).text();
    expect(thanks).toContain("We will tell Ruth it is not true");

    const news = await e.say("What's new?");
    expect(news).toMatch(/^Sarah says it's not true, so you did the right thing by checking\./);
    expect(news).not.toContain("did not call you");

    await e.form("/family/demo", { deviceId: e.deviceId });
    const activity = await (await e.request("/family/activity")).text();
    expect(activity).toContain("said it is not true");
    expect(activity).toContain("Family said the story was not true");
  });

  it("true: Alexa still says to talk before sending anything", async () => {
    const { e, sarah } = await sarahAsked();
    await e.form(sarah.replyPath, { answer: "it_was_me" });
    const news = await e.say("Any news?");
    expect(news).toBe(
      "Sarah says it's true. Before you send anything, please call her on the number you know and talk it over.",
    );
  });

  it("a nickname tells who the caller claimed to be", async () => {
    const e = echo();
    await e.start();
    await e.say("Mike called, he's in trouble and needs money wired today.");
    await e.say("Yes");
    const messages = await e.phone();
    expect(messages.find((m) => m.to === "Michael")?.body).toContain("Was it you?");
    expect(messages.find((m) => m.to === "Sarah")?.body).toContain(
      "someone saying they were Ruth's grandson",
    );
  });
});
