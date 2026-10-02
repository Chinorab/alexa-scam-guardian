/**
 * Whole conversations in the demo household that a single phrase test cannot see: what
 * comes after "hang up first", details with nothing new, a check they already made.
 */
import { describe, expect, it } from "vitest";
import { demo } from "./demo-household";

const OPENING =
  "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.";

async function started() {
  const d = demo();
  await d.start();
  return d;
}

describe("conversations, turn by turn", () => {
  it("after hang up first, saying they hung up continues the check", async () => {
    const d = await started();
    const first = await d.say("My grandson needs bail money, he's still on the phone right now.");
    expect(first.say).toMatch(/^You can hang up now\./);
    expect(first.say).toContain("Then we'll check with Michael together.");
    const next = await d.say("Okay, I hung up.");
    expect(next.say).toContain("Should I text Michael");
    await d.say("Yes");
    expect((await d.phone()).map((m) => m.to)).toContain("Michael");
  });

  it("a bare okay after hang up first also continues the check", async () => {
    const d = await started();
    await d.say(`${OPENING} He's still on the other line.`);
    const next = await d.say("ok");
    expect(next.say).toContain("Should I text Michael");
  });

  it("money moved in the middle of a check gets the already paid steps", async () => {
    const d = await started();
    await d.say(OPENING);
    await d.say("No");
    const paid = await d.say("Actually I already moved five thousand dollars.");
    expect(paid.say).toMatch(/^Thank you for telling me\./);
  });

  it("money moved after Sarah was told goes straight to the hotline and the report", async () => {
    const d = await started();
    await d.say("My bank called and said I need to move my money to a safe account.");
    await d.say("Yes");
    const paid = await d.say("I already moved five thousand dollars.");
    expect(paid.say).not.toContain("Should I tell Sarah");
    expect(paid.say).toContain("833 372 8311");
    expect(paid.say).toMatch(/Would you like help reporting this call\?$/);
    const report = await d.say("Yes");
    expect(report.cards.map((c) => c.uri)).toContain("ui://guardian/report");
  });

  it("hello gets an invitation and starts no check", async () => {
    const d = await started();
    const hello = await d.say("Hello");
    expect(hello.say).toBe(
      "I can help you check a call, text or email that worried you. Tell me what happened.",
    );
    expect(hello.cards).toEqual([]);
    const help = await d.say("What can you do?");
    expect(help.say).toBe(hello.say);
  });

  it("what should I do, while a question is open, answers and asks again", async () => {
    const d = await started();
    await d.say(OPENING);
    const reply = await d.say("What should I do?");
    expect(reply.say).toMatch(/^Please don't send any money, and hang up if they call back\./);
    expect(reply.say).toContain("Should I text Michael");
    expect(await d.phone()).toEqual([]);
  });

  it("what should I do with someone at the door leads with 911", async () => {
    const d = await started();
    const reply = await d.say("What should I do, a man is at my door for the money?");
    expect(reply.say).toMatch(/911/);
  });

  it("a check they already made gets thanks, no offer, and the report", async () => {
    const d = await started();
    const reply = await d.say(
      "I got a call that my grandson is in jail, but I called him on his real number and he's fine.",
    );
    expect(reply.say).toMatch(/^I'm glad you checked with your family\./);
    expect(reply.say).not.toContain("Should I text");
    const report = await d.say("Yes");
    expect(report.cards.map((c) => c.uri)).toContain("ui://guardian/report");
    expect(await d.phone()).toEqual([]);
  });

  it("after a no, more details with nothing new don't bring the offer back", async () => {
    const d = await started();
    await d.say("My online boyfriend needs money for a plane ticket to come see me.");
    await d.say("No");
    const more = await d.say("But I love him.");
    expect(more.say).toBe(
      "I understand. Please don't send any money until you talk it over with your family.",
    );
    const changed = await d.say("Actually, tell Sarah.");
    expect(changed.say).toContain("Should I tell Sarah");
  });

  it("a saved relative asking for money is offered a check, signs or not", async () => {
    const d = await started();
    const reply = await d.say("My grandson called and asked for money.");
    expect(reply.say).toMatch(/send any money/);
    expect(reply.say).toContain("Should I text Michael");
  });

  it("a relative calling with no money asked is not turned into a check", async () => {
    const d = await started();
    const reply = await d.say("My grandson called to wish me happy birthday.");
    expect(reply.say).not.toContain("Should I text Michael");
  });
});
