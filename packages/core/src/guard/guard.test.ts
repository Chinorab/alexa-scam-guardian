import { describe, expect, it } from "vitest";
import { findViolations, guardLine } from "./guard";

const SAFE = "Let's not send any money for now.";

function violations(line: string, phrasesToNeverRepeat: string[] = []) {
  return guardLine(line, { fallback: SAFE, phrasesToNeverRepeat }).violations;
}

describe("guardLine accepts the reference dialogue lines", () => {
  it.each([
    "I'm glad you asked me first. The rush, the jail story and the gift cards are common signs of a scam. Should I text Michael to check, and tell Sarah you got this call?",
    "Done. I'll tell you when Michael answers. While we wait, no court or police department asks for gift cards.",
    "Michael answered. He says it was him. Before you send anything, please call him on the number you know and talk with him.",
    "Don't open the door and don't hand over money. If you feel unsafe, call 911 now.",
    "I won't call that number, because scammers control it. I can text Michael on the number your family saved. Should I?",
    "Let's not send any money for now. Should I try Sarah?",
    "You can reach the National Elder Fraud Hotline at 833 372 8311.",
  ])("%s", (line) => {
    const result = guardLine(line, { fallback: SAFE });
    expect(result.violations).toEqual([]);
    expect(result.line).toBe(line);
  });
});

describe("guardLine blocks payment approval", () => {
  it.each([
    "It's safe to pay him.",
    "That sounds fine, you can send the money.",
    "Go ahead and buy the gift cards.",
    "It's OK to wire the money now.",
    "This call is legit.",
    "Good news, it's not a scam.",
    "Since Michael confirmed, feel free to pay.",
  ])("%s", (line) => {
    expect(violations(line)).toContain("approval");
  });

  it("replaces a blocked line with the fallback", () => {
    const result = guardLine("It's safe to pay him.", { fallback: SAFE });
    expect(result.line).toBe(SAFE);
  });
});

describe("guardLine blocks other unsafe content", () => {
  it("blocks long digit runs", () => {
    expect(violations("Your card ending 4122 3344 is noted.")).toContain("digits");
  });

  it("blocks echoing a phrase heard in a password check", () => {
    expect(violations("Blue river matches your family password.", ["blue river"])).toContain(
      "password",
    );
  });

  it("blocks offers to contact the caller", () => {
    expect(violations("I'll call that number back for you.")).toContain("contact-caller");
    expect(violations("Let me text the caller.")).toContain("contact-caller");
    // Seen from the live model: talking more with the caller is never advice.
    expect(violations("You can hang up or ask them to call back on a number you know.")).toContain(
      "contact-caller",
    );
    expect(violations("Ask him to prove it is really him.")).toContain("contact-caller");
  });

  it("blocks asking for sensitive numbers", () => {
    expect(violations("What is your card number?")).toContain("asks-sensitive");
    expect(violations("Please read me the PIN.")).toContain("asks-sensitive");
  });

  it("blocks unsourced figures and payment advice (seen from the live model)", () => {
    expect(violations("You're not alone, this happens to thousands of people.")).toContain(
      "figures",
    );
    expect(violations("Most seniors get a call like this.")).toContain("figures");
    expect(violations("About 40 percent of calls are scams.")).toContain("figures");
    expect(
      violations("Real lawyers take payment by check or card directly to their office."),
    ).toContain("payment-advice");
    expect(violations("A real court would never ask for gift cards.")).toEqual([]);
    expect(violations("Call 911 if you feel unsafe.")).toEqual([]);
  });

  it("blocks asking for a phone number or an address (seen from the live model)", () => {
    expect(violations("Do you have Michael's phone number?")).toContain("asks-sensitive");
    expect(violations("What is the number that called you?")).toContain("asks-sensitive");
    expect(violations("Can you give me Sarah's email address?")).toContain("asks-sensitive");
    // Saying which saved number is used is not asking for one.
    expect(violations("Should I text Michael on the number your family saved?")).toEqual([]);
    expect(violations("Please call your family on a number you know.")).toEqual([]);
  });

  it("blocks copy rule breaks", () => {
    expect(violations("I used AI to check.")).toContain("copy");
    expect(violations("Wait — then call.")).toContain("copy");
  });

  it("blocks more than three sentences or more than one question", () => {
    expect(violations("One. Two. Three. Four.")).toContain("length");
    expect(violations("Is it Michael? Or is it Daniel?")).toContain("questions");
  });
});

describe("approval in roundabout words (full mode last line of defense)", () => {
  it.each([
    "There's no harm in paying.",
    "That sounds legit to me.",
    "It's probably really him, so you can help him out.",
    "Paying is the right call here.",
    "You can go ahead and send it.",
    "Since Michael confirmed, it's okay to wire it.",
  ])("catches %s", (line) => {
    expect(findViolations(line)).toContain("approval");
  });

  it.each([
    "It is not safe to pay.",
    "It's never okay to pay with gift cards.",
    "Please don't send any money.",
    "Michael says it was him. Before you send anything, please call him on the number you know.",
  ])("lets the warning %s through", (line) => {
    expect(findViolations(line)).toEqual([]);
  });
});
