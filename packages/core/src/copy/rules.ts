/**
 * Copy rules shared by the copy lint (build time) and the output guard (run time),
 * constitution Principle VIII: no emojis, no dashes, never the word "AI".
 */

export type CopyRule = "emoji" | "dash" | "spaced-hyphen" | "ai-word";

const RULES: { rule: CopyRule; pattern: RegExp }[] = [
  { rule: "emoji", pattern: /\p{Extended_Pictographic}/u },
  { rule: "dash", pattern: /[‒–—―−]/u },
  { rule: "spaced-hyphen", pattern: /(^|\s)-{1,2}(\s|$)|\w--\w/u },
  { rule: "ai-word", pattern: /\bA\.?I\.?(?=[\s,.;:!?)'"]|$)/u },
];

export function checkCopy(text: string): CopyRule[] {
  return RULES.filter(({ pattern }) => pattern.test(text)).map(({ rule }) => rule);
}
