/**
 * Relative replies and the no answer rule (FR-009, FR-010). Shared by get_updates, the web
 * reply page (/r/:token) and the Echo's event polling, so every path applies the same rules.
 */
import { hashToken } from "@asg/core/auth/link-tokens";
import { newId } from "@asg/core/ids";
import { epochSeconds, type Check, type Reply } from "@asg/core/ports/index";
import type { Deps } from "../deps";

export type RecordReplyResult =
  | { ok: true; olderAdultFirstName: string; memberName: string; reply: Reply }
  | { ok: false; reason: "unknown" | "expired" | "already_answered" };

/** Records the relative's one tap answer. Only the first answer counts. */
export async function recordReply(
  deps: Deps,
  token: string,
  reply: "it_was_me" | "it_wasnt_me",
): Promise<RecordReplyResult> {
  const request = await deps.store.findVerificationByToken(hashToken(token));
  if (!request) return { ok: false, reason: "unknown" };
  const now = deps.clock.now();
  if (request.replyExpiresAt < epochSeconds(now)) return { ok: false, reason: "expired" };
  if (request.reply !== "none") return { ok: false, reason: "already_answered" };

  const [household, member, check] = await Promise.all([
    deps.store.getHousehold(request.householdId),
    deps.store.getMember(request.householdId, request.memberId),
    deps.store.getCheck(request.householdId, request.checkId),
  ]);
  if (!household || !member) return { ok: false, reason: "unknown" };

  await deps.store.putVerification({ ...request, reply, repliedAt: now.toISOString() });
  if (check) {
    await deps.store.putCheck({
      ...check,
      state: check.state === "closed" ? "closed" : "resolved",
      outcome: reply === "it_wasnt_me" ? "not_from_them" : "confirmed_by_them",
      updatedAt: now.toISOString(),
    });
  }
  await deps.store.putEvent({
    eventId: newId("event"),
    householdId: request.householdId,
    checkId: request.checkId,
    kind: "reply_received",
    memberId: request.memberId,
    reply,
    at: now.toISOString(),
    read: false,
  });
  deps.logger.log({ event: "reply", reply, checkId: request.checkId });
  return {
    ok: true,
    olderAdultFirstName: household.olderAdultFirstName,
    memberName: member.name,
    reply,
  };
}

/**
 * Turns silence into "no answer" once the household wait time has passed. Never a
 * confirmation: the outcome only becomes no_answer when nothing better is known.
 */
export async function sweepNoAnswer(deps: Deps, householdId: string): Promise<void> {
  const household = await deps.store.getHousehold(householdId);
  if (!household) return;
  const now = deps.clock.now();
  const waitMs = household.waitMinutes * 60_000;
  const checks = await deps.store.listChecks(householdId);

  for (const check of checks) {
    if (check.state !== "waiting_for_reply") continue;
    const requests = await deps.store.listVerifications(householdId, check.checkId);
    let changed = false;
    for (const request of requests) {
      const silent = request.reply === "none" && request.delivery === "sent" && !request.noAnswerAt;
      if (!silent || now.getTime() - Date.parse(request.sentAt) < waitMs) continue;
      await deps.store.putVerification({ ...request, noAnswerAt: now.toISOString() });
      await deps.store.putEvent({
        eventId: newId("event"),
        householdId,
        checkId: check.checkId,
        kind: "no_answer",
        memberId: request.memberId,
        at: now.toISOString(),
        read: false,
      });
      changed = true;
    }
    if (changed) {
      const updated: Check = { ...check, state: "no_answer", updatedAt: now.toISOString() };
      if (check.outcome === "unknown") updated.outcome = "no_answer";
      await deps.store.putCheck(updated);
    }
  }
}

/** Unread news for the Echo's light ring (after applying the no answer rule). */
export async function unreadCount(deps: Deps, householdId: string): Promise<number> {
  await sweepNoAnswer(deps, householdId);
  return (await deps.store.listEvents(householdId, { unreadOnly: true })).length;
}

export type ReplyLinkState =
  | { status: "open" | "answered"; olderAdultFirstName: string; memberName: string; reply: Reply }
  | { status: "unknown" | "expired" };

/** What the reply page shows. Reads only: link scanners open links, so GET never records. */
export async function describeReplyLink(deps: Deps, token: string): Promise<ReplyLinkState> {
  const request = await deps.store.findVerificationByToken(hashToken(token));
  if (!request) return { status: "unknown" };
  if (request.replyExpiresAt < epochSeconds(deps.clock.now())) return { status: "expired" };
  const [household, member] = await Promise.all([
    deps.store.getHousehold(request.householdId),
    deps.store.getMember(request.householdId, request.memberId),
  ]);
  if (!household || !member) return { status: "unknown" };
  return {
    status: request.reply === "none" ? "open" : "answered",
    olderAdultFirstName: household.olderAdultFirstName,
    memberName: member.name,
    reply: request.reply,
  };
}
