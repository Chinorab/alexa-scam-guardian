/**
 * prepare_outreach and confirm_outreach (FR-006, FR-012, FR-013, research R5).
 * Two steps on purpose: the first only builds the question; the second sends only when the
 * older adult's own words parse as an explicit yes. Recipients are member ids, never addresses.
 */
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { newReplyToken, stopToken } from "@asg/core/auth/link-tokens";
import { parseConfirmation } from "@asg/core/confirm/confirm";
import { phrases } from "@asg/core/dialogue/phrases";
import { dataset } from "@asg/scam-patterns";
import { newId } from "@asg/core/ids";
import { epochSeconds, type FamilyMember } from "@asg/core/ports/index";
import type { Caller, Deps } from "../deps";
import { checkMessage, headsUpMessage } from "../messages/messages";
import { toolError, toolResult } from "../server";
import { CHECK_STATUS_URI } from "../ui/register";
import { deliver } from "./delivery";
import { whatWasAsked } from "./prepare-report";

const withAsked = (asked: string | undefined) => (asked ? { asked } : {});

const PENDING_SECONDS = 120;
const REPLY_LINK_SECONDS = 24 * 60 * 60;
export const OUTREACH_LIMIT_PER_HOUR = 10;

const prepareInput = z.object({
  checkId: z.string().max(64),
  verifyMemberId: z
    .string()
    .max(64)
    .optional()
    .describe("The saved family member to ask whether they really called."),
  headsUpMemberIds: z
    .array(z.string().max(64))
    .max(2)
    .optional()
    .describe("Saved trusted contacts to tell that a suspicious call happened."),
});

const confirmInput = z.object({
  pendingId: z.string().max(64),
  userReply: z
    .string()
    .max(500)
    .describe("The older adult's own answer to the question, word for word."),
});

const labelOf = (signId: string) => dataset.warningSigns.find((s) => s.id === signId)?.label;

export function registerOutreach(server: McpServer, deps: Deps, caller: Caller) {
  server.registerTool(
    "prepare_outreach",
    {
      title: "Prepare a message to family",
      description:
        "Builds the exact yes or no question to ask before contacting saved family members. Sends nothing. Ask the returned question word for word, then pass the answer to confirm_outreach.",
      inputSchema: prepareInput,
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ checkId, verifyMemberId, headsUpMemberIds = [] }) => {
      const check = await deps.store.getCheck(caller.householdId, checkId);
      if (!check || check.state === "closed") return toolError("That check is no longer open.");
      if (!verifyMemberId && headsUpMemberIds.length === 0) {
        return toolError("Choose who to contact first.");
      }

      const load = async (memberId: string) => deps.store.getMember(caller.householdId, memberId);
      let verify: FamilyMember | undefined;
      if (verifyMemberId) {
        verify = await load(verifyMemberId);
        if (!verify || verify.optedOut || !verify.canVerify) {
          return toolError("I can only check with people your family saved for that.");
        }
      }
      const helpers: FamilyMember[] = [];
      for (const id of headsUpMemberIds) {
        const helper = await load(id);
        if (
          !helper ||
          helper.optedOut ||
          !helper.getsHeadsUp ||
          helper.memberId === verify?.memberId
        ) {
          return toolError("I can only tell people your family saved for that.");
        }
        helpers.push(helper);
      }

      const question = verify
        ? phrases.offerVerify(verify, helpers, check.contactKind)
        : phrases.offerHeadsUp(helpers, check.contactKind);
      const now = deps.clock.now();
      const pendingId = newId("pending");
      await deps.store.putPending({
        pendingId,
        householdId: caller.householdId,
        checkId,
        verifyMemberIds: verify ? [verify.memberId] : [],
        headsUpMemberIds: helpers.map((h) => h.memberId),
        question,
        expiresAt: epochSeconds(now) + PENDING_SECONDS,
      });
      await deps.store.putCheck({
        ...check,
        state: "awaiting_confirmation",
        updatedAt: now.toISOString(),
      });
      return toolResult(
        {
          pendingId,
          question,
          expiresAt: new Date((epochSeconds(now) + PENDING_SECONDS) * 1000).toISOString(),
        },
        `Ask exactly: ${question}`,
      );
    },
  );

  registerAppTool(
    server,
    "confirm_outreach",
    {
      title: "Send the message to family",
      description:
        "Sends what prepare_outreach prepared, only if the older adult's own reply is an explicit yes. Pass their words verbatim. A no, an unclear answer or silence sends nothing.",
      inputSchema: confirmInput,
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: CHECK_STATUS_URI } },
    },
    async ({ pendingId, userReply }) => {
      const nothing = (reason: string, summary: string) =>
        toolResult({ sent: [], nothingSent: true, reason }, summary);

      const pending = await deps.store.getPending(caller.householdId, pendingId);
      if (!pending) return nothing("expired", "Nothing was sent. The question expired; ask again.");
      const household = await deps.store.getHousehold(caller.householdId);
      const check = await deps.store.getCheck(caller.householdId, pending.checkId);
      if (!household || !check) return nothing("expired", "Nothing was sent.");

      const ids = [...pending.verifyMemberIds, ...pending.headsUpMemberIds];
      const members = (
        await Promise.all(ids.map((id) => deps.store.getMember(caller.householdId, id)))
      ).filter((m): m is FamilyMember => m !== undefined && !m.optedOut);
      const answer = parseConfirmation(userReply, members);
      if (answer.kind === "unclear") {
        return nothing("unclear", "Nothing was sent. The answer was not a clear yes; ask again.");
      }
      await deps.store.deletePending(caller.householdId, pendingId);
      if (answer.kind === "no") return nothing("declined", "Nothing was sent. They said no.");

      const chosen = members.filter((m) => answer.memberIds.includes(m.memberId));
      const now = deps.clock.now();
      const sent: {
        memberId: string;
        name: string;
        kind: "verify" | "heads_up";
        delivery: string;
      }[] = [];
      let limited = false;

      for (const member of chosen) {
        const count = await deps.store.incrementRate(`outreach#${caller.householdId}`, 3600);
        if (count > OUTREACH_LIMIT_PER_HOUR) {
          limited = true;
          break;
        }
        const stopUrl = `${deps.webUrl}/stop/${stopToken(caller.householdId, member.memberId, deps.tokenSecret)}`;
        if (pending.verifyMemberIds.includes(member.memberId)) {
          const { token, hash } = newReplyToken();
          const message = checkMessage({
            household,
            member,
            check,
            replyUrl: `${deps.webUrl}/r/${token}`,
            stopUrl,
          });
          const delivery = await deliver(deps, household, member, message);
          await deps.store.putVerification({
            requestId: newId("request"),
            householdId: caller.householdId,
            checkId: check.checkId,
            memberId: member.memberId,
            channel: member.channel,
            sentAt: now.toISOString(),
            delivery,
            reply: "none",
            replyTokenHash: hash,
            replyExpiresAt: epochSeconds(now) + REPLY_LINK_SECONDS,
          });
          if (delivery === "failed") {
            await deps.store.putEvent({
              eventId: newId("event"),
              householdId: caller.householdId,
              checkId: check.checkId,
              kind: "delivery_failed",
              memberId: member.memberId,
              at: now.toISOString(),
              read: false,
            });
          }
          sent.push({ memberId: member.memberId, name: member.name, kind: "verify", delivery });
        } else {
          const labels = check.matchedSigns
            .map((s) => labelOf(s.signId))
            .filter((l): l is string => l !== undefined && l !== "family member asking for money")
            .slice(0, 3);
          const message = headsUpMessage({
            household,
            member,
            check,
            signLabels: labels,
            stopUrl,
            detailsUrl: `${deps.webUrl}/family/activity`,
            ...withAsked(whatWasAsked(check.matchedSigns.map((s) => s.signId))),
          });
          const delivery = await deliver(deps, household, member, message);
          await deps.store.putHeadsUp({
            headsUpId: newId("headsUp"),
            householdId: caller.householdId,
            checkId: check.checkId,
            memberId: member.memberId,
            channel: member.channel,
            sentAt: now.toISOString(),
            delivery,
          });
          sent.push({ memberId: member.memberId, name: member.name, kind: "heads_up", delivery });
        }
      }

      const verifying = sent.some((s) => s.kind === "verify" && s.delivery === "sent");
      await deps.store.putCheck({
        ...check,
        state: verifying ? "waiting_for_reply" : "assessed",
        updatedAt: now.toISOString(),
      });
      deps.logger.log({
        event: "outreach",
        sent: sent.filter((s) => s.delivery === "sent").length,
        failed: sent.filter((s) => s.delivery === "failed").length,
        checkId: check.checkId,
      });
      if (sent.length === 0 && limited) {
        return nothing("rate_limited", "Nothing was sent. Too many messages this hour.");
      }
      const result: Record<string, unknown> = { sent, nothingSent: sent.length === 0 };
      if (limited) result.reason = "rate_limited";
      return toolResult(
        result,
        `Sent to ${sent.map((s) => `${s.name} (${s.kind}, ${s.delivery})`).join(", ")}.`,
      );
    },
  );
}
