import { describe, expect, it } from "vitest";
import { assess } from "./match";

const ids = (text: string) => assess(text).signs.map((match) => match.sign.id);

describe("assess", () => {
  it("finds the signs of the reference grandparent call, in speaking order", () => {
    const result = assess(
      "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail right away.",
    );
    expect(
      ids(
        "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail right away.",
      ).slice(0, 3),
    ).toEqual(["urgency", "arrest-story", "gift-cards"]);
    expect(result.pattern?.id).toBe("family-emergency");
    expect(result.claimedRelationship).toBe("grandson");
    expect(result.danger).toBe(false);
    expect(result.alreadyPaid).toBeUndefined();
    for (const match of result.signs) expect(match.sources.length).toBeGreaterThan(0);
  });

  it("recognizes a government impersonation call", () => {
    const result = assess(
      "A man from Social Security said my benefits are suspended and I'll be arrested unless I pay in Bitcoin.",
    );
    expect(result.pattern?.id).toBe("government-impersonation");
    expect(result.claimedIdentity).toBe("Social Security");
    expect(ids("A man from Social Security said my benefits are suspended")).toContain(
      "government-caller",
    );
  });

  it("recognizes a fake bank call asking to move money", () => {
    const result = assess(
      "Someone from my bank's fraud department said my account was hacked and I need to move my money to a safe account.",
    );
    expect(result.pattern?.id).toBe("bank-impersonation");
  });

  it("flags immediate danger", () => {
    expect(assess("There's a man at my door, he says he's here for the money").danger).toBe(true);
    expect(assess("He threatened me on the phone").danger).toBe(true);
    expect(assess("My grandson called about bail").danger).toBe(false);
  });

  it("notices the caller is still on the line", () => {
    expect(assess("He's still on the other phone, he says I have to hurry").callerOnLine).toBe(
      true,
    );
  });

  it("detects an earlier payment and its method", () => {
    expect(assess("I already bought the cards and read him the numbers").alreadyPaid).toEqual({
      method: "gift_card",
    });
    expect(assess("I wired the money through Western Union").alreadyPaid).toEqual({
      method: "wire",
    });
    expect(assess("I haven't paid anything yet").alreadyPaid).toBeUndefined();
  });

  it("reads how the contact happened", () => {
    expect(assess("I got a text saying I won a prize").contactKind).toBe("text");
    expect(assess("He left a message saying he's in the hospital").contactKind).toBe("voicemail");
    expect(assess("He called me").contactKind).toBe("call");
  });

  it("returns no signs for an ordinary call", () => {
    const visit = assess("My daughter called to say she will visit on Sunday");
    expect(visit.signs).toEqual([]);
    expect(visit.claimedRelationship).toBe("daughter");
    expect(assess("The pharmacy called about my refill").signs).toEqual([]);
  });
});

describe("company impersonation (FTC consumer alert, March 2024)", () => {
  it("names a caller claiming to be from a company about an order", () => {
    const result = assess(
      "Amazon called about a big order on my account and wants me to confirm my card.",
    );
    expect(result.signs.map((s) => s.sign.id)).toContain("company-caller");
    expect(result.pattern?.id).toBe("business-impersonation");
  });
});

describe("company impersonation, false positives", () => {
  it("does not flag a company named only as where gift cards come from", () => {
    expect(ids("He told me to buy Amazon gift cards with my account money.")).not.toContain(
      "company-caller",
    );
  });
});
