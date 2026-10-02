/**
 * Generated cases for Principle III: hundreds of card, Social Security, routing and account
 * numbers, written and spoken the many ways people say them. Whatever the form, no window of
 * six digits of the original number may survive redaction. Seeded, so failures reproduce.
 */
import { describe, expect, it } from "vitest";
import { redact, startsSensitiveNumber } from "./redact";

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

type Style = (digits: string, rand: () => number) => string;

const group = (digits: string, sizes: number[], separator: string) => {
  const parts: string[] = [];
  let at = 0;
  for (const size of sizes) {
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  if (at < digits.length) parts.push(digits.slice(at));
  return parts.filter(Boolean).join(separator);
};

const spokenDigit = (d: string, rand: () => number) =>
  d === "0" && rand() < 0.5 ? "oh" : WORDS[Number(d)]!;

const STYLES: Record<string, Style> = {
  plain: (d) => d,
  spaced4: (d) => group(d, [4, 4, 4, 4], " "),
  dashed4: (d) => group(d, [4, 4, 4, 4], "-"),
  ssnDashes: (d) => group(d, [3, 2, 4], "-"),
  ssnSpaces: (d) => group(d, [3, 2, 4], " "),
  dotted: (d) => group(d, [3, 3, 3, 3, 4], "."),
  everyDigit: (d) => d.split("").join(" "),
  spoken: (d, rand) =>
    d
      .split("")
      .map((x) => spokenDigit(x, rand))
      .join(" "),
  spokenCommas: (d, rand) =>
    d
      .split("")
      .map((x) => spokenDigit(x, rand))
      .join(", "),
  mixed: (d, rand) =>
    d
      .split("")
      .map((x) => (rand() < 0.5 ? x : spokenDigit(x, rand)))
      .join(" "),
  groupsAnd: (d, rand) =>
    group(d, [4, 4, 4, 4], "|")
      .split("|")
      .map((g) =>
        g
          .split("")
          .map((x) => spokenDigit(x, rand))
          .join(" "),
      )
      .join(" and "),
  spokenDash: (d, rand) =>
    group(d, [3, 2, 4, 4, 4], "|")
      .split("|")
      .map((g) =>
        g
          .split("")
          .map((x) => spokenDigit(x, rand))
          .join(" "),
      )
      .join(" dash "),
  spacedCommas: (d) => d.split("").join(" , "),
  doubles: (d, rand) => {
    const out: string[] = [];
    for (let i = 0; i < d.length; i++) {
      if (d[i] === d[i + 1] && rand() < 0.7) {
        out.push(`double ${spokenDigit(d[i]!, rand)}`);
        i++;
      } else out.push(spokenDigit(d[i]!, rand));
    }
    return out.join(" ");
  },
};

const LEADS = [
  "my card number is",
  "the number on my card is",
  "my social is",
  "my social security number is",
  "routing number",
  "my account number is",
  "he asked me to read him",
  "okay it's",
  "",
];

function digitsOf(length: number, rand: () => number) {
  let out = String(1 + Math.floor(rand() * 9));
  while (out.length < length) out += String(Math.floor(rand() * 10));
  return out;
}

/** Every six digit window of the original, which must not appear in the output's digits. */
function leaks(original: string, output: string): string[] {
  const kept = output.replace(/\D/g, "");
  const windows: string[] = [];
  for (let i = 0; i + 6 <= original.length; i++) windows.push(original.slice(i, i + 6));
  return windows.filter((w) => kept.includes(w));
}

/** Spoken words turned back into digits, as a listener would, so spoken leaks count too. */
function asDigits(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bdouble (\w+)/g, "$1 $1")
    .replace(/\boh\b/g, "0")
    .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) =>
      String(WORDS.indexOf(w)),
    );
}

describe("redaction, generated cases", () => {
  const rand = random(20261002);
  const cases: { length: number; style: string; text: string; digits: string }[] = [];
  for (const length of [9, 10, 12, 16]) {
    for (const [style, render] of Object.entries(STYLES)) {
      for (let n = 0; n < 6; n++) {
        const digits = digitsOf(length, rand);
        const lead = LEADS[Math.floor(rand() * LEADS.length)]!;
        cases.push({ length, style, digits, text: `${lead} ${render(digits, rand)}`.trim() });
      }
    }
  }

  it(`removes every number in ${cases.length} generated sentences`, () => {
    const failures = cases
      .map((c) => ({ ...c, out: redact(c.text).text }))
      .filter((c) => leaks(c.digits, asDigits(c.out)).length > 0)
      .map((c) => `${c.style}: "${c.text}" -> "${c.out}"`);
    expect(failures).toEqual([]);
  });

  it("notices a number being dictated after its first few digits", () => {
    const failures = cases
      .filter((c) => c.style !== "plain" && c.style !== "dotted")
      .map((c) => {
        const spokenSoFar = c.text
          .split(" ")
          .slice(0, c.text.split(" ").length - 3)
          .join(" ");
        return { c, spokenSoFar };
      })
      .filter(({ spokenSoFar }) =>
        /\d|zero|one|two|three|four|five|six|seven|eight|nine/.test(spokenSoFar),
      )
      .filter(({ spokenSoFar }) => asDigits(spokenSoFar).replace(/\D/g, "").length >= 6)
      .filter(({ spokenSoFar }) => !startsSensitiveNumber(spokenSoFar))
      .map(({ c, spokenSoFar }) => `${c.style}: "${spokenSoFar}"`);
    expect(failures).toEqual([]);
  });
});
