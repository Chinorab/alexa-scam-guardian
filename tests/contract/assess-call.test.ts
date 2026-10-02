import { afterEach, describe, expect, it } from "vitest";
import { MICHAEL, SARAH, member, seededSession } from "./helpers";

type Session = Awaited<ReturnType<typeof seededSession>>["session"];
let open: Session | undefined;
// Tool results are JSON; the contract is checked field by field below.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
afterEach(async () => open?.close());

async function assess(description: string, members = [MICHAEL, SARAH], checkId?: string) {
  const { session, deps } = await seededSession(members);
  open = session;
  const args: Record<string, unknown> = { description };
  if (checkId) args.checkId = checkId;
  const outcome = await session.call("assess_call", args);
  return { outcome, s: outcome.structured as Json, deps, session };
}

describe("assess_call", () => {
  it("is listed with a warning signs screen card and no destination parameter", async () => {
    const { session } = await seededSession();
    open = session;
    const tool = session.tools.find((t) => t.name === "assess_call");
    expect(tool?.uiResourceUri).toBe("ui://guardian/warning-signs");
    const properties = Object.keys((tool?.inputSchema.properties ?? {}) as object);
    expect(properties.sort()).toEqual(["checkId", "description"]);
  });

  it("returns warning signs with official sources and offers to verify the saved grandson", async () => {
    const { s } = await assess(
      "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.",
    );
    const ids = s.matchedSigns.map((sign: { id: string }) => sign.id);
    expect(ids).toEqual(expect.arrayContaining(["arrest-story", "gift-cards"]));
    for (const sign of s.matchedSigns) {
      expect(sign.source.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(ftc|ic3|fbi)\.gov\//);
    }
    expect(s.nextStep).toBe("offer_verify");
    expect(s.familyMatches).toEqual([
      { memberId: MICHAEL.memberId, name: "Michael", relationship: "grandson", channel: "text" },
    ]);
    expect(s.headsUpCandidate).toMatchObject({ memberId: SARAH.memberId, name: "Sarah" });
    expect(s.pattern).toMatchObject({ id: "family-emergency" });
    expect(s.assistantRules.length).toBeGreaterThan(3);
    expect(JSON.stringify(s)).not.toMatch(/\+1555/);
  });

  it("flags danger first", async () => {
    const { s } = await assess("There's a man at my door, he says he's here for the cash");
    expect(s.danger).toBe(true);
    expect(s.nextStep).toBe("call_911");
  });

  it("asks to hang up first when the caller is still on the line", async () => {
    const { s } = await assess(
      "He's still on the other phone and says I have to hurry with the gift cards",
    );
    expect(s.nextStep).toBe("hang_up_first");
  });

  it("removes sensitive numbers and asks to interrupt", async () => {
    const { s, deps } = await assess("He wanted my card number 4122 3344 5566 7788 for the bail");
    expect(s.interrupt).toBe(true);
    expect(s.sensitiveDataRemoved).toBe(true);
    const check = await deps.store.getCheck("hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B", s.checkId);
    expect(check?.description).not.toMatch(/4122/);
  });

  it("keeps the caller's number for reports only", async () => {
    const { s, deps } = await assess("He called from 555 123 4567 asking for gift cards");
    const check = await deps.store.getCheck("hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B", s.checkId);
    expect(check?.callerNumber).toBe("5551234567");
    expect(JSON.stringify(s)).not.toContain("5551234567");
  });

  it("asks which person when two relatives match", async () => {
    const daniel = member({ name: "Daniel", relationship: "grandson" });
    const { s } = await assess("My grandson called crying, he needs bail money right now", [
      MICHAEL,
      daniel,
    ]);
    expect(s.nextStep).toBe("pick_member");
    expect(s.familyMatches.map((m: { name: string }) => m.name).sort()).toEqual([
      "Daniel",
      "Michael",
    ]);
  });

  it("never offers an opted out or unverifiable person", async () => {
    const optedOut = { ...MICHAEL, optedOut: true };
    const { s } = await assess("My grandson needs bail money in gift cards right away", [
      optedOut,
      SARAH,
    ]);
    expect(s.familyMatches).toEqual([]);
    expect(s.nextStep).toBe("offer_heads_up");
  });

  it("does not call an ordinary call safe, it reports no signs", async () => {
    const { s } = await assess("The pharmacy called about my refill");
    expect(s.matchedSigns).toEqual([]);
    expect(s.nextStep).toBe("no_signs_found");
  });

  it("extends an existing check with more details", async () => {
    const first = await assess("My grandson called");
    const outcome = await first.session.call("assess_call", {
      description: "He says he needs gift cards for bail tonight",
      checkId: first.s.checkId,
    });
    const s = outcome.structured as Json;
    expect(s.checkId).toBe(first.s.checkId);
    expect(s.nextStep).toBe("offer_verify");
  });

  it("refuses a check that belongs to another household", async () => {
    const { session } = await seededSession();
    open = session;
    const outcome = await session.call("assess_call", {
      description: "hello",
      checkId: "chk_other",
    });
    expect(outcome.isError).toBe(true);
  });
});

describe("close_check and idle checks", () => {
  it("closes a check", async () => {
    const first = await assess("My grandson called about bail money");
    const outcome = await first.session.call("close_check", { checkId: first.s.checkId });
    expect(outcome.structured).toMatchObject({ closed: true });
    const check = await first.deps.store.getCheck("hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B", first.s.checkId);
    expect(check?.state).toBe("closed");
  });

  it("starts a new check after 30 minutes idle", async () => {
    const { session, deps, advance } = await seededSession();
    open = session;
    const first = await session.call("assess_call", { description: "My grandson called" });
    const firstId = (first.structured as Json).checkId;
    advance(31 * 60_000);
    const later = await session.call("assess_call", {
      description: "Someone from Medicare called",
      checkId: firstId,
    });
    expect((later.structured as Json).checkId).not.toBe(firstId);
    const old = await deps.store.getCheck("hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B", firstId);
    expect(old?.state).toBe("closed");
  });
});
