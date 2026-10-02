/**
 * get_guidance (FR-005, FR-021): official next steps for a situation. Payment steps come from
 * the FTC and FBI dataset; help resources include the DOJ Elder Fraud Hotline (constitution V).
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { phrases } from "@asg/core/dialogue/phrases";
import { dataset, type PaidMethod, type Source } from "@asg/scam-patterns";
import { toolResult } from "../server";

const TOPICS = [
  "already_paid",
  "caller_on_line",
  "danger",
  "no_answer",
  "confirmed_real",
  "general",
] as const;
const METHODS = [
  "gift_card",
  "wire",
  "money_order",
  "money_transfer_app",
  "crypto",
  "cash_mail",
  "cash_courier",
  "bank_transfer",
  "other",
] as const;

const sourcesOf = (refs: string[]) =>
  refs
    .map((ref) => dataset.sources[ref])
    .filter((s): s is Source => s !== undefined)
    .map((s) => ({ publisher: s.publisher, label: s.label, url: s.url }));

export function guidanceFor(topic: (typeof TOPICS)[number], paymentMethod?: PaidMethod) {
  switch (topic) {
    case "already_paid": {
      const paid = dataset.ifPaid[paymentMethod ?? "other"];
      const hotline = dataset.resources.find((r) => r.id === "elder-fraud-hotline");
      return {
        steps: paid.steps,
        sources: sourcesOf(paid.sourceRefs),
        helpResources: hotline
          ? [
              {
                name: hotline.name,
                phone: hotline.phone,
                hours: hotline.hours,
                url: hotline.url,
                whenToUse: hotline.whenToUse,
              },
            ]
          : [],
      };
    }
    case "caller_on_line":
      return { steps: [phrases.hangUpFirst()], sources: [], helpResources: [] };
    case "danger":
      return { steps: [phrases.danger()], sources: [], helpResources: [] };
    case "no_answer":
      return {
        steps: ["No answer does not mean something is wrong.", phrases.waitBeforePaying()],
        sources: [],
        helpResources: [],
      };
    case "confirmed_real":
      return {
        steps: ["Before you send anything, call them on the number you know and talk with them."],
        sources: [],
        helpResources: [],
      };
    case "general": {
      const family = dataset.patterns.find((p) => p.id === "family-emergency");
      return {
        steps: family?.advice ?? [],
        sources: sourcesOf(family?.sourceRefs ?? []),
        helpResources: [],
      };
    }
  }
}

export function registerGetGuidance(server: McpServer) {
  server.registerTool(
    "get_guidance",
    {
      title: "Get official guidance",
      description:
        "Official next steps for a situation: already paid (by payment method), caller still on the line, danger, no answer, confirmed real, or general. Steps are short and speakable.",
      inputSchema: z.object({
        topic: z.enum(TOPICS),
        paymentMethod: z.enum(METHODS).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ topic, paymentMethod }) => {
      const guidance = guidanceFor(topic, paymentMethod);
      return toolResult(guidance, guidance.steps.join(" "));
    },
  );
}
