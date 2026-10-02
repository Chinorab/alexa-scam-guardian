/**
 * Family password (FR-011, data-model FamilyPassword): stored only as a scrypt hash with a
 * per household salt. It can be compared, never read back.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 32;

/** Lowercase, letters and digits only, single spaces: "Blue  River!" equals "blue river". */
export function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function hashFamilyPassword(phrase: string): Promise<{ hash: string; salt: string }> {
  const normalized = normalizePhrase(phrase);
  if (normalized.length < 3) throw new Error("The family password needs at least 3 letters.");
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalized, salt, KEY_LENGTH);
  return { hash: hash.toString("base64url"), salt: salt.toString("base64url") };
}

export async function matchesFamilyPassword(
  phrase: string,
  stored: { hash: string; salt: string },
): Promise<boolean> {
  const candidate = await scryptAsync(
    normalizePhrase(phrase),
    Buffer.from(stored.salt, "base64url"),
    KEY_LENGTH,
  );
  const expected = Buffer.from(stored.hash, "base64url");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
