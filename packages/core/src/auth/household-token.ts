/**
 * Household tokens (research R10). The web app mints a short lived signed JWT for one
 * household; the MCP server accepts it as a bearer token. When Alexa+ account linking opens,
 * an OAuth 2.1 authorization server can issue tokens with the same claims.
 */
import { jwtVerify, SignJWT } from "jose";
import type { HouseholdKind } from "../ports/index";

export const TOKEN_AUDIENCE = "scam-guardian-mcp";
export const TOKEN_ISSUER = "scam-guardian-web";
export const TOKEN_SCOPE = "household";
const MAX_LIFETIME_SECONDS = 15 * 60;

export interface HouseholdClaims {
  householdId: string;
  kind: HouseholdKind;
}

function key(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("HOUSEHOLD_TOKEN_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function mintHouseholdToken(
  claims: HouseholdClaims,
  secret: string,
  lifetimeSeconds = MAX_LIFETIME_SECONDS,
): Promise<string> {
  return new SignJWT({ kind: claims.kind, scope: TOKEN_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.householdId)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${Math.min(lifetimeSeconds, MAX_LIFETIME_SECONDS)}s`)
    .sign(key(secret));
}

export interface VerifiedHouseholdToken extends HouseholdClaims {
  expiresAt: number;
}

/** Throws on a bad signature, wrong issuer or audience, expiry, or missing claims. */
export async function verifyHouseholdToken(
  token: string,
  secret: string,
): Promise<VerifiedHouseholdToken> {
  const { payload } = await jwtVerify(token, key(secret), {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    algorithms: ["HS256"],
  });
  const kind = payload.kind;
  if (!payload.sub || (kind !== "real" && kind !== "demo") || !payload.exp) {
    throw new Error("Household token is missing claims.");
  }
  if (payload.exp - (payload.iat ?? payload.exp) > MAX_LIFETIME_SECONDS) {
    throw new Error("Household token lives too long.");
  }
  return { householdId: payload.sub, kind, expiresAt: payload.exp };
}
