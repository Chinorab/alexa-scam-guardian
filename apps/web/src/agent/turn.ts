/**
 * One conversation turn (FR-017, FR-036, research R5).
 * 1. Redact. A sensitive number stops the turn with the fixed stop line; nothing goes further.
 * 2. Full mode: Bedrock with the MCP tools, 3 second deadline.
 * 3. Otherwise, or on failure: simplified mode over the same MCP tools.
 * 4. Every line passes the output guard before it is spoken.
 */
import type { Message } from "@aws-sdk/client-bedrock-runtime";
import {
  classify,
  simplifiedTurn,
  type AssessCallResult,
  type ConfirmResult,
  type EngineTools,
  type GuidanceResult,
  type PasswordResult,
  type PrepareResult,
  type UpdatesResult,
} from "@asg/core/dialogue/engine";
import { phrases } from "@asg/core/dialogue/phrases";
import { guardLine } from "@asg/core/guard/guard";
import { isCallerOnLine, isDanger } from "@asg/core/match/match";
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
    getGuidance: (topic, paymentMethod) =>
      call<GuidanceResult>("get_guidance", paymentMethod ? { topic, paymentMethod } : { topic }),
    prepareReport: (checkId) => call<{ reportId: string }>("prepare_report", { checkId }),
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

/** A spoken claim that a message went out, for example "Done." or "I texted Michael." */
const CLAIMS_SENT =
  /^done\b|\bI(?:'ve| have)? (?:just )?(?:sent|texted|emailed|messaged|let \w+ know)\b/i;

/** True when the model says it sent something that no tool sent during this turn. */
export function claimsUnsentMessage(
  say: string,
  calls: { name: string; outcome: ToolCallOutcome }[],
): boolean {
  if (!CLAIMS_SENT.test(say.trim())) return false;
  return !calls.some(
    (call) =>
      call.name === "confirm_outreach" &&
      Array.isArray(call.outcome.structured?.sent) &&
      call.outcome.structured.sent.length > 0,
  );
}

/**
 * What the model may do with the outreach tools (constitution Principle IV). The model never
 * speaks for the person: confirm_outreach always receives the person's own words from this
 * turn, and a question prepared in this turn cannot be confirmed before the person has heard
 * it and answered in a later turn.
 */
export function modelSession(session: McpSession, userText: string): McpSession {
  const preparedThisTurn = new Set<string>();
  return {
    ...session,
    async call(name, args) {
      if (name === "confirm_outreach") {
        const pendingId = typeof args.pendingId === "string" ? args.pendingId : "";
        if (preparedThisTurn.has(pendingId)) {
          return {
            isError: true,
            text: "Nothing was sent. Ask the question out loud, then end your turn and wait for the person's answer.",
          };
        }
        return session.call(name, { ...args, userReply: userText });
      }
      const outcome = await session.call(name, args);
      const pendingId = outcome.structured?.pendingId;
      if (name === "prepare_outreach" && typeof pendingId === "string") {
        preparedThisTurn.add(pendingId);
      }
      return outcome;
    },
  };
}

/** Courtesy sentences that carry no instruction; a repeat leaves them out. */
const COURTESY = new Set([phrases.thanks(), phrases.thanksPaid(), "Okay."]);

/**
 * The repeated line in simpler form (FR-023): the same sentences without the courtesy ones,
 * so only the warning, the step and the question remain. Never adds words, so it stays as safe
 * as the line it repeats.
 */
export function simplerRepeat(line: string): string {
  // A plain split keeps the text as is; abbreviations split oddly but are joined back unchanged.
  const kept = line.split(/(?<=[.!?])\s+/).filter((sentence) => !COURTESY.has(sentence.trim()));
  return kept.length > 0 ? kept.join(" ") : line;
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

  // "Repeat" replays the last line more slowly and in fewer words (FR-023), whatever the mode.
  if (classify(rawText) === "repeat" && device.engine.lastSay) {
    return finish(
      {
        say: simplerRepeat(device.engine.lastSay),
        rate: "slow",
        mode: "simplified",
        cards: [],
        expectReply: false,
      },
      false,
      [],
    );
  }

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

    // Danger and a caller still on the line get the deterministic answer (911, hang up first),
    // never a model's wording (constitution Principle II).
    const rulesFirst = isDanger(text) || isCallerOnLine(text);
    if (deps.mode === "full" && deps.converse && !rulesFirst) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), deps.deadlineMs ?? 3000);
      try {
        const agent = await runAgentTurn({
          modelId: deps.modelId,
          system: systemPrompt(device.olderAdultFirstName),
          history: device.history,
          userText: text,
          session: modelSession(session, text),
          converse: deps.converse,
          signal: controller.signal,
        });
        if (agent.say && claimsUnsentMessage(agent.say, calls)) {
          // Never tell someone a family member was contacted when nobody was.
          say = phrases.waitBeforePaying();
          mode = "full";
          fellBack = true;
        } else if (agent.say) {
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
