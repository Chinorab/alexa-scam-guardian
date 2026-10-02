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
import { parseConfirmation } from "@asg/core/confirm/confirm";
import { guardLine } from "@asg/core/guard/guard";
import { isCallerOnLine, isDanger } from "@asg/core/match/match";
import type { Logger } from "@asg/core/log/logger";
import { CALLER_NUMBER, redact, startsSensitiveNumber } from "@asg/core/redact/redact";
import type { DeviceSession } from "../device/sessions";
import { runAgentTurn, type ConverseFn } from "./bedrock-agent";
import type { McpSession, ToolCallOutcome } from "./mcp-client";
import { systemPrompt, type PromptContext } from "./prompt";

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

/** Engine stages that hold an open question: its answer goes back to the engine. */
const ENGINE_QUESTIONS = new Set(["awaiting_confirmation", "pick_member", "report_offered"]);

/**
 * The last messages of the conversation, starting with a plain user message, so a cut never
 * leaves a tool result without the tool use it answers (Bedrock refuses that).
 */
export function trimHistory(messages: Message[], limit = HISTORY_LIMIT): Message[] {
  let start = Math.max(0, messages.length - limit);
  while (start < messages.length) {
    const message = messages[start];
    const plainUser =
      message?.role === "user" && (message.content ?? []).every((block) => !block.toolResult);
    if (plainUser) break;
    start++;
  }
  return messages.slice(start);
}

const SENTENCE_END = /(?<=[.!?])\s+/;
const QUESTION_END = /\?\s*$/;

/**
 * A model answer that runs past three sentences keeps its first two and its closing question
 * (or its first three). Only whole sentences are dropped, and the guard still checks the rest.
 */
export function fitToThree(line: string): string {
  const parts = line.split(SENTENCE_END).filter((part) => /\w/.test(part));
  if (parts.length <= 3) return line;
  const last = parts.at(-1) ?? "";
  return (QUESTION_END.test(last) ? [...parts.slice(0, 2), last] : parts.slice(0, 3)).join(" ");
}

/**
 * Model punctuation in the house style: dashes become commas and line breaks become spaces,
 * so a well meant answer is not thrown away by the copy rules for its punctuation alone.
 */
export function houseStyle(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

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

/** What the model needs to know about the engine's side of the conversation. */
function promptContext(device: DeviceSession): PromptContext {
  const context: PromptContext = {};
  if (device.engine.checkId) context.checkId = device.engine.checkId;
  if (ENGINE_QUESTIONS.has(device.engine.stage)) {
    const asked =
      device.engine.question ??
      device.engine.lastSay?.split(SENTENCE_END).find((part) => QUESTION_END.test(part));
    if (asked) context.openQuestion = asked;
  }
  return context;
}

/** A free question rather than an answer: "Why would they want gift cards?" */
const QUESTION =
  /\?\s*$|^(why|how|what|who|when|where|which|is|are|can|could|would|will|do|does|did|should)\b/i;

/**
 * Who answers this turn in full mode. Rules answer what must be exact or instant: danger and a
 * caller still on the line (constitution Principle II), the first description (signs straight
 * from the official dataset, where the model needs two calls and most often misses the
 * 3 second deadline), and answers to a question the engine asked (its pending message lives in
 * the engine's state). The model answers the rest, including a free question asked in the
 * middle of the engine's question, and a yes or no to a question the model asked.
 */
export function answeredByRules(text: string, device: DeviceSession): boolean {
  if (isDanger(text) || isCallerOnLine(text)) return true;
  const intent = classify(text);
  if (!device.engine.checkId && intent === "describe") return true;
  if (device.engine.afterHangUp === true) return true;
  if (ENGINE_QUESTIONS.has(device.engine.stage)) {
    const freeQuestion =
      intent === "describe" &&
      QUESTION.test(text.trim()) &&
      parseConfirmation(text, []).kind === "unclear";
    return !freeQuestion;
  }
  if (intent === "bare_yes" || intent === "bare_no") return device.modelAsked !== true;
  // Requests the rules know ("Any news?", "Repeat that", "Help me report it") get their
  // tested answer at once; the model answers free questions and new details.
  return intent !== "describe";
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
  // The number the suspicious caller used is not the person's data: it goes on, so the check
  // can keep it for the report. It is never used as a destination (no tool accepts one).
  const caller = redacted.callerNumber;
  const text = caller
    ? redacted.text.replace(
        CALLER_NUMBER,
        `${caller.slice(0, 3)} ${caller.slice(3, 6)} ${caller.slice(6)}`,
      )
    : redacted.text;

  const calls: { name: string; outcome: ToolCallOutcome }[] = [];
  const session = recordingSession(await deps.openSession(device), calls);
  try {
    let say: string | undefined;
    let mode: TurnResult["mode"] = "simplified";
    let expectReply = false;
    let fellBack = false;

    // Who answers is decided by answeredByRules (danger, a caller on the line, the first
    // description and the engine's open questions go to the rules).
    const rulesFirst = answeredByRules(text, device);
    const openQuestion = promptContext(device).openQuestion;
    // True once the model's own messages (with its tool exchanges) are in the history.
    let historyKept = false;
    if (deps.mode === "full" && deps.converse && !rulesFirst) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), deps.deadlineMs ?? 3000);
      // The engine asked a question it still waits on: the model only talks, and the question
      // is asked again, so the engine's pending message stays the one that gets confirmed.
      const talkOnly = ENGINE_QUESTIONS.has(device.engine.stage);
      try {
        const agent = await runAgentTurn({
          modelId: deps.modelId,
          system: systemPrompt(device.olderAdultFirstName, promptContext(device)),
          history: device.history,
          userText: text,
          session: modelSession(session, text),
          converse: deps.converse,
          signal: controller.signal,
          talkOnly,
        });
        if (agent.say && claimsUnsentMessage(agent.say, calls)) {
          // Never tell someone a family member was contacted when nobody was.
          say = phrases.waitBeforePaying();
          mode = "full";
          fellBack = true;
        } else if (agent.say && talkOnly && openQuestion) {
          const answer = houseStyle(agent.say);
          say = fitToThree(answer.endsWith(openQuestion) ? answer : `${answer} ${openQuestion}`);
          mode = "full";
          expectReply = true;
          next.modelAsked = false;
        } else if (agent.say) {
          say = fitToThree(houseStyle(agent.say));
          mode = "full";
          expectReply = QUESTION_END.test(say);
          next.modelAsked = expectReply;
          next.history = trimHistory([...device.history, ...agent.newMessages]);
          historyKept = true;
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
        next.modelAsked = false;
        next.engine = reply.state;
      } catch {
        say = phrases.waitBeforePaying();
      }
    }

    // A blocked line falls back to the safe line, with any open question asked again.
    const guarded = guardLine(say, {
      fallback: openQuestion
        ? `${phrases.waitBeforePaying()} ${openQuestion}`
        : phrases.waitBeforePaying(),
      phrasesToNeverRepeat: next.engine.phrasesHeard,
    });
    // The model reads the whole conversation, including the lines it did not write itself.
    if (deps.mode === "full" && !historyKept) {
      next.history = trimHistory([
        ...next.history,
        { role: "user", content: [{ text }] },
        { role: "assistant", content: [{ text: guarded.line }] },
      ]);
    }
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
