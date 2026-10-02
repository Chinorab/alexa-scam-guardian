import { describe, expect, it } from "vitest";
import { findViolations } from "../guard/guard";
import { phrases } from "./phrases";
import { assess } from "../match/match";
import {
  classify,
  initialState,
  simplifiedTurn,
  type AssessCallResult,
  type EngineTools,
} from "./engine";

const michael = {
  memberId: "mem_1",
  name: "Michael",
  relationship: "grandson" as const,
  channel: "text" as const,
};
const sarah = {
  memberId: "mem_2",
  name: "Sarah",
  relationship: "daughter" as const,
  channel: "email" as const,
};

/** Fake assess_call built on the real matcher, like the MCP tool. */
function fakeTools(family: (typeof michael)[] = [], headsUp?: typeof sarah): EngineTools {
  const everyone = [...family, ...(headsUp ? [headsUp] : [])];
  const byId = (id?: string) => everyone.find((m) => m.memberId === id);
  return {
    async prepareOutreach(_checkId, verifyMemberId, headsUpMemberIds = []) {
      const verify = byId(verifyMemberId);
      const helpers = headsUpMemberIds.map(byId).filter((m) => m !== undefined);
      return {
        pendingId: "pend_1",
        question: verify ? phrases.offerVerify(verify, helpers) : phrases.offerHeadsUp(helpers),
      };
    },
    async confirmOutreach(_pendingId, userReply) {
      if (!/^yes/i.test(userReply)) return { sent: [], nothingSent: true, reason: "declined" };
      return {
        sent: family.map((m) => ({
          memberId: m.memberId,
          name: m.name,
          kind: "verify" as const,
          delivery: "sent" as const,
        })),
        nothingSent: false,
      };
    },
    async getUpdates() {
      return { updates: [], waitingOn: [] };
    },
    async checkFamilyPassword() {
      return "not_set";
    },
    async getGuidance() {
      return { steps: ["Call the company that sold the gift card right away."], helpResources: [] };
    },
    async prepareReport() {
      return { reportId: "rep_1" };
    },
    async assessCall(description, checkId) {
      const result = assess(description);
      const familyMatches = result.claimedRelationship
        ? family.filter((member) => member.relationship === result.claimedRelationship)
        : [];
      const nextStep: AssessCallResult["nextStep"] = result.danger
        ? "call_911"
        : result.callerOnLine
          ? "hang_up_first"
          : result.signs.length === 0
            ? "no_signs_found"
            : familyMatches.length > 1
              ? "pick_member"
              : familyMatches.length === 1
                ? "offer_verify"
                : "offer_heads_up";
      const out: AssessCallResult = {
        checkId: checkId ?? "chk_1",
        matchedSigns: result.signs.map(({ sign }) => ({
          id: sign.id,
          label: sign.label,
          explanation: sign.explanation,
        })),
        danger: result.danger,
        nextStep,
        familyMatches,
        interrupt: false,
      };
      if (headsUp) out.headsUpCandidate = headsUp;
      return out;
    },
  };
}

describe("classify", () => {
  it.each([
    ["repeat that please", "repeat"],
    ["Repeat", "repeat"],
    ["What's new?", "whats_new"],
    ["Did Michael answer?", "whats_new"],
    ["So can I pay him?", "pay_question"],
    ["Is it safe to send the money?", "pay_question"],
    ["Call back the number that called me", "call_back"],
    ["What's our family password?", "say_password"],
    ["Send it for me", "file_for_me"],
    ["Thank you", "closing"],
    ["My grandson called from jail", "describe"],
  ])("%s -> %s", (text, intent) => {
    expect(classify(text)).toBe(intent);
  });
});

describe("simplifiedTurn", () => {
  it("speaks the reference opening and offers to check with Michael", async () => {
    const reply = await simplifiedTurn(
      "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.",
      initialState(),
      fakeTools([michael], sarah),
    );
    expect(reply.say).toBe(
      "I'm glad you asked me first. The emergency story and the gift cards are common signs of a scam. Should I text Michael to check, and tell Sarah you got this call?",
    );
    expect(reply.expectReply).toBe(true);
    expect(reply.state.offered?.memberId).toBe("mem_1");
    expect(findViolations(reply.say)).toEqual([]);
  });

  it("says to wait when no family is saved", async () => {
    const reply = await simplifiedTurn(
      "My grandson called, he needs bail money right away in gift cards",
      initialState(),
      fakeTools(),
    );
    expect(reply.say).toContain("Let's not send any money for now.");
  });

  it("puts 911 first on danger", async () => {
    const reply = await simplifiedTurn(
      "There's a man at my door, he says he's here for the money",
      initialState(),
      fakeTools([michael]),
    );
    expect(reply.say).toMatch(/^Don't open the door/);
    expect(reply.say).toContain("911");
  });

  it("asks to hang up first when the caller is still on the line", async () => {
    const reply = await simplifiedTurn(
      "He's still on the other phone, he says I have to hurry",
      initialState(),
      fakeTools([michael]),
    );
    expect(reply.say).toBe(
      "You can hang up now. A real family member will understand. Then tell me what happened.",
    );
  });

  it("never calls a call safe when no signs are found", async () => {
    const reply = await simplifiedTurn(
      "The pharmacy called about my refill",
      initialState(),
      fakeTools(),
    );
    expect(reply.say).toMatch(/^I didn't hear the common signs of a scam/);
    expect(reply.say).not.toMatch(/safe/i);
  });

  it("refuses to approve a payment and to call the caller back", async () => {
    const first = await simplifiedTurn(
      "My grandson called, he needs bail money in gift cards right away",
      initialState(),
      fakeTools([michael]),
    );
    const pay = await simplifiedTurn("So can I pay him?", first.state, fakeTools([michael]));
    expect(pay.say).toBe(
      "Let's not send any money yet. First, let's reach Michael on a number your family saved.",
    );
    const back = await simplifiedTurn(
      "Call back the number that called me",
      first.state,
      fakeTools(),
    );
    expect(back.say).toMatch(/^I won't call that number, because scammers control it\./);
  });

  it("repeats the last line", async () => {
    const first = await simplifiedTurn(
      "The pharmacy called about my refill",
      initialState(),
      fakeTools(),
    );
    const again = await simplifiedTurn("Repeat", first.state, fakeTools());
    expect(again.say).toBe(first.say);
  });

  it("never reveals the family password", async () => {
    const reply = await simplifiedTurn("What's our family password?", initialState(), fakeTools());
    expect(reply.say).toBe(
      "I can't say the family password out loud. Your family can change it on the family page.",
    );
  });
});

describe("asking to hear it again", () => {
  it.each([
    "What?",
    "Huh?",
    "Can you say that again?",
    "Could you repeat that",
    "I didn't hear you",
    "I didn't catch that",
    "Sorry, what was that?",
    "Say it slower please",
    "Slower please",
    "One more time",
  ])("'%s' is a repeat", (text) => {
    expect(classify(text)).toBe("repeat");
  });

  it.each(["What should I do?", "I didn't hear from Michael yet", "Sorry, my grandson called"])(
    "'%s' is not a repeat",
    (text) => {
      expect(classify(text)).not.toBe("repeat");
    },
  );
});

describe("asking for news from family", () => {
  it.each([
    "Any word from Michael?",
    "Has he written back?",
    "Did my grandson reply?",
    "What did Michael say?",
    "Did anyone get back to me?",
    "Have you heard from Michael?",
    "Did Sarah get the message?",
    "Is there an update?",
  ])("'%s' asks what's new", (text) => {
    expect(classify(text)).toBe("whats_new");
  });

  it("'My grandson called and said he needs bail' is still a description", () => {
    expect(classify("My grandson called and said he needs bail")).toBe("describe");
  });
});

describe("asking how to report", () => {
  it.each([
    "Who should I tell about this?",
    "Should I call the police?",
    "Help me file a complaint",
    "Where can I report a scam?",
  ])("'%s' asks for the report summary", (text) => {
    expect(classify(text)).toBe("report");
  });
});

describe("repeat before anything was said", () => {
  it("repeats the opening invitation", async () => {
    const reply = await simplifiedTurn("What?", initialState(), {} as never);
    expect(reply.say).toBe("Tell me what happened on the call.");
  });
});
