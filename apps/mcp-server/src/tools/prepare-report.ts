/**
 * prepare_report (FR-019, FR-020): a summary the older adult or their family can file at
 * ReportFraud.ftc.gov or ic3.gov, plus the DOJ Elder Fraud Hotline. Never submitted by us.
 * Facts come from the redacted check; card, bank and Social Security numbers never appear.
 */
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listWithAnd } from "@asg/core/dialogue/phrases";
import { newId } from "@asg/core/ids";
import { assess } from "@asg/core/match/match";
import { redact } from "@asg/core/redact/redact";
import type { ReportSummary } from "@asg/core/ports/index";
import { dataset } from "@asg/scam-patterns";
import type { Caller, Deps } from "../deps";
import { toolError, toolResult } from "../server";
import { REPORT_URI } from "../ui/register";

/** Payment signs, in the words a report form expects. */
const PAYMENT_WORDS: Record<string, string> = {
  "gift-cards": "gift cards",
  "wire-transfer": "wire transfer",
  crypto: "cryptocurrency",
  "payment-app": "a payment app",
  "cash-pickup": "cash picked up in person",
};

const AMOUNT =
  /\$\s?\d[\d,]*(?:\.\d\d)?|\b(?:(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|a)\s+){1,4}dollars\b/i;

export function whatWasAsked(signIds: string[]): string | undefined {
  const ways = signIds.map((id) => PAYMENT_WORDS[id]).filter((w): w is string => w !== undefined);
  if (ways.length > 0) return `Money by ${listWithAnd(ways)}`;
  return signIds.length > 0 ? "Money or personal information" : undefined;
}

export function reportLinks() {
  const order = ["report-fraud-ftc", "ic3", "elder-fraud-hotline"];
  return order
    .map((id) => dataset.resources.find((r) => r.id === id))
    .filter((r) => r !== undefined)
    .map((r) => {
      const source = dataset.sources[r.sourceRefs[0] ?? ""];
      const link: ReportSummary["links"][number] = {
        name: r.name,
        publisher: source?.publisher ?? "FTC",
        title: r.name,
        url: r.url,
        retrievedOn: source?.retrievedOn ?? "",
        whenToUse: r.whenToUse,
      };
      if (r.phone) link.phone = r.phone;
      if (r.hours) link.hours = r.hours;
      return link;
    });
}

export function registerPrepareReport(server: McpServer, deps: Deps, caller: Caller) {
  registerAppTool(
    server,
    "prepare_report",
    {
      title: "Prepare a report summary",
      description:
        "Prepares a summary of the suspicious call and where to report it (ReportFraud.ftc.gov, ic3.gov, National Elder Fraud Hotline). It never submits anything; the older adult or their family files the report.",
      inputSchema: z.object({
        checkId: z.string().max(64),
        extraDetails: z
          .string()
          .max(1000)
          .optional()
          .describe("Anything else the older adult wants in the summary, in their words."),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: REPORT_URI } },
    },
    async ({ checkId, extraDetails }) => {
      const check = await deps.store.getCheck(caller.householdId, checkId);
      if (!check) return toolError("I could not find that call.");
      if (extraDetails) {
        const redacted = redact(extraDetails);
        check.description = `${check.description} ${redacted.text}`.trim().slice(-4000);
        if (redacted.callerNumber && !check.callerNumber)
          check.callerNumber = redacted.callerNumber;
        await deps.store.putCheck({ ...check, updatedAt: deps.clock.now().toISOString() });
      }
      const result = assess(check.description);
      const signIds = result.signs.map((s) => s.sign.id);

      const facts: ReportSummary["facts"] = {
        toldAt: check.createdAt,
        contactKind: check.contactKind,
        warningSigns: result.signs.map((s) => s.sign.label),
      };
      if (check.claimedIdentity) facts.claimedIdentity = check.claimedIdentity;
      const asked = whatWasAsked(signIds);
      if (asked) facts.whatWasAsked = asked;
      if (check.alreadyPaid) facts.paymentMethod = check.alreadyPaid.method;
      const amount = check.description.match(AMOUNT)?.[0];
      if (amount) facts.amountText = amount.trim();
      if (check.callerNumber) facts.callerNumber = check.callerNumber;

      const report: ReportSummary = {
        reportId: newId("report"),
        householdId: caller.householdId,
        checkId,
        facts,
        links: reportLinks(),
        submittedBySystem: false,
        createdAt: deps.clock.now().toISOString(),
      };
      await deps.store.putReport(report);
      return toolResult(
        { reportId: report.reportId, facts, links: report.links, submittedBySystem: false },
        "Report summary prepared. Nothing was sent to any agency.",
      );
    },
  );
}
