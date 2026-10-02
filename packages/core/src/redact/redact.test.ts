import { describe, expect, it } from "vitest";
import { normalizeSpokenDigits, redact, startsSensitiveNumber } from "./redact";

describe("normalizeSpokenDigits", () => {
  it("turns spoken digits into digits", () => {
    expect(normalizeSpokenDigits("four one two two")).toBe("4 1 2 2");
    expect(normalizeSpokenDigits("five oh five")).toBe("5 0 5");
    expect(normalizeSpokenDigits("double seven triple two")).toBe("7 7 2 2 2");
    expect(normalizeSpokenDigits("forty two")).toBe("42");
  });

  it("keeps words that are not digit dictation", () => {
    expect(normalizeSpokenDigits("oh no, he called")).toBe("oh no, he called");
    expect(normalizeSpokenDigits("two thousand dollars")).toBe("two thousand dollars");
    expect(normalizeSpokenDigits("the one who called")).toBe("the one who called");
  });
});

describe("redact", () => {
  it("removes a dictated card number", () => {
    const result = redact("My card number is four one two two three three four four five five");
    expect(result.removed).toBe(true);
    expect(result.kinds).toContain("card");
    expect(result.text).not.toMatch(/\d{4}/);
    expect(result.text).toContain("[number removed]");
  });

  it("removes a Social Security number written with dashes", () => {
    const result = redact("He asked for my social security number, 123-45-6789.");
    expect(result.removed).toBe(true);
    expect(result.kinds).toContain("ssn");
    expect(result.text).not.toContain("6789");
  });

  it("removes routing and account numbers", () => {
    const routing = redact("the routing number is 021000021");
    expect(routing.kinds).toContain("routing");
    const account = redact("account 1234 5678 90");
    expect(account.kinds).toContain("account");
    expect(account.text).not.toMatch(/\d{4}/);
  });

  it("removes any long digit run even without a keyword", () => {
    const result = redact("he read 9 8 7 6 5 4 3 to me");
    expect(result.removed).toBe(true);
    expect(result.kinds).toEqual(["number"]);
  });

  it("keeps money amounts", () => {
    const words = redact("He needs two thousand dollars in gift cards");
    expect(words.removed).toBe(false);
    expect(words.text).toBe("He needs two thousand dollars in gift cards");
    const symbols = redact("They want $250,000 by tonight");
    expect(symbols.removed).toBe(false);
    expect(symbols.text).toContain("$250,000");
    const amount = redact("I paid 150000 dollars");
    expect(amount.removed).toBe(false);
  });

  it("keeps short numbers, years and times", () => {
    expect(redact("He called at 9 30 on October 1 2026").removed).toBe(false);
    expect(redact("It was 911 he said").removed).toBe(false);
  });

  it("keeps the caller's number separately when introduced by caller context", () => {
    const result = redact("He called from 555 123 4567 and said he was in jail");
    expect(result.callerNumber).toBe("5551234567");
    expect(result.text).toContain("[caller number]");
    expect(result.text).not.toContain("4567");
    expect(result.removed).toBe(false);
  });

  it("does not treat a number as the caller's without context", () => {
    const result = redact("the number is 555 123 4567");
    expect(result.callerNumber).toBeUndefined();
    expect(result.removed).toBe(true);
  });

  it("leaves plain descriptions untouched", () => {
    const text = "My grandson called, he is in jail and needs bail money in gift cards.";
    expect(redact(text)).toEqual({ text, removed: false, kinds: [] });
  });
});

describe("startsSensitiveNumber", () => {
  it("fires once four digits follow a sensitive keyword", () => {
    expect(startsSensitiveNumber("my card number is four one two")).toBe(false);
    expect(startsSensitiveNumber("my card number is four one two two")).toBe(true);
    expect(startsSensitiveNumber("the PIN on the back is 4 4 1 9")).toBe(true);
    expect(startsSensitiveNumber("my social is one two three four")).toBe(true);
  });

  it("fires on six digits in a row without a keyword", () => {
    expect(startsSensitiveNumber("it's 1 2 3 4 5")).toBe(false);
    expect(startsSensitiveNumber("it's 1 2 3 4 5 6")).toBe(true);
  });

  it("ignores amounts and ordinary speech", () => {
    expect(startsSensitiveNumber("he wants two thousand dollars")).toBe(false);
    expect(startsSensitiveNumber("my grandson called about his card")).toBe(false);
  });
});

describe("the caller's own number", () => {
  it("is not interrupted, and is kept apart for the report", () => {
    const text = "My grandson called from 212 555 0199 and needs bail";
    expect(startsSensitiveNumber(text)).toBe(false);
    expect(redact(text).callerNumber).toBe("2125550199");
  });

  it("a card number after 'called from' wording is still stopped", () => {
    expect(startsSensitiveNumber("he called from my card 4111 1111 1111 1111")).toBe(true);
  });
});
