/**
 * Who the caller claimed to be, in words a family reads: a relative takes the older adult's
 * name ("Ruth's grandson"), an organization stays as it is ("the IRS", "a bank").
 */
import type { Relationship } from "../ports/index";

const RELATIVES = new Set([
  "grandson",
  "granddaughter",
  "grandchild",
  "son",
  "daughter",
  "nephew",
  "niece",
]);

export function claimedIdentityWords(identity: string, olderAdultFirstName: string): string {
  return RELATIVES.has(identity) ? `${olderAdultFirstName}'s ${identity}` : identity;
}

/**
 * True when the relative asked is the person the caller claimed to be: they answer "Was it
 * you?". Anyone else is asked whether the story is true.
 */
export function claimedToBe(claimedIdentity: string | undefined, relationship: Relationship) {
  if (!claimedIdentity) return false;
  if (claimedIdentity === relationship) return true;
  return (
    claimedIdentity === "grandchild" &&
    (relationship === "grandson" || relationship === "granddaughter")
  );
}

/** The two answers on the reply page and the demo phone, as the question was asked. */
export const replyLabels = (aboutThemselves: boolean) =>
  aboutThemselves
    ? { it_was_me: "It was me", it_wasnt_me: "It wasn't me" }
    : { it_was_me: "It's true", it_wasnt_me: "It's not true" };
