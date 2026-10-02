/**
 * Fixed, pre approved lines (constitution Principle VI). The simplified mode speaks only
 * these, and the output guard falls back to them. Every line: at most three short
 * sentences, at most one question, no blame, no dashes. Tested against the guard.
 */
import type { Channel, Relationship } from "../ports/index";

export interface Person {
  name: string;
  relationship: Relationship;
  channel: Channel;
}

const SHE = new Set<Relationship>(["granddaughter", "daughter", "niece"]);
const HE = new Set<Relationship>(["grandson", "son", "nephew"]);

/** Pronouns follow the saved relationship, never the name. Unknown means "they". */
export function pronouns(person: Person) {
  if (SHE.has(person.relationship)) return { subject: "she", object: "her" };
  if (HE.has(person.relationship)) return { subject: "he", object: "him" };
  return { subject: "they", object: "them" };
}

const verb = (channel: Channel) => (channel === "email" ? "email" : "text");

export function listWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const phrases = {
  thanks: () => "I'm glad you asked me first.",

  /** The caller claimed a relative the family has not saved (US2.3). */
  onlySavedPeople: (relationship: string) =>
    `I can only reach people your family saved, and no ${relationship} is saved.`,

  /** labels are dataset sign labels, for example "rush", "gift cards". */
  signs(labels: string[]): string {
    const named = labels.slice(0, 3).map((label) => `the ${label}`);
    if (named.length === 1) return `I heard a common sign of a scam: ${named[0]}.`;
    return `${capitalize(listWithAnd(named))} are common signs of a scam.`;
  },

  noSigns: () =>
    "I didn't hear the common signs of a scam. Still, before you send any money, check with the person on a number you know.",

  waitBeforePaying: () => "Let's not send any money for now.",

  offerVerify(person: Person, headsUp?: Person | Person[]): string {
    const helpers = headsUp === undefined ? [] : Array.isArray(headsUp) ? headsUp : [headsUp];
    if (helpers.length > 0) {
      return `Should I ${verb(person.channel)} ${person.name} to check, and tell ${listWithAnd(helpers.map((h) => h.name))} you got this call?`;
    }
    return `Should I ${verb(person.channel)} ${person.name} on the number your family saved?`;
  },

  offerHeadsUp: (people: Person | Person[]) => {
    const list = Array.isArray(people) ? people : [people];
    const first = list[0];
    if (list.length === 1 && first) {
      return `Should I tell ${first.name} you got this call, so ${pronouns(first).subject} can help?`;
    }
    return `Should I tell ${listWithAnd(list.map((p) => p.name))} you got this call, so they can help?`;
  },

  pickMember: (relationshipWord: string, names: string[]) =>
    `Which ${relationshipWord}, ${names.slice(0, -1).join(", ")} or ${names.at(-1)}?`,

  unknownRelative: (fallback?: Person) =>
    fallback
      ? `I can only reach people your family saved. Should I ${verb(fallback.channel)} ${fallback.name} instead?`
      : "I can only reach people your family saved. Please call your family on a number you know before sending any money.",

  noFamilySetup: () =>
    "Your family hasn't saved anyone for me to contact yet. Please call your family on a number you know before sending any money.",

  sent(verifyName?: string, headsUpNames: string[] = []): string {
    const parts: string[] = ["Done."];
    if (verifyName) parts.push(`I'll tell you when ${verifyName} answers.`);
    else if (headsUpNames.length > 0) parts.push(`I let ${listWithAnd(headsUpNames)} know.`);
    return parts.join(" ");
  },

  whileWaiting: (explanation: string) => `While we wait: ${explanation}`,

  nothingSent: () => "Okay, I didn't send anything.",

  unclearConfirm: (question: string) =>
    `Sorry, I didn't catch that. ${question} You can say yes or no.`,

  deliveryFailed: (person: Person, next?: Person) =>
    next
      ? `My message to ${person.name} didn't go through. Should I try ${next.name}?`
      : `My message to ${person.name} didn't go through. Please call your family on a number you know.`,

  replyDenied(person: Person): string {
    const p = pronouns(person);
    return `${person.name} says ${p.subject} did not call you, so you did the right thing by checking. Please don't send any money. Would you like help reporting this call?`;
  },

  replyConfirmed(person: Person): string {
    const p = pronouns(person);
    return `${person.name} says it was ${p.object}. Before you send anything, please call ${p.object} on the number you know and talk with ${p.object}.`;
  },

  noAnswer: (person: Person, next?: Person) =>
    next
      ? `${person.name} hasn't answered yet, and that doesn't mean something is wrong. Let's not send any money for now. Should I try ${next.name}?`
      : `${person.name} hasn't answered yet, and that doesn't mean something is wrong. Let's not send any money for now.`,

  stillWaiting: (person: Person) =>
    `I'm still waiting for ${person.name} to answer. Let's not send any money for now.`,

  noNews: () => "No news yet. I'll let you know when someone answers.",

  hangUpFirst: () => "You can hang up now. A real family member will understand.",

  dangerAtDoor: () =>
    "Don't open the door and don't hand over money. If you feel unsafe, call 911 now.",

  danger: () => "If you feel unsafe right now, please call 911.",

  sensitiveStop: () =>
    "Let me stop you there. Please don't share numbers like that with me or anyone on the phone. We don't need them.",

  callBackRefusal: (person?: Person) =>
    person
      ? `I won't call that number, because scammers control it. I can ${verb(person.channel)} ${person.name} on the number your family saved. Should I?`
      : "I won't call that number, because scammers control it. Please call your family on a number you know.",

  canIPay: (person?: Person) =>
    person
      ? `Let's not send any money yet. First, let's reach ${person.name} on a number your family saved.`
      : "Let's not send any money yet. First, call your family on a number you know.",

  passwordMatches: (person?: Person) =>
    person
      ? `That matches your family password. Even so, let's check with ${person.name} before you send any money.`
      : "That matches your family password. Even so, please check with your family before you send any money.",

  passwordNoMatch: () => "That doesn't match your family password. Please don't send any money.",

  passwordNotSet: () =>
    "Your family hasn't set a password yet. Let's check with your family directly instead.",

  passwordLocked: () => "Let's stop checking the password for now. Please don't send any money.",

  passwordRefuse: () =>
    "I can't say the family password out loud. Your family can change it on the family page.",

  thanksPaid: () => "Thank you for telling me.",

  reportNeedsCall: () => "Tell me about the call first, and I'll put a summary on the screen.",

  thankForTelling: (firstStep: string) =>
    `Thank you for telling me. Acting fast can help. ${firstStep}`,

  hotline: () =>
    "You can also call the National Elder Fraud Hotline at 833 372 8311 on weekdays for free help.",

  offerReport: () => "Would you like help reporting this call?",

  reportReady: () =>
    "I put a summary on the screen with where to report it. Nothing was sent to any agency.",

  cannotFile: (person?: Person) =>
    person
      ? `I can't file reports, but I can share the summary with ${person.name} so ${pronouns(person).subject} can help. Should I?`
      : "I can't file reports, but the summary on the screen shows where to report it.",

  backToCheck: () => "Let's get back to the call you told me about.",

  cantHelpHere: () => "I can't help with that here.",

  closing: () => "Okay. I'm here if you need me again.",
};

export type PhraseKey = keyof typeof phrases;
