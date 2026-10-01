/**
 * Output guard (research R5, layer 2). Every line is checked before it is spoken. A line that
 * breaks a rule is replaced by the pre approved fallback line for the current state, so the
 * older adult never hears an unsafe sentence, whatever the model produced.
 */
import { checkCopy } from "../copy/rules";

export type GuardViolation =
  | "approval"
  | "digits"
  | "password"
  | "contact-caller"
  | "asks-sensitive"
  | "copy"
  | "length"
  | "questions";

export interface GuardContext {
  /** Pre approved line used when the candidate fails. Must itself pass the guard. */
  fallback: string;
  /** Phrases heard during a family password check in this conversation. */
  phrasesToNeverRepeat?: string[];
}

export interface GuardResult {
  line: string;
  violations: GuardViolation[];
}

/** Digit strings allowed in speech: 911 and the DOJ National Elder Fraud Hotline. */
const ALLOWED_NUMBERS = new Set(["911", "8333728311", "833372831"]);

const PAY_VERBS = "(pay|send|wire|transfer|buy|give|hand over|mail)";

const APPROVAL_PATTERNS: RegExp[] = [
  new RegExp(`\\b(safe|ok|okay|fine|alright|all right|good)\\s+to\\s+${PAY_VERBS}\\b`, "i"),
  new RegExp(
    `\\b(go ahead|you can|you may|feel free to|you should)\\s+(and\\s+)?${PAY_VERBS}\\b`,
    "i",
  ),
  /\b(it'?s|this is|that'?s|the call (is|was)|this call (is|was)|it was|he'?s|she'?s)\s+(really\s+)?(safe|legit|legitimate|genuine|not a scam|nothing to worry about)\b/i,
  /\bnot a scam\b/i,
];

/** Plain imperatives ("Send the money.") count as approval unless negated or conditional. */
const PAY_ACTION = new RegExp(
  `\\b${PAY_VERBS}\\s+(him|her|them|it|the money|money|the gift cards?|gift cards?|the cash|cash)\\b`,
  "gi",
);
const NEGATION_BEFORE =
  /\b(don'?t|do not|never|not|no|before|until|without|stop|won'?t|wouldn'?t|shouldn'?t|asks? (you )?to|asked (you )?to|want(s|ed)? you to|tells? you to|told you to)\b[^.!?]{0,30}$/i;

const CONTACT_CALLER =
  /\b(i'?ll|i will|let me|i can|i'?m going to)\s+(call|text|email|contact|ring|message)\s+(back\s+)?(the caller|that number|the number that called|this number|them back|him back|her back|whoever called)\b/i;

const ASKS_SENSITIVE =
  /\b(what('?s| is)|tell me|read me|give me|say|share|spell)\b[^.?!]{0,30}\b(card|account|routing|social security|ssn|pin|password for your bank|bank password)\b/i;

function hasApproval(line: string): boolean {
  if (APPROVAL_PATTERNS.some((pattern) => pattern.test(line))) return true;
  for (const match of line.matchAll(PAY_ACTION)) {
    const before = line.slice(0, match.index ?? 0);
    const sentenceStart = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("!"),
      before.lastIndexOf("?"),
    );
    const sentenceBefore = before.slice(sentenceStart + 1);
    if (!NEGATION_BEFORE.test(sentenceBefore)) return true;
  }
  return false;
}

function hasForbiddenDigits(line: string): boolean {
  for (const match of line.matchAll(/\d(?:[ .-]?\d)*/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 4 && !ALLOWED_NUMBERS.has(digits)) {
      // years and times are fine; a 4 digit run next to other digits is not
      if (digits.length === 4 && /^(19|20)\d\d$/.test(digits)) continue;
      return true;
    }
  }
  return false;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function sentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => /\w/.test(part));
}

export function findViolations(line: string, context: Omit<GuardContext, "fallback"> = {}) {
  const violations: GuardViolation[] = [];
  if (hasApproval(line)) violations.push("approval");
  if (hasForbiddenDigits(line)) violations.push("digits");
  const normalized = normalize(line);
  if (
    (context.phrasesToNeverRepeat ?? [])
      .map(normalize)
      .some((phrase) => phrase.length > 0 && normalized.includes(phrase))
  ) {
    violations.push("password");
  }
  if (CONTACT_CALLER.test(line)) violations.push("contact-caller");
  if (ASKS_SENSITIVE.test(line)) violations.push("asks-sensitive");
  if (checkCopy(line).length > 0) violations.push("copy");
  if (sentences(line).length > 3) violations.push("length");
  if ((line.match(/\?/g) ?? []).length > 1) violations.push("questions");
  return violations;
}

export function guardLine(line: string, context: GuardContext): GuardResult {
  const violations = findViolations(line, context);
  return { line: violations.length === 0 ? line : context.fallback, violations };
}
