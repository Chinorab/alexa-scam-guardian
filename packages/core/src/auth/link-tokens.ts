/**
 * Tokens inside message links. Reply tokens are random and stored only as a hash. Stop tokens
 * are signed, so a stop link works for every message to that person without storage.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function newReplyToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(`stop:${payload}`).digest("base64url").slice(0, 32);

export function stopToken(householdId: string, memberId: string, secret: string): string {
  const payload = Buffer.from(`${householdId}|${memberId}`).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readStopToken(
  token: string,
  secret: string,
): { householdId: string; memberId: string } | undefined {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  const [householdId, memberId] = Buffer.from(payload, "base64url").toString().split("|");
  return householdId && memberId ? { householdId, memberId } : undefined;
}
