/**
 * Simplified mode (FR-036, research R5 layer 3). Rule based dialogue over the real MCP tools:
 * it classifies what the older adult said, calls a tool through the EngineTools port, and
 * answers only with lines from the phrase catalog. Also the reference behavior in tests.
 */
import type { Channel, PaymentMethod, Relationship } from "../ports/index";
import { phrases, type Person } from "./phrases";

/** What assess_call returns (contracts/mcp-tools.md), as the engine needs it. */
export interface AssessCallResult {
  checkId: string;
  matchedSigns: { id: string; label: string; explanation: string }[];
  danger: boolean;
  nextStep:
    | "call_911"
    | "hang_up_first"
    | "pick_member"
    | "offer_verify"
    | "offer_heads_up"
    | "paid_guidance"
    | "no_signs_found"
    | "advise_wait";
  familyMatches: (Person & { memberId: string })[];
  headsUpCandidate?: Person & { memberId: string };
  alreadyPaid?: { method: PaymentMethod };
  interrupt: boolean;
}

/** The tools the engine can call. Backed by an MCP session in the web app. */
export interface EngineTools {
  assessCall(description: string, checkId?: string): Promise<AssessCallResult>;
}

export type Stage = "idle" | "assessed";

export interface EngineState {
  stage: Stage;
  checkId?: string;
  /** Last line spoken, for "repeat". */
  lastSay?: string;
  /** Phrases heard in a family password check; the guard never lets them be repeated. */
  phrasesHeard: string[];
  /** The member offered in the last question, if any. */
  offered?: Person & { memberId: string };
}

export interface EngineReply {
  say: string;
  state: EngineState;
  /** Tool names whose results carry a screen card this turn. */
  cardsFrom: string[];
  /** True when the device should keep listening for an answer. */
  expectReply: boolean;
}

export const initialState = (): EngineState => ({ stage: "idle", phrasesHeard: [] });

export type Intent =
  | "repeat"
  | "whats_new"
  | "pay_question"
  | "call_back"
  | "say_password"
  | "closing"
  | "file_for_me"
  | "describe";

const INTENTS: [Intent, RegExp][] = [
  [
    "repeat",
    /^(please )?(repeat|say (that|it) again|what did you say|pardon|come again|sorry what)\b/i,
  ],
  [
    "whats_new",
    /\b(what'?s new|any news|did \w+ (answer|reply|write back|text back|call back))\b/i,
  ],
  ["file_for_me", /\b(send|file|submit) (it|the report|a report) for me\b/i],
  [
    "say_password",
    /\b(what'?s|what is|tell me|say|remind me of) (our|the|my) (family )?(password|secret word)\b/i,
  ],
  [
    "call_back",
    /\b(call|text|ring|phone) (back )?(the|that) (number|caller)|\b(call|ring) (him|her|them) back\b/i,
  ],
  [
    "pay_question",
    /\b((can|should|may|do) i (just )?(pay|send|wire|buy)|is it (safe|ok|okay|fine) to (pay|send)|so i can pay|go ahead and pay)\b/i,
  ],
  ["closing", /^(ok(ay)? )?(thanks|thank you|bye|goodbye|that'?s all|never mind)\b/i],
];

export function classify(text: string): Intent {
  const trimmed = text.trim();
  return INTENTS.find(([, pattern]) => pattern.test(trimmed))?.[0] ?? "describe";
}

const DOOR = /\b(door|outside|here at|at my house|on my porch)\b/i;

function verifyTarget(result: AssessCallResult) {
  return result.familyMatches.length === 1 ? result.familyMatches[0] : undefined;
}

function relationshipWord(relationship: Relationship): string {
  return relationship === "other" ? "person" : relationship;
}

async function describe(
  text: string,
  state: EngineState,
  tools: EngineTools,
): Promise<EngineReply> {
  const result = await tools.assessCall(text, state.checkId);
  const next: EngineState = { ...state, stage: "assessed", checkId: result.checkId };
  delete next.offered;
  const reply = (say: string, expectReply = false): EngineReply => ({
    say,
    state: { ...next, lastSay: say },
    cardsFrom: ["assess_call"],
    expectReply,
  });

  if (result.interrupt) return reply(phrases.sensitiveStop());
  if (result.danger) return reply(DOOR.test(text) ? phrases.dangerAtDoor() : phrases.danger());
  if (result.nextStep === "hang_up_first") return reply(phrases.hangUpFirst());

  // A familiar voice is context: shown on screen, but not read aloud as a sign.
  const spoken = result.matchedSigns.filter((sign) => sign.id !== "family-voice");
  const labels = spoken.map((sign) => sign.label);
  if (labels.length === 0) return reply(phrases.noSigns());

  const target = verifyTarget(result);
  if (result.nextStep === "pick_member" && result.familyMatches.length > 1) {
    const first = result.familyMatches[0];
    return reply(
      `${phrases.thanks()} ${phrases.signs(labels)} ${phrases.pickMember(
        relationshipWord(first?.relationship ?? "other"),
        result.familyMatches.map((member) => member.name),
      )}`,
      true,
    );
  }
  if (target && result.nextStep === "offer_verify") {
    next.offered = target;
    return reply(
      `${phrases.thanks()} ${phrases.signs(labels)} ${phrases.offerVerify(target, result.headsUpCandidate)}`,
      true,
    );
  }
  return reply(`${phrases.thanks()} ${phrases.signs(labels)} ${phrases.waitBeforePaying()}`);
}

export async function simplifiedTurn(
  text: string,
  state: EngineState,
  tools: EngineTools,
): Promise<EngineReply> {
  const intent = classify(text);
  const say = (line: string, expectReply = false): EngineReply => ({
    say: line,
    state: { ...state, lastSay: line },
    cardsFrom: [],
    expectReply,
  });

  switch (intent) {
    case "repeat":
      return say(state.lastSay ?? phrases.closing());
    case "whats_new":
      return say(phrases.noNews());
    case "pay_question":
      return say(phrases.canIPay(state.offered));
    case "call_back":
      return say(phrases.callBackRefusal(state.offered), state.offered !== undefined);
    case "say_password":
      return say(phrases.passwordRefuse());
    case "file_for_me":
      return say(phrases.cannotFile());
    case "closing":
      return say(phrases.closing());
    case "describe":
      return describe(text, state, tools);
  }
}

export type { Channel };
