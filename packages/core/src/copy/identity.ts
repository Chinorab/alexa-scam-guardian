/**
 * Who the caller claimed to be, in words a family reads: a relative takes the older adult's
 * name ("Ruth's grandson"), an organization stays as it is ("the IRS", "a bank").
 */
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
