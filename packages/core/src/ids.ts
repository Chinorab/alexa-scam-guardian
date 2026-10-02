import { ulid } from "ulid";

/** Prefixed, sortable ids. The prefix tells what an id points to when it shows up in logs. */
export const ID_PREFIXES = {
  household: "hh",
  member: "mem",
  check: "chk",
  pending: "pend",
  request: "ver",
  headsUp: "hup",
  report: "rep",
  event: "evt",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

export const newId = (kind: IdKind): string => `${ID_PREFIXES[kind]}_${ulid()}`;
