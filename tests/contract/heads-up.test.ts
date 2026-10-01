/** User story 3: let a trusted contact know (FR-012, FR-015). */
import { afterEach, describe, expect, it } from "vitest";
import { HOUSEHOLD_ID, MICHAEL, SARAH, seededSession } from "./helpers";

type Seeded = Awaited<ReturnType<typeof seededSession>>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let opened: Seeded | undefined;
afterEach(async () => opened?.session.close());

async function sendHeadsUp(description: string, reply = "yes") {
  opened = await seededSession([MICHAEL, SARAH]);
  const assessed = (await opened.session.call("assess_call", { description })).structured as Json;
  const prepared = (
    await opened.session.call("prepare_outreach", {
      checkId: assessed.checkId,
      headsUpMemberIds: [SARAH.memberId],
    })
  ).structured as Json;
  const confirmed = (
    await opened.session.call("confirm_outreach", {
      pendingId: prepared.pendingId,
      userReply: reply,
    })
  ).structured as Json;
  const message = (await opened.outbox.list(HOUSEHOLD_ID)).find(
    (m) => m.memberId === SARAH.memberId,
  );
  return { assessed, prepared, confirmed, message };
}

describe("heads up", () => {
  it("asks a heads up only question naming the contact", async () => {
    const { assessed, prepared } = await sendHeadsUp(
      "Someone from Medicare called, said my benefits are suspended unless I pay with gift cards",
    );
    expect(assessed.nextStep).toBe("offer_heads_up");
    expect(prepared.question).toBe("Should I tell Sarah you got this call, so she can help?");
  });

  it("tells the contact what happened in plain words, with no sensitive numbers", async () => {
    const { confirmed, message } = await sendHeadsUp(
      "My grandson called from jail, he wants 2000 dollars in gift cards right away. My card is 4111 1111 1111 1111.",
    );
    expect(confirmed.sent).toEqual([
      { memberId: SARAH.memberId, name: "Sarah", kind: "heads_up", delivery: "sent" },
    ]);
    const body = message?.body ?? "";
    expect(message?.subject).toBe("Ruth got a suspicious call");
    expect(body).toMatch(
      /Ruth got a suspicious call at \d{1,2}:\d\d [AP]M E[SD]T from someone saying they were Ruth's grandson\./,
    );
    expect(body).toMatch(/Warning signs: the rush, the emergency story and the gift cards\./);
    expect(body).toMatch(/We advised Ruth not to send any money and to check with family first\./);
    expect(body).toMatch(/family page: https:\/\/guardian\.test\/family\/activity/);
    expect(body).toMatch(
      /To stop all messages from Scam Guardian: https:\/\/guardian\.test\/stop\//,
    );
    expect(body.replace(/https?:\/\/\S+/g, "")).not.toMatch(/\d{5,}/);
    expect(body).not.toMatch(/4111/);
    expect(body).not.toMatch(/[\u2013\u2014]/);
  });

  it("never quotes the older adult's own words", async () => {
    const { message } = await sendHeadsUp(
      "My grandson Mikey called crying about the purple car accident",
    );
    expect(message?.body).not.toMatch(/purple|crying|Mikey/i);
  });

  it("sends nothing to the contact on no", async () => {
    const { confirmed, message } = await sendHeadsUp(
      "My grandson needs bail in gift cards now",
      "no thanks",
    );
    expect(confirmed.nothingSent).toBe(true);
    expect(message).toBeUndefined();
  });
});
