/**
 * User story 2 end to end through the web API in simplified mode, against the real MCP server
 * and the seeded demo household (Michael, grandson, text; Sarah, daughter, email).
 * Covers quickstart scenarios V2, V3, V5, V10, V11 and the off topic rule (FR-024).
 */
import { describe, expect, it } from "vitest";
import { findViolations } from "@asg/core/guard/guard";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { makeDeps, SESSION } from "./helpers";

function demo() {
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

const OPENING =
  "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.";

describe("user story 2: check with the real relative", () => {
  it("V2: offers to text Michael, sends after yes, and reports his denial", async () => {
    const d = demo();
    await d.start();
    const first = await d.say(OPENING);
    expect(first.say).toBe(
      "I'm glad you asked me first. The emergency story and the gift cards are common signs of a scam. Should I text Michael to check, and tell Sarah you got this call?",
    );
    expect(first.cards.map((c) => c.uri)).toContain("ui://guardian/warning-signs");

    const sent = await d.say("Yes");
    expect(sent.say).toMatch(/^Done\. I'll tell you when Michael answers\. While we wait: /);
    expect(sent.cards.map((c) => c.uri)).toContain("ui://guardian/check-status");

    const messages = await d.phone();
    const toMichael = messages.find((m) => m.to === "Michael");
    expect(toMichael?.replyPath).toMatch(/^\/r\//);
    expect(messages.find((m) => m.to === "Sarah")?.kind).toBe("email");

    expect((await d.events()).unread).toBe(0);
    const tapped = await d.tap(toMichael?.replyPath ?? "", "it_wasnt_me");
    expect(tapped.status).toBe(200);
    expect(await d.events()).toEqual({ unread: 1, light: "notification" });

    const news = await d.say("What's new?");
    expect(news.say).toBe(
      "Michael says he did not call you, so you did the right thing by checking. Please don't send any money. Would you like help reporting this call?",
    );
    expect((await d.events()).unread).toBe(0);
  });

  it("V3: reports a confirmation and still advises talking before paying", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("Yes please");
    const toMichael = (await d.phone()).find((m) => m.to === "Michael");
    await d.tap(toMichael?.replyPath ?? "", "it_was_me");
    const news = await d.say("Did Michael answer?");
    expect(news.say).toBe(
      "Michael says it was him. Before you send anything, please call him on the number you know and talk with him.",
    );
  });

  it("V5: after the wait time, says no answer is not a reason to pay and offers Sarah", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("Just Michael");
    d.advance(3 * 60_000);
    expect((await d.events()).light).toBe("notification");
    const news = await d.say("What's new?");
    expect(news.say).toBe(
      "Michael hasn't answered yet, and that doesn't mean something is wrong. Let's not send any money for now. Should I email Sarah on the number your family saved?",
    );
    const second = await d.say("yes");
    expect(second.say).toMatch(/^Done\. I'll tell you when Sarah answers\./);
  });

  it("sends nothing on no", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    expect((await d.say("No")).say).toBe("Okay, I didn't send anything.");
    expect(await d.phone()).toEqual([]);
  });

  it("re-asks on an unclear answer", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    const unclear = await d.say("hmm I am not sure what to do");
    expect(unclear.say).toBe(
      "Sorry, I didn't catch that. Should I text Michael to check, and tell Sarah you got this call? You can say yes or no.",
    );
    expect(await d.phone()).toEqual([]);
  });

  it("V10: refuses to call the caller back and offers Michael instead", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("No");
    const back = await d.say("Call back the number that called me");
    expect(back.say).toBe(
      "I won't call that number, because scammers control it. I can text Michael on the number your family saved. Should I?",
    );
    const yes = await d.say("Yes");
    expect(yes.say).toMatch(/^Done\./);
  });

  it("V11: checks the family password without ever saying it", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    const wrong = await d.say("He said the password is green lake");
    expect(wrong.say).toBe("That doesn't match your family password. Please don't send any money.");
    const right = await d.say("Now he says the password is blue river");
    expect(right.say).toBe(
      "That matches your family password. Even so, let's check with Michael before you send any money.",
    );
    expect(right.say).not.toMatch(/blue|river/i);
    const ask = await d.say("What's our family password?");
    expect(ask.say).toMatch(/^I can't say the family password out loud/);
  });

  it("FR-024: answers an off topic request briefly and returns to the open question", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    const off = await d.say("What's the weather today?");
    expect(off.say).toBe(
      "I can't help with that here. Let's get back to the call you told me about. Should I text Michael to check, and tell Sarah you got this call?",
    );
    expect((await d.say("Yes")).say).toMatch(/^Done\./);
  });
});

describe("reply page", () => {
  it("never records an answer on a plain visit", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("Yes");
    const replyPath = (await d.phone()).find((m) => m.to === "Michael")?.replyPath ?? "";
    const page = await d.app.request(`http://web.test${replyPath}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("It wasn&#39;t me");
    expect((await d.events()).unread).toBe(0);
  });

  it("accepts only one answer", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("Yes");
    const replyPath = (await d.phone()).find((m) => m.to === "Michael")?.replyPath ?? "";
    expect((await d.tap(replyPath, "it_wasnt_me")).status).toBe(200);
    expect((await d.tap(replyPath, "it_was_me")).status).toBe(409);
  });

  it("returns 404 for unknown links", async () => {
    const d = demo();
    expect((await d.app.request("http://web.test/r/nothing-here")).status).toBe(404);
  });
});

describe("user story 3: let a trusted contact know", () => {
  it("offers a heads up when nobody can be verified, and confirms it", async () => {
    const d = demo();
    await d.start();
    const first = await d.say(
      "Someone from Medicare called and said my benefits are suspended unless I pay with gift cards",
    );
    expect(first.say).toMatch(/Should I tell Sarah you got this call, so she can help\?$/);
    const done = await d.say("Yes");
    expect(done.say).toBe("Done. I let Sarah know.");
    expect((await d.phone()).map((m) => m.to)).toEqual(["Sarah"]);
  });
});

describe("user story 5: already paid and reporting", () => {
  it("V6: gives the official first step, offers Sarah, then the DOJ hotline", async () => {
    const d = demo();
    await d.start();
    const first = await d.say(
      "My grandson called from jail. I already bought the gift cards and read him the numbers.",
    );
    expect(first.say).toBe(
      "Thank you for telling me. Call the company that sold the gift card right away. Should I tell Sarah you got this call, so she can help?",
    );
    const second = await d.say("Yes");
    expect(second.say).toBe(
      "Done. I let Sarah know. You can also call the National Elder Fraud Hotline at 833 372 8311 on weekdays for free help.",
    );
  });

  it("treats money already sent as the first thing, even with no other warning sign", async () => {
    const d = demo();
    await d.start();
    const first = await d.say("I already bought the cards and read him the numbers.");
    expect(first.say).toBe(
      "Thank you for telling me. Call the company that sold the gift card right away. Should I tell Sarah you got this call, so she can help?",
    );
  });

  it("still gives the hotline when the heads up is declined", async () => {
    const d = demo();
    await d.start();
    await d.say(
      "I already wired the money through Western Union to the lawyer for my grandson's bail",
    );
    const no = await d.say("No");
    expect(no.say).toBe(
      "You can also call the National Elder Fraud Hotline at 833 372 8311 on weekdays for free help.",
    );
  });

  it("prepares the report after a denial, with the report card", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("Yes");
    const toMichael = (await d.phone()).find((m) => m.to === "Michael");
    await d.tap(toMichael?.replyPath ?? "", "it_wasnt_me");
    await d.say("What's new?");
    const report = await d.say("Yes");
    expect(report.say).toBe(
      "I put a summary on the screen with where to report it. Nothing was sent to any agency.",
    );
    expect(report.cards.map((c) => c.uri)).toContain("ui://guardian/report");
  });

  it("will not file for them, and offers to share with Sarah instead", async () => {
    const d = demo();
    await d.start();
    await d.say(OPENING);
    await d.say("Just Michael");
    const refuse = await d.say("Can you send it for me?");
    expect(refuse.say).toBe(
      "I can't file reports, but I can share the summary with Sarah so she can help. Should I?",
    );
    expect((await d.say("Yes")).say).toBe("Done. I let Sarah know.");
  });

  it("prepares a report when asked directly", async () => {
    const d = demo();
    await d.start();
    await d.say("Someone from the IRS said I owe taxes and must pay with Bitcoin today");
    const report = await d.say("How do I report this?");
    expect(report.say).toMatch(/^I put a summary on the screen/);
  });
});
