import type { FamilyMember, Relationship } from "@asg/core/ports/index";

/** What tools reveal about a family member: never the phone number or email. */
export interface PublicMember {
  memberId: string;
  name: string;
  relationship: Relationship;
  channel: FamilyMember["channel"];
}

export const publicMember = (m: FamilyMember): PublicMember => ({
  memberId: m.memberId,
  name: m.name,
  relationship: m.relationship,
  channel: m.channel,
});

const GRANDCHILD = /\bgrand(child|kid|baby)\b/i;

const escapeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9 ]/g, "");

/** Relatives the older adult may mean: by name or nickname first, then by relationship. */
export function matchRelatives(
  members: FamilyMember[],
  text: string,
  claimed?: Relationship,
): FamilyMember[] {
  const verifiable = members.filter((m) => m.canVerify && !m.optedOut);
  const lower = text.toLowerCase();
  const byName = verifiable.filter((m) =>
    [m.name, ...m.nicknames]
      .map(escapeName)
      .filter(Boolean)
      .some((name) => new RegExp(`\\b${name}\\b`).test(lower)),
  );
  if (byName.length > 0) return byName;
  if (claimed) return verifiable.filter((m) => m.relationship === claimed);
  if (GRANDCHILD.test(text)) {
    return verifiable.filter(
      (m) => m.relationship === "grandson" || m.relationship === "granddaughter",
    );
  }
  return [];
}

/** The trusted contact to offer a heads up to, other than the people being verified. */
export function headsUpCandidate(members: FamilyMember[], excludeIds: string[]) {
  return members.find((m) => m.getsHeadsUp && !m.optedOut && !excludeIds.includes(m.memberId));
}
