/**
 * One conversation turn (FR-017, FR-036, research R5).
 * 1. Redact. A sensitive number stops the turn with the fixed stop line; nothing goes further.
 * 2. Full mode: Bedrock with the MCP tools, 3 second deadline.
 * 3. Otherwise, or on failure: simplified mode over the same MCP tools.
 * 4. Every line passes the output guard before it is spoken.
 */
import type { Message } from "@aws-sdk/client-bedrock-runtime";
import {
  simplifiedTurn,
  type AssessCallResult,
  type ConfirmResult,
  type EngineTools,
  type PasswordResult,
  type PrepareResult,
  type UpdatesResult,
} from "@asg/core/dialogue/engine";
import { phrases } from "@asg/core/dialogue/phrases";
import { guardLine } from "@asg/core/guard/guard";
import type { Logger } from "@asg/core/log/logger";
import { redact, startsSensitiveNumber } from "@asg/core/redact/redact";
import type { DeviceSession } from "../device/sessions";
import { runAgentTurn, type ConverseFn } from "./bedrock-agent";
import type { McpSession, ToolCallOutcome } from "./mcp-client";
import { systemPrompt } from "./prompt";

export interface TurnDeps {
  mode: "full" | "simplified";
  modelId: string;
  converse?: ConverseFn;
  openSession: (device: DeviceSession) => Promise<McpSession>;
  logger: Logger;
  deadlineMs?: number;
}

/** A screen card: an MCP Apps view (loaded by the Echo through /frame) and its tool result. */
export interface Card {
  tool: string;
  uri: string;
  data: Record<string, unknown>;
}

export interface TurnResult {
  say: string;
  rate: "normal" | "slow";
  mode: "full" | "simplified";
  cards: Card[];
  expectReply: boolean;
}

const HISTORY_LIMIT = 20;

/** The simplified mode's port, backed by the real MCP tools. */
export function engineTools(session: McpSession): EngineTools {
  const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const outcome = await session.call(name, args);
    if (outcome.isError || !outcome.structured) throw new Error(`${name} failed`);
    return outcome.structured as unknown as T;
  };
  return {
    assessCall: (description, checkId) =>
      call<AssessCallResult>("assess_call", checkId ? { description, checkId } : { description }),
    prepareOutreach: (checkId, verifyMemberId, headsUpMemberIds) => {
      const args: Record<string, unknown> = { checkId };
      if (verifyMemberId) args.verifyMemberId = verifyMemberId;
      if (headsUpMemberIds?.length) args.headsUpMemberIds = headsUpMemberIds;
      return call<PrepareResult>("prepare_outreach", args);
    },
    confirmOutreach: (pendingId, userReply) =>
      call<ConfirmResult>("confirm_outreach", { pendingId, userReply }),
    getUpdates: (checkId) => call<UpdatesResult>("get_updates", checkId ? { checkId } : {}),
    checkFamilyPassword: async (checkId, phraseHeard) =>
      (await call<{ result: PasswordResult }>("check_family_password", { checkId, phraseHeard }))
        .result,
  };
}

function cardsFrom(calls: { name: string; outcome: ToolCallOutcome }[]): Card[] {
  return calls.flatMap(({ name, outcome }) =>
    outcome.uiResourceUri && outcome.structured
      ? [{ tool: name, uri: outcome.uiResourceUri, data: outcome.structured }]
      : [],
  );
}

/** Records tool calls made by the engine so their cards can be shown. */
function recordingSession(
  session: McpSession,
  calls: { name: string; outcome: ToolCallOutcome }[],
) {
  return {
    ...session,
    async call(name: string, args: Record<string, unknown>) {
      const outcome = await session.call(name, args);
      calls.push({ name, outcome });
      return outcome;
    },
  } satisfies McpSession;
}

export async function runTurn(
  device: DeviceSession,
  rawText: string,
  deps: TurnDeps,
): Promise<{ result: TurnResult; device: DeviceSession }> {
  const started = Date.now();
  const next = structuredClone(device);
  const finish = (result: TurnResult, fellBack: boolean, violations: string[]) => {
    next.engine.lastSay = result.say;
    deps.logger.log({
      event: "turn",
      mode: result.mode,
      durationMs: Date.now() - started,
      fellBack,
      guardViolations: violations,
    });
    return { result, device: next };
  };

  const redacted = redact(rawText);
  if (redacted.removed || startsSensitiveNumber(rawText)) {
    const say = phrases.sensitiveStop();
    return finish(
      { say, rate: "normal", mode: "simplified", cards: [], expectReply: false },
      false,
      [],
    );
  }
  const text = redacted.text;

  const calls: { name: string; outcome: ToolCallOutcome }[] = [];
  const session = recordingSession(await deps.openSession(device), calls);
  try {
    let say: string | undefined;
    let mode: TurnResult["mode"] = "simplified";
    let expectReply = false;
    let fellBack = false;

    if (deps.mode === "full" && deps.converse) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), deps.deadlineMs ?? 3000);
      try {
        const agent = await runAgentTurn({
          modelId: deps.modelId,
          system: systemPrompt(device.olderAdultFirstName),
          history: device.history,
          userText: text,
          session,
          converse: deps.converse,
          signal: controller.signal,
        });
        if (agent.say) {
          say = agent.say;
          mode = "full";
          expectReply = /\?\s*$/.test(agent.say);
          next.history = [...device.history, ...agent.newMessages].slice(
            -HISTORY_LIMIT,
          ) as Message[];
          const assessed = calls.find((call) => call.name === "assess_call")?.outcome.structured;
          if (typeof assessed?.checkId === "string") next.engine.checkId = assessed.checkId;
        }
      } catch {
        fellBack = true;
        calls.length = 0;
      } finally {
        clearTimeout(timer);
      }
    }

    if (say === undefined) {
      try {
        const reply = await simplifiedTurn(text, device.engine, engineTools(session));
        say = reply.say;
        expectReply = reply.expectReply;
        next.engine = reply.state;
      } catch {
        say = phrases.waitBeforePaying();
      }
    }

    const guarded = guardLine(say, {
      fallback: phrases.waitBeforePaying(),
      phrasesToNeverRepeat: next.engine.phrasesHeard,
    });
    const cards = cardsFrom(calls);
    return finish(
      { say: guarded.line, rate: "normal", mode, cards, expectReply },
      fellBack,
      guarded.violations,
    );
  } finally {
    await session.close().catch(() => {});
  }
}
