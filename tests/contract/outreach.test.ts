import { afterEach, describe, expect, it } from "vitest";
import { HOUSEHOLD_ID, MICHAEL, SARAH, member, seededSession } from "./helpers";

type Seeded = Awaited<ReturnType<typeof seededSession>>;
// Tool results are JSON; the contract is checked field by field.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let opened: Seeded | undefined;
afterEach(async () => opened?.session.close());

async function ready(members = [MICHAEL, SARAH]) {
  opened = await seededSession(members);
  const assessed = await opened.session.call("assess_call", {
    description: "My grandson called from jail, he needs gift cards for bail right away",
  });
  return { ...opened, checkId: (assessed.structured as Json).checkId as string };
}

async function prepare(s: Seeded, args: Record<string, unknown>) {
  const outcome = await s.session.call("prepare_outreach", args);
  return { outcome, s: outcome.structured as Json };
}

describe("outreach tools never accept a destination", () => {
  it("has no phone, email, number or address parameter on any tool", async () => {
    const { session } = await ready();
    for (const tool of session.tools) {
      const names = Object.keys((tool.inputSchema.properties ?? {}) as object);
      for (const name of names) {
        expect(name, `${tool.name}.${name}`).not.toMatch(
          /phone|email|number|address|destination|^to$/i,
        );
      }
    }
  });
});

describe("prepare_outreach", () => {
  it("builds the question naming every recipient and sends nothing", async () => {
    const s = await ready();
    const { s: out } = await prepare(s, {
      checkId: s.checkId,
      verifyMemberId: MICHAEL.memberId,
      headsUpMemberIds: [SARAH.memberId],
    });
    expect(out.question).toBe("Should I text Michael to check, and tell Sarah you got this call?");
    expect(typeof out.pendingId).toBe("string");
    expect(await s.outbox.list(HOUSEHOLD_ID)).toEqual([]);
  });

  it("refuses an opted out member, a member who cannot verify, or nobody at all", async () => {
    const optedOut = member({ name: "Daniel", relationship: "grandson", optedOut: true });
    const s = await ready([MICHAEL, SARAH, optedOut]);
    expect(
      (await prepare(s, { checkId: s.checkId, verifyMemberId: optedOut.memberId })).outcome.isError,
    ).toBe(true);
    expect(
      (await prepare(s, { checkId: s.checkId, verifyMemberId: SARAH.memberId })).outcome.isError,
    ).toBe(true);
    expect((await prepare(s, { checkId: s.checkId })).outcome.isError).toBe(true);
    expect(
      (await prepare(s, { checkId: s.checkId, headsUpMemberIds: [MICHAEL.memberId] })).outcome
        .isError,
    ).toBe(true);
  });
});

describe("confirm_outreach", () => {
  async function prepared() {
    const s = await ready();
    const { s: out } = await prepare(s, {
      checkId: s.checkId,
      verifyMemberId: MICHAEL.memberId,
      headsUpMemberIds: [SARAH.memberId],
    });
    return { ...s, pendingId: out.pendingId as string };
  }

  const confirm = async (s: Seeded, pendingId: string, userReply: string) =>
    (await s.session.call("confirm_outreach", { pendingId, userReply })).structured as Json;

  it("sends the check message and the heads up after a yes", async () => {
    const s = await prepared();
    const out = await confirm(s, s.pendingId, "Yes please");
    expect(out.nothingSent).toBe(false);
    expect(out.sent).toEqual([
      { memberId: MICHAEL.memberId, name: "Michael", kind: "verify", delivery: "sent" },
      { memberId: SARAH.memberId, name: "Sarah", kind: "heads_up", delivery: "sent" },
    ]);
    const messages = await s.outbox.list(HOUSEHOLD_ID);
    const toMichael = messages.find((m) => m.memberId === MICHAEL.memberId);
    expect(toMichael?.kind).toBe("text");
    expect(toMichael?.to).toBe(MICHAEL.phone);
    expect(toMichael?.body).toMatch(/https:\/\/guardian\.test\/r\/[A-Za-z0-9_-]{20,}/);
    expect(toMichael?.body).toMatch(/call Ruth on the number you know/i);
    const toSarah = messages.find((m) => m.memberId === SARAH.memberId);
    expect(toSarah?.kind).toBe("email");
    expect(toSarah?.to).toBe(SARAH.email);
    for (const message of messages) {
      expect(message.body.replace(/https?:\/\/\S+/g, "")).not.toMatch(/\d{6,}/);
      expect(message.body).not.toMatch(/[–—]/);
    }
    const check = await s.deps.store.getCheck(HOUSEHOLD_ID, s.checkId);
    expect(check?.state).toBe("waiting_for_reply");
  });

  it("sends only to the people the older adult names", async () => {
    const s = await prepared();
    const out = await confirm(s, s.pendingId, "Just Michael");
    expect(out.sent.map((x: Json) => x.name)).toEqual(["Michael"]);
    expect((await s.outbox.list(HOUSEHOLD_ID)).length).toBe(1);
  });

  it("sends nothing on no, and the question is then closed", async () => {
    const s = await prepared();
    expect(await confirm(s, s.pendingId, "No")).toMatchObject({
      nothingSent: true,
      reason: "declined",
    });
    expect(await s.outbox.list(HOUSEHOLD_ID)).toEqual([]);
    expect(await confirm(s, s.pendingId, "yes")).toMatchObject({
      nothingSent: true,
      reason: "expired",
    });
  });

  it("sends nothing on an unclear answer and keeps the question open", async () => {
    const s = await prepared();
    expect(await confirm(s, s.pendingId, "hmm what")).toMatchObject({
      nothingSent: true,
      reason: "unclear",
    });
    expect(await s.outbox.list(HOUSEHOLD_ID)).toEqual([]);
    expect((await confirm(s, s.pendingId, "yes")).nothingSent).toBe(false);
  });

  it("expires the question after two minutes", async () => {
    const s = await prepared();
    s.advance(2 * 60_000 + 1000);
    expect(await confirm(s, s.pendingId, "yes")).toMatchObject({
      nothingSent: true,
      reason: "expired",
    });
  });

  it("limits outreach to 10 messages per household per hour", async () => {
    const s = await ready();
    let lastError = false;
    for (let i = 0; i < 11; i++) {
      const { s: out, outcome } = await prepare(s, {
        checkId: s.checkId,
        verifyMemberId: MICHAEL.memberId,
      });
      if (outcome.isError) {
        lastError = true;
        break;
      }
      const sent = await confirm(s, out.pendingId, "yes");
      if (sent.reason === "rate_limited") {
        lastError = true;
        break;
      }
    }
    expect(lastError).toBe(true);
    expect((await s.outbox.list(HOUSEHOLD_ID)).length).toBeLessThanOrEqual(10);
  });
});
