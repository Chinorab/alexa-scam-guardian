/** get_updates (contracts/mcp-tools.md): replies, no answers, failed deliveries, who to try next. */
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { FamilyMember } from "@asg/core/ports/index";
import type { Caller, Deps } from "../deps";
import { toolResult } from "../server";
import { CHECK_STATUS_URI } from "../ui/register";
import { publicMember } from "./members";
import { sweepNoAnswer } from "./replies";

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
      const updates = events.map((e) => ({
        checkId: e.checkId,
        memberName: nameOf(e.memberId),
        kind: e.kind === "reply_received" ? (e.reply ?? "it_was_me") : e.kind,
        at: e.at,
      }));

      const checkIds = checkId
        ? [checkId]
        : (await deps.store.listChecks(caller.householdId))
            .filter((c) => c.state !== "closed")
            .map((c) => c.checkId);
      const waitingOn: { memberName: string; minutesWaiting: number }[] = [];
      const contacted = new Set<string>();
      let anyNoAnswer = false;
      for (const id of checkIds) {
        for (const request of await deps.store.listVerifications(caller.householdId, id)) {
          contacted.add(request.memberId);
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
        const available = (m: FamilyMember) => !m.optedOut && !contacted.has(m.memberId);
        const next =
          members.find((m) => available(m) && m.canVerify) ??
          members.find((m) => available(m) && m.getsHeadsUp);
        if (next) structured.nextMemberToTry = publicMember(next);
      }
      const summary =
        updates.length > 0
          ? updates.map((u) => `${u.memberName}: ${u.kind}`).join("; ")
          : waitingOn.length > 0
            ? `Still waiting on ${waitingOn.map((w) => w.memberName).join(", ")}. No answer is not a confirmation.`
            : "No news.";
      return toolResult(structured, summary);
    },
  );
}
