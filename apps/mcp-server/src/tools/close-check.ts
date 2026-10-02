/** close_check (contracts/mcp-tools.md), and the 30 minute idle rule shared with assess_call. */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Check, Clock } from "@asg/core/ports/index";
import type { Caller, Deps } from "../deps";
import { toolError, toolResult } from "../server";

export const IDLE_MINUTES = 30;

/** A check nobody touched for 30 minutes is over; new details start a new check. */
export function isIdle(check: Check, clock: Clock): boolean {
  return clock.now().getTime() - Date.parse(check.updatedAt) > IDLE_MINUTES * 60_000;
}

export function closed(check: Check, clock: Clock): Check {
  const at = clock.now().toISOString();
  return { ...check, state: "closed", closedAt: at, updatedAt: at };
}

export function registerCloseCheck(server: McpServer, deps: Deps, caller: Caller) {
  server.registerTool(
    "close_check",
    {
      title: "Close a check",
      description:
        "Closes a check when the older adult is done. Messages already sent still get their replies.",
      inputSchema: z.object({ checkId: z.string().max(64) }),
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ checkId }) => {
      const check = await deps.store.getCheck(caller.householdId, checkId);
      if (!check) return toolError("I could not find that check.");
      if (check.state !== "closed") await deps.store.putCheck(closed(check, deps.clock));
      return toolResult({ closed: true, checkId }, "Check closed.");
    },
  );
}
