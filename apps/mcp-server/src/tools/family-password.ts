/**
 * check_family_password (FR-011): compares a phrase the caller said with the family password.
 * Answers only matches, does_not_match, not_set or locked. Never returns or hints at the
 * stored phrase. Three wrong attempts lock it for that check, and at most ten checks of the
 * password run per household per hour, so new checks cannot be opened to keep guessing.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { matchesFamilyPassword } from "@asg/core/auth/family-password";
import type { Caller, Deps } from "../deps";
import { toolError, toolResult } from "../server";

export const MAX_PASSWORD_ATTEMPTS = 3;
export const PASSWORD_CHECKS_PER_HOUR = 10;

export function registerFamilyPassword(server: McpServer, deps: Deps, caller: Caller) {
  server.registerTool(
    "check_family_password",
    {
      title: "Check the family password",
      description:
        "Checks whether the phrase the caller gave matches the family password. Returns only matches, does_not_match, not_set or locked. Never say the phrase back. Even a match is not a reason to pay; still check with the family.",
      inputSchema: z.object({
        checkId: z.string().max(64),
        phraseHeard: z.string().min(1).max(100).describe("What the caller said the password was."),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ checkId, phraseHeard }) => {
      const check = await deps.store.getCheck(caller.householdId, checkId);
      if (!check) return toolError("I could not find that check.");
      if (check.passwordAttempts >= MAX_PASSWORD_ATTEMPTS) {
        return toolResult({ result: "locked" }, "Password checks are locked for this call.");
      }
      const stored = await deps.store.getPassword(caller.householdId);
      if (!stored) return toolResult({ result: "not_set" }, "No family password is set.");
      const hourly = await deps.store.incrementRate(`password#${caller.householdId}`, 3600);
      if (hourly > PASSWORD_CHECKS_PER_HOUR) {
        return toolResult({ result: "locked" }, "Password checks are locked for now.");
      }

      if (await matchesFamilyPassword(phraseHeard, stored)) {
        return toolResult(
          { result: "matches" },
          "It matches. Still recommend checking with the family before any payment.",
        );
      }
      await deps.store.putCheck({
        ...check,
        passwordAttempts: check.passwordAttempts + 1,
        updatedAt: deps.clock.now().toISOString(),
      });
      return toolResult({ result: "does_not_match" }, "It does not match. Recommend not paying.");
    },
  );
}
