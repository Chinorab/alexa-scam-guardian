/**
 * Sensitive number detection and redaction (research R6, constitution Principle III).
 *
 * 1. Spoken digits become digits ("four one two" -> "4 1 2", "double seven" -> "7 7").
 * 2. Any run of 6 or more digits (spaces, dashes or dots between them) is removed, unless it
 *    is a money amount ("$250,000", "150000 dollars").
 * 3. A phone number introduced by caller context ("called from ...") is kept apart as
 *    `callerNumber` for reports. No code path ever uses it as a destination.
 */

export type SensitiveKind = "card" | "ssn" | "routing" | "account" | "number";

export interface RedactResult {
  text: string;
  removed: boolean;
  kinds: SensitiveKind[];
  callerNumber?: string;
}

export const REDACTED = "[number removed]";
export const CALLER_NUMBER = "[caller number]";

const UNITS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const TEENS: Record<string, string> = {
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
};

const TENS: Record<string, string> = {
  twenty: "2",
  thirty: "3",
  forty: "4",
  fifty: "5",
  sixty: "6",
  seventy: "7",
  eighty: "8",
  ninety: "9",
};

const REPEATERS: Record<string, number> = { double: 2, triple: 3 };

/** Word tokens with their separators kept, so the rest of the text is untouched. */
function tokenize(text: string): string[] {
  return text.split(/(\s+|[,;:!?]+(?=\s|$))/).filter((part) => part !== "");
}

const isWord = (token: string) => /\S/.test(token) && !/^[,;:!?]+$/.test(token);
const bare = (token: string) => token.toLowerCase().replace(/[.,;:!?]+$/, "");

interface WordSlot {
  index: number;
  word: string;
  trailing: string;
  value?: string;
  /** Converted even without a numeric neighbor ("forty two", "double seven"). */
  standalone?: boolean;
  consumed?: boolean;
}

/**
 * Converts dictated digits to numerals. A lone number word ("the one who called", "two
 * thousand dollars") stays as a word: only sequences are dictation.
 */
export function normalizeSpokenDigits(text: string): string {
  const tokens = tokenize(text);
  const slots: WordSlot[] = tokens.flatMap((token, index) => {
    if (!isWord(token)) return [];
    const word = bare(token);
    return [{ index, word, trailing: token.slice(word.length) }];
  });

  const plain = (word: string | undefined) =>
    word === undefined
      ? undefined
      : (UNITS[word] ?? TEENS[word] ?? (/^\d+$/.test(word) ? word : undefined));

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || slot.consumed) continue;
    const next = slots[i + 1];
    if (slot.word in REPEATERS && plain(next?.word) !== undefined && next) {
      slot.value = Array(REPEATERS[slot.word]).fill(plain(next.word)).join(" ");
      slot.standalone = true;
      slot.trailing = next.trailing;
      next.consumed = true;
    } else if (slot.word in TENS) {
      const unit = next ? UNITS[next.word] : undefined;
      if (next && unit && unit !== "0") {
        slot.value = `${TENS[slot.word]}${unit}`;
        slot.standalone = true;
        slot.trailing = next.trailing;
        next.consumed = true;
      } else {
        slot.value = `${TENS[slot.word]}0`;
      }
    } else {
      slot.value = plain(slot.word);
    }
  }

  const live = slots.filter((slot) => !slot.consumed);
  live.forEach((slot, i) => {
    if (slot.value !== undefined || (slot.word !== "oh" && slot.word !== "o")) return;
    const prev = live[i - 1]?.value;
    const next = live[i + 1]?.value;
    if (prev !== undefined && next !== undefined) slot.value = "0";
  });

  const out = [...tokens];
  live.forEach((slot, i) => {
    if (slot.value === undefined) return;
    const numericNeighbor = live[i - 1]?.value !== undefined || live[i + 1]?.value !== undefined;
    if (slot.standalone || numericNeighbor) out[slot.index] = `${slot.value}${slot.trailing}`;
  });
  for (const slot of slots) {
    if (!slot.consumed) continue;
    out[slot.index] = "";
    // remove the space that separated the consumed word from the previous one
    const gap = slot.index - 1;
    if (out[gap] !== undefined && out[gap]?.trim() === "") out[gap] = "";
  }
  return out.join("");
}

/** Digits joined by single spaces, dashes or dots. */
const DIGIT_RUN = /\d(?:[ .-]?\d)*/g;

const MONEY_BEFORE = /\$\s?$/;
const MONEY_AFTER = /^,?\d*\s*(dollars?|bucks|usd)\b/i;
const CALLER_CONTEXT =
  /\b(called (me )?from|calling from|caller id( said| showed| was)?|(his|her|their) (phone )?number (was|is)|number (he|she|they) called from( was| is)?)\s*:?\s*$/i;

const KIND_CUES: [SensitiveKind, RegExp][] = [
  ["ssn", /\b(social security|social|ssn)\b/i],
  ["routing", /\brouting\b/i],
  ["account", /\baccount\b/i],
  ["card", /\b(card|visa|mastercard|amex|pin|cvv|security code)\b/i],
];

function kindFromContext(before: string): SensitiveKind {
  const window = before.slice(-60);
  let best: { kind: SensitiveKind; at: number } | undefined;
  for (const [kind, cue] of KIND_CUES) {
    const matches = [...window.matchAll(new RegExp(cue.source, "gi"))];
    const last = matches.at(-1);
    if (last?.index !== undefined && (!best || last.index > best.at)) {
      best = { kind, at: last.index };
    }
  }
  return best?.kind ?? "number";
}

const digitCount = (run: string) => run.replace(/\D/g, "").length;

export function redact(input: string): RedactResult {
  const text = normalizeSpokenDigits(input);
  const kinds = new Set<SensitiveKind>();
  let callerNumber: string | undefined;
  let output = "";
  let cursor = 0;

  for (const match of text.matchAll(DIGIT_RUN)) {
    const run = match[0];
    const start = match.index ?? 0;
    const end = start + run.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const digits = run.replace(/\D/g, "");

    let replacement: string | undefined;
    if (digitCount(run) >= 6) {
      const isMoney = MONEY_BEFORE.test(before) || MONEY_AFTER.test(after);
      const isPhone = digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
      if (isMoney) {
        replacement = undefined;
      } else if (isPhone && callerNumber === undefined && CALLER_CONTEXT.test(before)) {
        callerNumber = digits.slice(-10);
        replacement = CALLER_NUMBER;
      } else {
        kinds.add(kindFromContext(before));
        replacement = REDACTED;
      }
    }

    if (replacement !== undefined) {
      output += text.slice(cursor, start) + replacement;
      cursor = end;
    }
  }
  output += text.slice(cursor);

  if (kinds.size === 0 && callerNumber === undefined) {
    return { text: output, removed: false, kinds: [] };
  }
  const result: RedactResult = { text: output, removed: kinds.size > 0, kinds: [...kinds] };
  if (callerNumber !== undefined) result.callerNumber = callerNumber;
  return result;
}

const SENSITIVE_KEYWORD =
  /\b(card|visa|mastercard|amex|pin|cvv|security code|account|routing|social security|social|ssn)\b/gi;

/**
 * True as soon as the older adult starts saying a sensitive number, so the guardian can
 * interrupt before the full number is spoken (FR-017).
 */
export function startsSensitiveNumber(partial: string): boolean {
  const text = normalizeSpokenDigits(partial);

  for (const match of text.matchAll(DIGIT_RUN)) {
    if (digitCount(match[0]) < 6) continue;
    const start = match.index ?? 0;
    const before = text.slice(0, start);
    const after = text.slice(start + match[0].length);
    if (!MONEY_BEFORE.test(before) && !MONEY_AFTER.test(after)) return true;
  }

  for (const keyword of text.matchAll(SENSITIVE_KEYWORD)) {
    const rest = text.slice((keyword.index ?? 0) + keyword[0].length);
    // the number usually follows within a few words: "number is", "on the back is"
    const nearby = rest.match(/^(?:\W+\w+){0,5}?\W+(\d(?:[ .-]?\d)*)/);
    const run = nearby?.[1];
    if (run && digitCount(run) >= 4) {
      const afterRun = rest.slice((nearby?.index ?? 0) + (nearby?.[0].length ?? 0));
      if (!MONEY_AFTER.test(afterRun)) return true;
    }
  }
  return false;
}
