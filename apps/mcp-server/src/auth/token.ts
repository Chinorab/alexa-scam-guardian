import { TOKEN_SCOPE, verifyHouseholdToken } from "@asg/core/auth/household-token";
import type { AuthInfo } from "@modelcontextprotocol/server";

/** Verifies the bearer token; returns AuthInfo carrying the household, or undefined. */
export async function authenticate(
  authorization: string | undefined,
  secret: string,
): Promise<AuthInfo | undefined> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return undefined;
  try {
    const verified = await verifyHouseholdToken(match[1], secret);
    return {
      token: match[1],
      clientId: "scam-guardian-web",
      scopes: [TOKEN_SCOPE],
      expiresAt: verified.expiresAt,
      extra: { householdId: verified.householdId, kind: verified.kind },
    };
  } catch {
    return undefined;
  }
}
