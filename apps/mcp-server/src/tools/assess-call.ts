/**
 * assess_call (contracts/mcp-tools.md): describe or add to a suspicious contact.
 * Redacts first, matches the official dataset, finds saved relatives, and tells the assistant
 * the next step. Never returns phone numbers or emails.
 */
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { epochSeconds, type Check } from "@asg/core/ports/index";
import { newId } from "@asg/core/ids";
import { assess } from "@asg/core/match/match";
import { redact } from "@asg/core/redact/redact";
import type { Caller, Deps } from "../deps";
import { toolError, toolResult } from "../server";
import { WARNING_SIGNS_URI } from "../ui/register";
import { closed, isIdle } from "./close-check";
import { headsUpCandidate, matchRelatives, publicMember } from "./members";

const CHECK_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_DESCRIPTION = 4000;

export type NextStep =
  | "call_911"
  | "hang_up_first"
  | "paid_guidance"
  | "no_signs_found"
  | "pick_member"
  | "offer_verify"
  | "offer_heads_up"
  | "advise_wait";

const input = z.object({
  description: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "What the older adult said about the call, text, email or voicemail, in their words.",
    ),
  checkId: z
    .string()
    .max(64)
    .optional()
    .describe("The check to add details to, from an earlier call."),
});

function nextStepFor(
  result: ReturnType<typeof assess>,
  relatives: number,
  hasHelper: boolean,
): NextStep {
  if (result.danger) return "call_911";
  if (result.callerOnLine) return "hang_up_first";
  if (result.alreadyPaid) return "paid_guidance";
  if (result.signs.length === 0) return "no_signs_found";
  if (relatives > 1) return "pick_member";
  if (relatives === 1) return "offer_verify";
  return hasHelper ? "offer_heads_up" : "advise_wait";
}

export function registerAssessCall(server: McpServer, deps: Deps, caller: Caller) {
  registerAppTool(
    server,
    "assess_call",
    {
      title: "Check a suspicious call",
      description:
        "Finds warning signs from official FTC and FBI alerts in what the older adult describes, finds the saved family members they may mean, and returns the next step. Call it whenever they describe a call, text, email or voicemail, or add details.",
      inputSchema: input,
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: WARNING_SIGNS_URI } },
    },
    async ({ description, checkId }) => {
      const started = Date.now();
      const now = deps.clock.now();
      // Control and direction override characters never reach storage or the family page.
      const redacted = redact(description.replace(/[\p{Cc}\p{Cf}]+/gu, " "));

      let check: Check | undefined;
      if (checkId) {
        check = await deps.store.getCheck(caller.householdId, checkId);
        if (!check) return toolError("I could not find that check. Let's start again.");
        if (check.state === "closed" || isIdle(check, deps.clock)) {
          if (check.state !== "closed") await deps.store.putCheck(closed(check, deps.clock));
          check = undefined;
        }
      }
      check ??= {
        checkId: newId("check"),
        householdId: caller.householdId,
        state: "open",
        description: "",
        contactKind: "call",
        matchedSigns: [],
        danger: false,
        passwordAttempts: 0,
        outcome: "unknown",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: epochSeconds(now) + CHECK_TTL_SECONDS,
      };
      check.description = `${check.description} ${redacted.text}`.trim().slice(-MAX_DESCRIPTION);
      if (redacted.callerNumber && !check.callerNumber) check.callerNumber = redacted.callerNumber;

      const result = assess(check.description);
      const members = await deps.store.listMembers(caller.householdId);
      const relatives = matchRelatives(members, check.description, result.claimedRelationship);
      const helper = headsUpCandidate(
        members,
        relatives.map((m) => m.memberId),
      );
      const nextStep = nextStepFor(result, relatives.length, helper !== undefined);

      check.state = "assessed";
      check.updatedAt = now.toISOString();
      check.contactKind = result.contactKind;
      check.danger ||= result.danger;
      check.matchedSigns = result.signs.map(({ sign }) => ({
        signId: sign.id,
        patternId: result.pattern?.id ?? "",
      }));
      if (result.claimedIdentity) check.claimedIdentity = result.claimedIdentity;
      if (result.alreadyPaid) check.alreadyPaid = result.alreadyPaid;
      await deps.store.putCheck(check);

      const structured: Record<string, unknown> = {
        checkId: check.checkId,
        matchedSigns: result.signs.map(({ sign, sources }) => ({
          id: sign.id,
          label: sign.label,
          explanation: sign.explanation,
          source: sources[0]
            ? { publisher: sources[0].publisher, label: sources[0].label, url: sources[0].url }
            : undefined,
        })),
        danger: result.danger,
        nextStep,
        familyMatches: relatives.map(publicMember),
        contactKind: result.contactKind,
        // Nobody saved yet: the assistant suggests setting up the family page.
        familySaved: members.some((m) => !m.optedOut),
        sensitiveDataRemoved: redacted.removed,
        interrupt: redacted.removed,
      };
      if (result.pattern) {
        structured.pattern = { id: result.pattern.id, name: result.pattern.name };
        structured.advice = result.pattern.advice;
      }
      if (result.claimedIdentity) structured.claimedIdentity = result.claimedIdentity;
      if (helper) structured.headsUpCandidate = publicMember(helper);
      if (result.alreadyPaid) structured.alreadyPaid = result.alreadyPaid;

      deps.logger.log({
        event: "tool_call",
        tool: "assess_call",
        ok: true,
        durationMs: Date.now() - started,
      });
      const summary =
        result.signs.length === 0
          ? "No common warning signs found. Still recommend checking with the person directly before any payment."
          : `Warning signs: ${result.signs.map(({ sign }) => sign.label).join(", ")}. Next step: ${nextStep}.`;
      return toolResult(structured, summary);
    },
  );
}
