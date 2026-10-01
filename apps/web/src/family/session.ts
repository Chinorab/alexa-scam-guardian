/**
 * Family organizer sessions (FR-026, research R10): a signed, HttpOnly cookie holding the
 * household id. Sign in links are single use, live 15 minutes, and are stored only as hashes.
 */
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { hashToken, newReplyToken } from "@asg/core/auth/link-tokens";
import { newId } from "@asg/core/ids";
import { epochSeconds, type Household } from "@asg/core/ports/index";
import type { Deps } from "@asg/mcp-server";

export const SESSION_COOKIE = "sg_family";
const SESSION_DAYS = 7;
const LINK_SECONDS = 15 * 60;
export const SIGN_IN_LINKS_PER_HOUR = 5;

export interface FamilySessionConfig {
  secret: string;
  secure: boolean;
}

export async function readSession(
  c: Context,
  config: FamilySessionConfig,
): Promise<string | undefined> {
  const value = await getSignedCookie(c, config.secret, SESSION_COOKIE);
  if (!value) return undefined;
  const [householdId, issuedAt] = value.split("|");
  if (!householdId || !issuedAt) return undefined;
  if (Date.now() / 1000 - Number(issuedAt) > SESSION_DAYS * 86400) return undefined;
  return householdId;
}

export async function startSession(c: Context, config: FamilySessionConfig, householdId: string) {
  await setSignedCookie(
    c,
    SESSION_COOKIE,
    `${householdId}|${Math.floor(Date.now() / 1000)}`,
    config.secret,
    {
      httpOnly: true,
      sameSite: "Lax",
      secure: config.secure,
      path: "/",
      maxAge: SESSION_DAYS * 86400,
    },
  );
}

export const endSession = (c: Context) => deleteCookie(c, SESSION_COOKIE, { path: "/" });

/** Rejects cross site form posts: the Origin header, when present, must be this site. */
export function sameOrigin(webUrl: string): MiddlewareHandler {
  const allowed = new URL(webUrl).origin;
  return async (c, next) => {
    if (c.req.method === "POST") {
      const origin = c.req.header("origin");
      if (origin && origin !== allowed && origin !== new URL(c.req.url).origin) {
        return c.text("Forbidden", 403);
      }
    }
    await next();
  };
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const looksLikeEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

/**
 * Sends a sign in link. Returns the link only so local runs can show it (never in the cloud).
 * Always behaves the same whether or not the email has a household (no account discovery).
 */
export async function sendSignInLink(
  deps: Deps,
  email: string,
): Promise<{ link?: string; limited: boolean; failed?: boolean }> {
  const now = deps.clock.now();
  const count = await deps.store.incrementRate(`signin#${email}`, 3600);
  if (count > SIGN_IN_LINKS_PER_HOUR) return { limited: true };
  const { token, hash } = newReplyToken();
  await deps.store.putSignInLink({
    tokenHash: hash,
    email,
    createdAt: now.toISOString(),
    expiresAt: epochSeconds(now) + LINK_SECONDS,
  });
  const link = `${deps.webUrl}/family/sign-in/${token}`;
  try {
    await deps.mailer.send({
      to: email,
      subject: "Your Scam Guardian sign in link",
      text: [
        "Use this link to open your family page. It works once, for 15 minutes:",
        link,
        "If you did not ask for it, you can ignore this email.",
      ].join("\n"),
    });
  } catch {
    // For example SES still in sandbox mode, or a short outage. Nothing names the address.
    deps.logger.log({ event: "error", where: "sign_in_email", code: "send_failed" });
    return { limited: false, failed: true };
  }
  return { link, limited: false };
}

/** Uses a sign in link once. Creates the household on first sign in. */
export async function useSignInLink(deps: Deps, token: string): Promise<Household | undefined> {
  const link = await deps.store.takeSignInLink(hashToken(token));
  if (!link) return undefined;
  const existing = await deps.store.findHouseholdByEmail(link.email);
  if (existing) return existing;
  const now = deps.clock.now().toISOString();
  const household: Household = {
    householdId: newId("household"),
    kind: "real",
    organizerEmail: link.email,
    olderAdultFirstName: "",
    waitMinutes: 10,
    createdAt: now,
    updatedAt: now,
  };
  await deps.store.putHousehold(household);
  return household;
}
