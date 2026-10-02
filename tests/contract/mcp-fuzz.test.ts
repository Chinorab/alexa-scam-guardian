/**
 * Every MCP tool against malformed input, as a confused model or a hostile client might send:
 * wrong types, missing fields, huge or control character strings, unknown ids, another
 * household's ids. Each call must end in a tool error or a safe result, never an exception,
 * and never a message sent.
 */
import { describe, expect, it } from "vitest";
import { seededSession } from "./helpers";

const TOOLS = [
  "assess_call",
  "prepare_outreach",
  "confirm_outreach",
  "get_updates",
  "check_family_password",
  "get_guidance",
  "prepare_report",
  "close_check",
];

const BAD_INPUTS: Record<string, unknown>[] = [
  {},
  { description: 42 },
  { description: "" },
  { description: "x".repeat(50_000) },
  { description: "\u0000\u0007\u001b[31m my grandson ‮ called" },
  { checkId: "chk_does_not_exist" },
  { checkId: { $ne: null } },
  { checkId: "../../etc/passwd" },
  { pendingId: "pend_unknown", userReply: "yes" },
  { pendingId: ["a"], userReply: { yes: true } },
  { checkId: "chk_x", verifyMemberId: "mem_of_another_household" },
  { checkId: "chk_x", headsUpMemberIds: Array(50).fill("mem_x") },
  { checkId: "chk_x", phraseHeard: "a".repeat(10_000) },
  { topic: "drop table", paymentMethod: "cash' or '1'='1" },
  { topic: "already_paid", paymentMethod: 7 },
];

describe("MCP tools reject malformed input cleanly", () => {
  it(`never throw and never send, across ${TOOLS.length * BAD_INPUTS.length} calls`, async () => {
    const opened = await seededSession();
    const problems: string[] = [];
    for (const tool of TOOLS) {
      for (const input of BAD_INPUTS) {
        try {
          const outcome = await opened.session.call(tool, input);
          // A tool error, or a normal result that did nothing harmful, are both fine.
          if (!outcome.isError && tool === "confirm_outreach") {
            const sent = outcome.structured?.sent;
            if (Array.isArray(sent) && sent.length > 0) problems.push(`${tool} sent a message`);
          }
        } catch (error) {
          problems.push(
            `${tool} ${JSON.stringify(input).slice(0, 60)}: ${(error as Error).message}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
    expect(await opened.deps.demoOutbox.list("hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B")).toEqual([]);
  });
});

describe("control characters", () => {
  it("are removed from the stored description", async () => {
    const opened = await seededSession();
    const rtl = String.fromCharCode(0x202e);
    const bell = String.fromCharCode(7);
    const outcome = await opened.session.call("assess_call", {
      description: `my grandson${rtl} called${bell} from jail and needs gift cards`,
    });
    const checkId = String(outcome.structured?.checkId);
    const check = await opened.deps.store.getCheck("hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B", checkId);
    expect(check?.description).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    expect(check?.description).toContain("gift cards");
  });
});
