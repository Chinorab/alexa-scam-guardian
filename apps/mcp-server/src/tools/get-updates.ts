/** get_updates (contracts/mcp-tools.md): replies, no answers, failed deliveries, who to try next. */
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { claimedToBe } from "@asg/core/copy/identity";
import type { Caller, Deps } from "../deps";
import { toolResult } from "../server";
import { CHECK_STATUS_URI } from "../ui/register";
import { publicMember } from "./members";
import { sweepNoAnswer } from "./replies";

/** A reply from someone asked about another person says whether the story is true. */
function aboutSomeoneElse(u: { kind: string; aboutThemselves: boolean }) {
  if (u.aboutThemselves) return undefined;
  if (u.kind === "it_wasnt_me") return "says the story is not true (asked about someone else)";
  if (u.kind === "it_was_me") return "says the story is true (asked about someone else)";
  return undefined;
}

export function registerGetUpdates(server: McpServer, deps: Deps, caller: Caller) {
  registerAppTool(
    server,
    "get_updates",
    {
      title: "Get news from family",
      description:
        "Returns replies from family members (it was me, it wasn't me), no answers after the wait time, failed messages, and who to try next. Call it when the older adult asks what's new or whether someone answered. A no answer is never a confirmation.",
      inputSchema: z.object({ checkId: z.string().max(64).optional() }),
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: CHECK_STATUS_URI } },
    },
    async ({ checkId }) => {
      await sweepNoAnswer(deps, caller.householdId);
      const now = deps.clock.now();
      const members = await deps.store.listMembers(caller.householdId);
      const nameOf = (id?: string) => members.find((m) => m.memberId === id)?.name ?? "your family";

      const events = (await deps.store.listEvents(caller.householdId, { unreadOnly: true })).filter(
        (e) => !checkId || e.checkId === checkId,
      );
      await deps.store.markEventsRead(
        caller.householdId,
        events.map((e) => e.eventId),
      );
      const claimed = new Map<string, string | undefined>();
      for (const id of new Set(events.map((e) => e.checkId))) {
        claimed.set(id, (await deps.store.getCheck(caller.householdId, id))?.claimedIdentity);
      }
      const updates = events.map((e) => {
        const member = members.find((m) => m.memberId === e.memberId);
        return {
          checkId: e.checkId,
          memberName: nameOf(e.memberId),
          kind: e.kind === "reply_received" ? (e.reply ?? "it_was_me") : e.kind,
          // False when they were asked about someone else: "it_wasnt_me" means "not true".
          aboutThemselves: member
            ? claimedToBe(claimed.get(e.checkId), member.relationship)
            : false,
          at: e.at,
        };
      });

      const checkIds = checkId
        ? [checkId]
        : (await deps.store.listChecks(caller.householdId))
            .filter((c) => c.state !== "closed")
            .map((c) => c.checkId);
      const waitingOn: { memberName: string; minutesWaiting: number }[] = [];
      const contacted = new Set<string>();
      // Told by a heads up is not asked: a trusted contact can still be asked to check.
      const asked = new Set<string>();
      let anyNoAnswer = false;
      for (const id of checkIds) {
        for (const request of await deps.store.listVerifications(caller.householdId, id)) {
          contacted.add(request.memberId);
          asked.add(request.memberId);
          if (request.noAnswerAt) anyNoAnswer = true;
          if (request.reply === "none" && request.delivery === "sent" && !request.noAnswerAt) {
            waitingOn.push({
              memberName: nameOf(request.memberId),
              minutesWaiting: Math.floor((now.getTime() - Date.parse(request.sentAt)) / 60_000),
            });
          }
        }
        for (const headsUp of await deps.store.listHeadsUps(caller.householdId, id)) {
          contacted.add(headsUp.memberId);
        }
      }

      const structured: Record<string, unknown> = { updates, waitingOn };
      const failed = updates.some((u) => u.kind === "delivery_failed");
      if (anyNoAnswer || failed) {
        const verifier = members.find((m) => !m.optedOut && !asked.has(m.memberId) && m.canVerify);
        const helper = members.find(
          (m) => !m.optedOut && !contacted.has(m.memberId) && m.getsHeadsUp,
        );
        if (verifier) structured.nextMemberToTry = { ...publicMember(verifier), role: "verify" };
        else if (helper) structured.nextMemberToTry = { ...publicMember(helper), role: "heads_up" };
      }
      const summary =
        updates.length > 0
          ? updates.map((u) => `${u.memberName}: ${aboutSomeoneElse(u) ?? u.kind}`).join("; ")
          : waitingOn.length > 0
            ? `Still waiting on ${waitingOn.map((w) => w.memberName).join(", ")}. No answer is not a confirmation.`
            : "No news.";
      return toolResult(structured, summary);
    },
  );
}
