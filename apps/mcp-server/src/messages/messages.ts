/**
 * Message templates (FR-008, FR-015). Plain words, no dashes, no sensitive numbers, never the
 * older adult's own words: only the claimed identity and the warning sign labels.
 */
import { listWithAnd } from "@asg/core/dialogue/phrases";
import type { Check, FamilyMember, Household } from "@asg/core/ports/index";

export const PRODUCT_NAME = "Scam Guardian";

export interface Rendered {
  subject: string;
  text: string;
}

/** "you" when the relative is the one the caller claimed to be, otherwise a description. */
function whoCallerClaimed(check: Check, member: FamilyMember, household: Household): string {
  const claimed = check.claimedIdentity;
  const isGrandchild =
    member.relationship === "grandson" || member.relationship === "granddaughter";
  if (claimed && (claimed === member.relationship || (claimed === "grandchild" && isGrandchild))) {
    return "you";
  }
  if (check.claimedIdentity) return `${household.olderAdultFirstName}'s ${check.claimedIdentity}`;
  return "a family member";
}

/** "a call", "a text", "an email", "a voicemail". */
const aContact = (check: Check) =>
  `${check.contactKind === "email" ? "an" : "a"} ${check.contactKind}`;

function timeOf(check: Check): string {
  return new Date(check.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

export function checkMessage(args: {
  household: Household;
  member: FamilyMember;
  check: Check;
  replyUrl: string;
  stopUrl: string;
}): Rendered {
  const older = args.household.olderAdultFirstName;
  const claimed = whoCallerClaimed(args.check, args.member, args.household);
  const isThem = claimed === "you";
  const subject = isThem ? `Did you just call ${older}?` : `Can you help ${older} check a call?`;
  const text = [
    `Hi ${args.member.name}, this is ${PRODUCT_NAME} for ${older}.`,
    `${older} just got ${aContact(args.check)} from someone saying they were ${claimed}, asking for money.`,
    isThem ? "Was it you? Please answer here:" : `Do you know if this is true? Please answer here:`,
    args.replyUrl,
    `Please also call ${older} on the number you know.`,
    `To stop all messages from ${PRODUCT_NAME}: ${args.stopUrl}`,
  ].join("\n");
  return { subject, text };
}

export function headsUpMessage(args: {
  household: Household;
  member: FamilyMember;
  check: Check;
  signLabels: string[];
  stopUrl: string;
  /** The family page, where the check and any report summary can be read. */
  detailsUrl: string;
}): Rendered {
  const older = args.household.olderAdultFirstName;
  const claimed = args.check.claimedIdentity
    ? `someone saying they were ${older}'s ${args.check.claimedIdentity}`
    : "someone they did not know";
  const signs =
    args.signLabels.length > 0
      ? `Warning signs: ${listWithAnd(args.signLabels.map((label) => `the ${label}`))}.`
      : "No common warning signs were found.";
  const text = [
    `Hi ${args.member.name}, this is ${PRODUCT_NAME} for ${older}.`,
    `${older} got a suspicious ${args.check.contactKind} at ${timeOf(args.check)} from ${claimed}.`,
    signs,
    `We advised ${older} not to send any money and to check with family first.`,
    `Please give ${older} a call when you can.`,
    `Details and any report summary are on the family page: ${args.detailsUrl}`,
    `To stop all messages from ${PRODUCT_NAME}: ${args.stopUrl}`,
  ].join("\n");
  return { subject: `${older} got a suspicious ${args.check.contactKind}`, text };
}
