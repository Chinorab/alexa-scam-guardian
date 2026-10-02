/**
 * Deterministic reading of the older adult's answer to an outreach question (FR-012, FR-013).
 * Only an explicit yes sends anything. Naming people narrows the list; ruling someone out
 * removes them. Anything unclear sends nothing.
 */

export interface Recipient {
  memberId: string;
  name: string;
  nicknames: string[];
}

export type Confirmation =
  | { kind: "yes"; memberIds: string[] }
  | { kind: "subset"; memberIds: string[] }
  | { kind: "no" }
  | { kind: "unclear" };

const YES =
  /\b(yes|yeah|yep|yup|sure|ok|okay|alright|all right|please do|please|go ahead|do it|do that|correct|that'?s right|sounds good|of course|definitely|absolutely|certainly|uh huh|mm hmm|you bet)\b/;
const NO =
  /\b(no|nope|nah|don'?t|do not|stop|cancel|wait|hold on|not now|not yet|rather not|never ?mind|nevermind|forget it|no thanks)\b/;
const NARROW = /\b(just|only)\b/;
/** Hesitation is never consent: "not sure", "maybe", "I guess" send nothing. */
const HESITANT =
  /\b(not sure|unsure|don'?t know|do not know|maybe|perhaps|i guess|not really|i think so|probably|let me think)\b/;
const EXCLUDE_WORDS = "(not|don'?t (tell|text|email|message|contact)|without|except|but not)";
const EXCLUDE_BEFORE_NAME = new RegExp(`\\b${EXCLUDE_WORDS}\\s+$`);

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function namesOf(recipient: Recipient): string[] {
  return [recipient.name, ...recipient.nicknames].map(normalize).filter(Boolean);
}

interface Mention {
  memberId: string;
  excluded: boolean;
}

function findMentions(reply: string, recipients: Recipient[]): Mention[] {
  const mentions: Mention[] = [];
  for (const recipient of recipients) {
    for (const name of namesOf(recipient)) {
      const match = new RegExp(`\\b${name}\\b`).exec(reply);
      if (!match) continue;
      const before = reply.slice(0, match.index);
      mentions.push({ memberId: recipient.memberId, excluded: EXCLUDE_BEFORE_NAME.test(before) });
      break;
    }
  }
  return mentions;
}

/** Removes the words that rule someone out, so "don't tell Sarah" is not read as a plain no. */
function withoutExclusions(reply: string, recipients: Recipient[]): string {
  let text = reply;
  for (const name of recipients.flatMap(namesOf)) {
    text = text.replace(new RegExp(`\\b${EXCLUDE_WORDS}\\s+${name}\\b`, "g"), " ");
  }
  return text;
}

export function parseConfirmation(rawReply: string, recipients: Recipient[]): Confirmation {
  const reply = normalize(rawReply);
  if (!reply) return { kind: "unclear" };

  const mentions = findMentions(reply, recipients);
  const excluded = new Set(mentions.filter((m) => m.excluded).map((m) => m.memberId));
  const included = mentions.filter((m) => !m.excluded).map((m) => m.memberId);
  const rest = withoutExclusions(reply, recipients);

  if (HESITANT.test(rest)) return { kind: "unclear" };
  const narrows = NARROW.test(reply) && included.length > 0;
  const saysYes = YES.test(rest);
  const saysNo = NO.test(rest);

  if (narrows) return { kind: "subset", memberIds: included };
  if (saysNo) return { kind: "no" };
  if (!saysYes) return { kind: "unclear" };

  const everyone = recipients.map((r) => r.memberId);
  let chosen = included.length > 0 ? included : everyone;
  chosen = chosen.filter((id) => !excluded.has(id));
  if (chosen.length === 0) return { kind: "no" };
  if (chosen.length === everyone.length) return { kind: "yes", memberIds: everyone };
  return { kind: "subset", memberIds: chosen };
}
