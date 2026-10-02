import { describe, expect, it } from "vitest";
import { parseConfirmation } from "./confirm";

const michael = { memberId: "m1", name: "Michael", nicknames: ["Mikey"] };
const sarah = { memberId: "m2", name: "Sarah", nicknames: [] };
const both = [michael, sarah];

describe("parseConfirmation", () => {
  it.each(["Yes", "yes please", "Yeah.", "Sure, go ahead", "Okay do it", "please do", "yep"])(
    "'%s' sends to everyone named in the question",
    (reply) => {
      expect(parseConfirmation(reply, both)).toEqual({ kind: "yes", memberIds: ["m1", "m2"] });
    },
  );

  it.each(["No", "no thanks", "Stop", "cancel that", "Wait", "don't", "not now", "never mind"])(
    "'%s' sends nothing",
    (reply) => {
      expect(parseConfirmation(reply, both)).toEqual({ kind: "no" });
    },
  );

  it.each([
    "",
    "   ",
    "hmm",
    "what did you say",
    "maybe later I guess",
    "I'm not sure",
    "hmm I am not sure what to do",
    "yes maybe",
    "I guess so",
    "sure, I think so",
    "probably",
  ])("'%s' is unclear and sends nothing", (reply) => {
    expect(parseConfirmation(reply, both).kind).toBe("unclear");
  });

  it("sends only to the named people when the reply narrows the list", () => {
    expect(parseConfirmation("Just Michael", both)).toEqual({ kind: "subset", memberIds: ["m1"] });
    expect(parseConfirmation("only Mikey please", both)).toEqual({
      kind: "subset",
      memberIds: ["m1"],
    });
    expect(parseConfirmation("Yes, text Michael", both)).toEqual({
      kind: "subset",
      memberIds: ["m1"],
    });
    expect(parseConfirmation("No, just Michael", both)).toEqual({
      kind: "subset",
      memberIds: ["m1"],
    });
  });

  it("excludes people the reply rules out", () => {
    expect(parseConfirmation("Yes but don't tell Sarah", both)).toEqual({
      kind: "subset",
      memberIds: ["m1"],
    });
    expect(parseConfirmation("yes, not Sarah", both)).toEqual({
      kind: "subset",
      memberIds: ["m1"],
    });
  });

  it("treats a name alone as unclear, not as a yes", () => {
    expect(parseConfirmation("Michael", both).kind).toBe("unclear");
  });

  it("treats a yes followed by a change of mind as no", () => {
    expect(parseConfirmation("yes, no wait", both)).toEqual({ kind: "no" });
  });

  it("works with a single recipient", () => {
    expect(parseConfirmation("yes", [michael])).toEqual({ kind: "yes", memberIds: ["m1"] });
  });
});
