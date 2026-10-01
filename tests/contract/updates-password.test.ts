import { afterEach, describe, expect, it } from "vitest";
import { hashFamilyPassword } from "@asg/core/auth/family-password";
import { recordReply } from "@asg/mcp-server";
import { HOUSEHOLD_ID, MICHAEL, SARAH, member, seededSession } from "./helpers";

type Seeded = Awaited<ReturnType<typeof seededSession>>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let opened: Seeded | undefined;
afterEach(async () => opened?.session.close());

const SARAH_VERIFIES = { ...SARAH, canVerify: true };

async function sentToMichael(members = [MICHAEL, SARAH_VERIFIES]) {
  opened = await seededSession(members);
  const s = opened;
  const assessed = await s.session.call("assess_call", {
    description: "My grandson called, he needs bail money in gift cards right away",
  });
  const checkId = (assessed.structured as Json).checkId as string;
  const prepared = await s.session.call("prepare_outreach", {
    checkId,
    verifyMemberId: MICHAEL.memberId,
  });
  await s.session.call("confirm_outreach", {
    pendingId: (prepared.structured as Json).pendingId,
    userReply: "yes",
  });
  const message = (await s.outbox.list(HOUSEHOLD_ID)).find((m) => m.memberId === MICHAEL.memberId);
  const token = message?.body.match(/\/r\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
  const updates = async (args: Record<string, unknown> = { checkId }) =>
    (await s.session.call("get_updates", args)).structured as Json;
  return { ...s, checkId, token, updates };
}

describe("get_updates", () => {
  it("reports who it is waiting on", async () => {
    const s = await sentToMichael();
    const out = await s.updates();
    expect(out.updates).toEqual([]);
    expect(out.waitingOn).toEqual([{ memberName: "Michael", minutesWaiting: 0 }]);
  });

  it("reports a denial once, then marks it read", async () => {
    const s = await sentToMichael();
    expect(await recordReply(s.deps, s.token, "it_wasnt_me")).toMatchObject({ ok: true });
    const out = await s.updates();
    expect(out.updates).toEqual([
      expect.objectContaining({ checkId: s.checkId, memberName: "Michael", kind: "it_wasnt_me" }),
    ]);
    expect((await s.updates()).updates).toEqual([]);
    const check = await s.deps.store.getCheck(HOUSEHOLD_ID, s.checkId);
    expect(check?.outcome).toBe("not_from_them");
  });

  it("accepts only the first reply to a message", async () => {
    const s = await sentToMichael();
    await recordReply(s.deps, s.token, "it_was_me");
    expect(await recordReply(s.deps, s.token, "it_wasnt_me")).toMatchObject({
      ok: false,
      reason: "already_answered",
    });
    const check = await s.deps.store.getCheck(HOUSEHOLD_ID, s.checkId);
    expect(check?.outcome).toBe("confirmed_by_them");
  });

  it("rejects unknown tokens", async () => {
    const s = await sentToMichael();
    expect(await recordReply(s.deps, "not-a-real-token", "it_was_me")).toMatchObject({ ok: false });
  });

  it("turns silence into no answer after the household wait time, and names who to try next", async () => {
    const s = await sentToMichael();
    s.advance(11 * 60_000);
    const out = await s.updates();
    expect(out.updates).toEqual([
      expect.objectContaining({ memberName: "Michael", kind: "no_answer" }),
    ]);
    expect(out.nextMemberToTry).toMatchObject({ memberId: SARAH.memberId, name: "Sarah" });
    const check = await s.deps.store.getCheck(HOUSEHOLD_ID, s.checkId);
    expect(check?.outcome).toBe("no_answer");
    expect((await s.updates()).updates).toEqual([]);
  });

  it("returns unread news for the household when no check is given", async () => {
    const s = await sentToMichael();
    await recordReply(s.deps, s.token, "it_wasnt_me");
    expect((await s.updates({})).updates).toHaveLength(1);
  });
});

describe("check_family_password", () => {
  async function withPassword(phrase?: string) {
    const daniel = member({ name: "Daniel", relationship: "grandson" });
    opened = await seededSession([MICHAEL, daniel]);
    if (phrase) {
      const stored = await hashFamilyPassword(phrase);
      await opened.deps.store.putPassword({
        householdId: HOUSEHOLD_ID,
        ...stored,
        setAt: "2026-10-01T00:00:00Z",
      });
    }
    const assessed = await opened.session.call("assess_call", {
      description: "My grandson called",
    });
    const checkId = (assessed.structured as Json).checkId as string;
    const check = async (phraseHeard: string) => {
      const outcome = await opened!.session.call("check_family_password", { checkId, phraseHeard });
      return {
        result: (outcome.structured as Json).result as string,
        raw: JSON.stringify(outcome),
      };
    };
    return check;
  }

  it("says when no password is set", async () => {
    const check = await withPassword();
    expect((await check("blue river")).result).toBe("not_set");
  });

  it("answers only matches or does not match, never the phrase", async () => {
    const check = await withPassword("blue river");
    const right = await check("Blue River");
    expect(right.result).toBe("matches");
    const wrong = await check("green lake");
    expect(wrong.result).toBe("does_not_match");
    expect(wrong.raw).not.toMatch(/blue|river/i);
  });

  it("locks after three wrong attempts in one check", async () => {
    const check = await withPassword("blue river");
    await check("one");
    await check("two");
    await check("three");
    expect((await check("blue river")).result).toBe("locked");
  });
});
