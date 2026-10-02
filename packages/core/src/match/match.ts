/**
 * Rule based assessment of a (redacted) description against the official dataset.
 * Used by assess_call on the MCP server and by the simplified mode; no model involved.
 */
import {
  dataset as defaultDataset,
  type Dataset,
  type ScamPattern,
  type Source,
  type WarningSign,
} from "@asg/scam-patterns";
import type { ContactKind, PaymentMethod, Relationship } from "../ports/index";

export interface SignMatch {
  sign: WarningSign;
  sources: Source[];
}

export interface Assessment {
  /** Ordered for speech: the most telling signs first. */
  signs: SignMatch[];
  pattern?: ScamPattern;
  danger: boolean;
  callerOnLine: boolean;
  contactKind: ContactKind;
  claimedRelationship?: Relationship;
  claimedIdentity?: string;
  alreadyPaid?: { method: PaymentMethod };
}

/** Speaking order. A familiar voice is context, so it comes last. */
const SIGN_PRIORITY = [
  "urgency",
  "secrecy",
  "arrest-story",
  "gift-cards",
  "wire-transfer",
  "crypto",
  "payment-app",
  "cash-pickup",
  "move-money",
  "threats",
  "stay-on-line",
  "government-caller",
  "tech-support",
  "prize-fee",
  "online-sweetheart",
  "family-voice",
];

/** Immediate danger is a 911 rule from the constitution, not a scam pattern. */
const DANGER =
  /\b((at|outside) (my|the) (door|front door|house|window)|(is|are|he'?s|she'?s|they'?re|someone'?s) (here|outside)|threaten(ed|ing)? (me|to hurt|to kill)|(hurt|harm|kill|shoot) (me|you|my \w+|him|her|them)|break(ing)? in|gun|knife|weapon|chest pain|can'?t breathe|heart attack|stroke|i fell|bleeding|in danger|scared for my (life|safety)|following me)\b/i;

const ON_LINE =
  /\b((still|is|he'?s|she'?s|they'?re|caller'?s) (still )?on the (line|phone|other phone|other line)|on hold|(holding|waiting|staying) on the (phone|line)|still holding|hasn'?t hung up)\b/i;

const NOT_PAID =
  /\b(haven'?t|have not|didn'?t|did not|not yet|never) (bought|paid|sent|wired|given|gave|mailed|transferred)\b/i;
const PAID =
  /\b((i|we) (already |just )?(bought|paid|sent|wired|gave|mailed|transferred|handed|read (him|her|them) the)|already (bought|paid|sent|wired|gave|mailed|transferred))\b/i;

const PAYMENT_CUES: [PaymentMethod, RegExp][] = [
  [
    "gift_card",
    /\b(gift ?cards?|card numbers?|numbers? (off|on) the back|(bought|buy|got) (the |some )?cards|read (him|her|them) the numbers|(itunes|google play|apple|steam|target|ebay|amazon) cards?)\b/i,
  ],
  ["wire", /\b(wire|wired|western union|money ?gram)\b/i],
  ["money_transfer_app", /\b(zelle|venmo|cash ?app|paypal)\b/i],
  ["crypto", /\b(crypto(currency)?|bitcoin|coin (atm|machine))\b/i],
  [
    "cash_mail",
    /\b(mail(ed)? (the )?cash|cash in (a|the) (box|envelope|package)|fedex|ups|overnight)\b/i,
  ],
  [
    "cash_courier",
    /\b(courier|picked (it|the money|the cash) up|gave (the )?(cash|money|gold) to (a|the|some)|driver came)\b/i,
  ],
  ["bank_transfer", /\b(bank transfer|transferred|moved (my|the) money)\b/i],
];

const RELATIONSHIPS: [Relationship, RegExp][] = [
  ["grandson", /\bgrandson\b/i],
  ["granddaughter", /\bgranddaughter\b/i],
  ["nephew", /\bnephew\b/i],
  ["niece", /\bniece\b/i],
  ["son", /\bmy son\b/i],
  ["daughter", /\bmy daughter\b/i],
];

const GRANDCHILD = /\bgrand(child|kid|baby)\b/i;

const IDENTITIES: [string, RegExp][] = [
  ["Social Security", /\b(social security|ssa)\b/i],
  ["the IRS", /\birs\b/i],
  ["Medicare", /\bmedicare\b/i],
  ["the police", /\b(police|sheriff|officer|marshal)\b/i],
  ["the FBI", /\bfbi\b/i],
  ["a court", /\b(court|judge|jury duty)\b/i],
  ["a bank", /\b(bank|fraud department|fraud team)\b/i],
  ["tech support", /\b(microsoft|apple support|geek squad|tech support|norton|mcafee)\b/i],
  ["a lawyer", /\b(lawyer|attorney|public defender)\b/i],
];

const CONTACT_KINDS: [ContactKind, RegExp][] = [
  ["text", /\b(texted|text message|sms|a text)\b/i],
  ["email", /\b(e-?mail(ed)?)\b/i],
  ["voicemail", /\b(voicemail|voice mail|left (me )?a message)\b/i],
];

export function createMatcher(data: Dataset = defaultDataset) {
  const compiled = data.warningSigns.map((sign) => ({
    sign,
    cues: sign.cues.map((cue) => new RegExp(cue, "i")),
    sources: sign.sourceRefs.map((ref) => data.sources[ref]).filter((s): s is Source => !!s),
  }));
  const rank = (id: string) => {
    const index = SIGN_PRIORITY.indexOf(id);
    return index === -1 ? SIGN_PRIORITY.length : index;
  };

  return function assess(description: string): Assessment {
    let signs = compiled
      .filter(({ cues }) => cues.some((cue) => cue.test(description)))
      .sort((a, b) => rank(a.sign.id) - rank(b.sign.id))
      .map(({ sign, sources }) => ({ sign, sources }));
    // A relative calling is only context; on its own it is not a warning sign.
    if (signs.length === 1 && signs[0]?.sign.id === "family-voice") signs = [];

    const found = new Set(signs.map((match) => match.sign.id));
    let pattern: ScamPattern | undefined;
    let best = 0;
    for (const candidate of data.patterns) {
      const primary = candidate.signIds[0];
      if (!primary || !found.has(primary)) continue;
      const score = candidate.signIds.filter((id) => found.has(id)).length;
      if (score > best) {
        best = score;
        pattern = candidate;
      }
    }

    const assessment: Assessment = {
      signs,
      danger: DANGER.test(description),
      callerOnLine: ON_LINE.test(description),
      contactKind: CONTACT_KINDS.find(([, cue]) => cue.test(description))?.[0] ?? "call",
    };
    if (pattern) assessment.pattern = pattern;

    const relationship = RELATIONSHIPS.find(([, cue]) => cue.test(description))?.[0];
    if (relationship) {
      assessment.claimedRelationship = relationship;
      assessment.claimedIdentity = relationship;
    } else if (GRANDCHILD.test(description)) {
      assessment.claimedIdentity = "grandchild";
    } else {
      const identity = IDENTITIES.find(([, cue]) => cue.test(description))?.[0];
      if (identity) assessment.claimedIdentity = identity;
    }

    if (PAID.test(description) && !NOT_PAID.test(description)) {
      const method = PAYMENT_CUES.find(([, cue]) => cue.test(description))?.[0] ?? "other";
      assessment.alreadyPaid = { method };
    }
    return assessment;
  };
}

export const assess = createMatcher();
