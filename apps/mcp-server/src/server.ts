/**
 * MCP server factory (contract: specs/001-voice-scam-guardian/contracts/mcp-tools.md).
 * Stateless: a fresh McpServer per request, for protocol 2026-07-28 and 2025-11-25.
 */
import { createMcpHandler, McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { findViolations } from "@asg/core/guard/guard";
import type { Caller, Deps } from "./deps";
import { registerTools } from "./tools/index";

export const SERVER_NAME = "scam-guardian";
export const SERVER_VERSION = "0.1.0";

/** Sent with every tool result: the rules the voice assistant must follow. */
export const ASSISTANT_RULES = [
  "Never say or imply that a payment is safe, approved or fine to make.",
  "Never call, text or email the number or address that reached the user.",
  "Contact family members only through prepare_outreach and confirm_outreach, after the user's own yes.",
  "Ask the prepared question aloud and wait for the user's next answer before confirm_outreach; pass their words verbatim, never your own.",
  "Never say a message was sent unless confirm_outreach reports it sent.",
  "Never ask for or repeat card, bank or Social Security numbers. If the user starts saying one, stop them politely.",
  "Ask one question at a time. Use at most three short sentences. Never blame the user.",
  "If there is any danger, tell them to call 911 first.",
] as const;

export const INSTRUCTIONS = `Helps older adults in the United States check a suspicious call before they pay. ${ASSISTANT_RULES.join(" ")}`;

/** Builds a tool result with typed content, a short text summary and the shared rules. */
/** What a tool says instead when its own summary would approve a payment (Principle II). */
export const SAFE_SUMMARY = "Recommend not sending any money and checking with family first.";

/**
 * Tool summaries are what the assistant reads as the tool's words, so they pass the same
 * deterministic approval check as every spoken line. Fixed strings today; this keeps it so.
 */
export function guardSummary(summary: string): string {
  return findViolations(summary).includes("approval") ? SAFE_SUMMARY : summary;
}

export function toolResult(structured: Record<string, unknown>, summary: string): CallToolResult {
  return {
    content: [{ type: "text", text: guardSummary(summary) }],
    structuredContent: { ...structured, assistantRules: [...ASSISTANT_RULES] },
  };
}

/** A tool error the assistant can say as is. */
export function toolError(sentence: string): CallToolResult {
  return { content: [{ type: "text", text: sentence }], isError: true };
}

export function buildServer(deps: Deps, caller: Caller): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, deps, caller);
  return server;
}

export function callerFrom(extra: Record<string, unknown> | undefined): Caller {
  const householdId = extra?.householdId;
  const kind = extra?.kind;
  if (typeof householdId !== "string" || (kind !== "real" && kind !== "demo")) {
    throw new Error("Request reached the MCP handler without a verified household.");
  }
  return { householdId, kind };
}

export function createHandler(deps: Deps) {
  return createMcpHandler(({ authInfo }) => buildServer(deps, callerFrom(authInfo?.extra)), {
    legacy: "stateless",
    onerror: (error) =>
      deps.logger.log({ event: "error", where: "mcp_handler", code: error.name || "Error" }),
  });
}
