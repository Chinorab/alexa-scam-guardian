/**
 * Simplified mode (FR-036, research R5 layer 3). Rule based dialogue over the real MCP tools:
 * it classifies what the older adult said, calls a tool through the EngineTools port, and
 * answers only with lines from the phrase catalog. Also the reference behavior in tests.
 */
import type { Channel, PaymentMethod, Relationship } from "../ports/index";
import { phrases, type Person } from "./phrases";

export type Member = Person & { memberId: string };

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
  familyMatches: Member[];
  headsUpCandidate?: Member;
  alreadyPaid?: { method: PaymentMethod };
  /** Who the caller said they were, for example "nephew" or "grandchild". */
  claimedIdentity?: string;
  /** False when the family saved nobody yet. */
  familySaved?: boolean;
  interrupt: boolean;
}

/** Claimed identities that are family: when none is saved, Alexa says it can't reach them. */
const FAMILY_WORDS = new Set([
  "grandson",
  "granddaughter",
  "grandchild",
  "son",
  "daughter",
  "nephew",
  "niece",
]);

export interface PrepareResult {
  pendingId: string;
  question: string;
}

export interface ConfirmResult {
  sent: {
    memberId: string;
    name: string;
    kind: "verify" | "heads_up";
    delivery: "sent" | "failed";
  }[];
  nothingSent: boolean;
  reason?: "declined" | "unclear" | "expired" | "rate_limited";
}

export interface UpdatesResult {
  updates: {
    checkId: string;
    memberName: string;
    kind: "it_was_me" | "it_wasnt_me" | "no_answer" | "delivery_failed";
  }[];
  waitingOn: { memberName: string; minutesWaiting: number }[];
  nextMemberToTry?: Member & { role: "verify" | "heads_up" };
}

export type PasswordResult = "matches" | "does_not_match" | "not_set" | "locked";

export interface GuidanceResult {
  steps: string[];
  helpResources: { name: string; phone?: string }[];
}

/** The tools the engine can call. Backed by an MCP session in the web app. */
export interface EngineTools {
  assessCall(description: string, checkId?: string): Promise<AssessCallResult>;
  prepareOutreach(
    checkId: string,
    verifyMemberId?: string,
    headsUpMemberIds?: string[],
  ): Promise<PrepareResult>;
  confirmOutreach(pendingId: string, userReply: string): Promise<ConfirmResult>;
  getUpdates(checkId?: string): Promise<UpdatesResult>;
  checkFamilyPassword(checkId: string, phraseHeard: string): Promise<PasswordResult>;
  getGuidance(topic: "already_paid", paymentMethod?: PaymentMethod): Promise<GuidanceResult>;
  prepareReport(checkId: string): Promise<{ reportId: string }>;
}

export type Stage =
  "idle" | "assessed" | "pick_member" | "awaiting_confirmation" | "waiting" | "report_offered";

export interface EngineState {
  stage: Stage;
  checkId?: string;
  /** Last line spoken, for "repeat". */
  lastSay?: string;
  /** Phrases heard in a family password check; the guard never lets them be repeated. */
  phrasesHeard: string[];
  /** The relative to verify with, once known. */
  offered?: Member;
  /** The trusted contact to tell, once known. */
  headsUp?: Member;
  /** Candidates when two relatives match ("which grandson?"). */
  candidates?: Member[];
  pendingId?: string;
  question?: string;
  /** People already messaged in this check, for names and pronouns in later news. */
  contacted?: Member[];
  /** One sentence to share while waiting, from the top warning sign. */
  waitingFact?: string;
  /** Set after "I already paid": the hotline is offered once the heads up is settled. */
  paid?: boolean;
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
  | "password_heard"
  | "closing"
  | "file_for_me"
  | "report"
  | "off_topic"
  | "bare_yes"
  | "bare_no"
  | "describe";

const INTENTS: [Intent, RegExp][] = [
  [
    "repeat",
    /^(please )?(repeat|say (that|it) again|what did you say|pardon|come again|sorry what)\b/i,
  ],
  [
    "whats_new",
    /\b(what'?s new|any news|did \w+ (answer|reply|write back|text back|call back)|has \w+ (answered|replied))\b/i,
  ],
  ["file_for_me", /\b(send|file|submit) (it|the report|a report) for me\b/i],
  [
    "report",
    /\b(report (it|this|the call|that)|help (me )?(to )?report|how (do|can) i report|file a report|make a report)\b/i,
  ],
  [
    "say_password",
    /\b(what'?s|what is|tell|say|read|give|share|remind)(?: (?:me|him|her|them|the caller))?(?: of| what)?\s+(?:is\s+)?(our|the|my) (family )?(password|secret word|code word)\b/i,
  ],
  ["password_heard", /\b(password|secret word|code word) (is|was)\b/i],
  [
    "call_back",
    /\b(call|text|ring|phone) (back )?(the|that) (number|caller)|\b(call|ring|dial|phone) (the )?(lawyer|attorney|officer|police|sergeant|caller|him|her|them) back\b/i,
  ],
  [
    "pay_question",
    /\b((can|should|may|do) i (just )?(pay|send|wire|buy)|is it (safe|ok|okay|fine) to (pay|send)|so i can pay|go ahead and pay)\b/i,
  ],
  [
    "off_topic",
    /\b(weather|what time is it|play (some )?music|set a timer|tell me a joke|recipe|turn (on|off) the)\b/i,
  ],
  ["bare_yes", /^(yes|yeah|yep|sure|ok|okay|please|please do|go ahead|do it|yes please)[.!]?$/i],
  ["bare_no", /^(no|nope|no thanks|not now|stop|cancel|never mind)[.!]?$/i],
  ["closing", /^(ok(ay)? )?(thanks|thank you|bye|goodbye|that'?s all)\b/i],
];

export function classify(text: string): Intent {
  const trimmed = text.trim();
  return INTENTS.find(([, pattern]) => pattern.test(trimmed))?.[0] ?? "describe";
}

const DOOR = /\b(door|outside|here at|at my house|on my porch)\b/i;

/** What the caller said the password was: the words after "password is". */
export function phraseAfterPassword(text: string): string | undefined {
  const match = text.match(
    /\b(?:password|secret word|code word) (?:is|was)\s+["']?([^"'.!?]{2,60})/i,
  );
  return match?.[1]?.trim();
}

function relationshipWord(relationship: Relationship): string {
  return relationship === "other" ? "person" : relationship;
}

function named(text: string, members: Member[]): Member | undefined {
  const lower = text.toLowerCase();
  return members.find((m) => new RegExp(`\\b${m.name.toLowerCase()}\\b`).test(lower));
}

type Reply = (
  say: string,
  opts?: { expectReply?: boolean; cards?: string[]; state?: Partial<EngineState> },
) => EngineReply;

function replier(state: EngineState): Reply {
  return (say, opts = {}) => ({
    say,
    state: { ...state, ...opts.state, lastSay: say },
    cardsFrom: opts.cards ?? [],
    expectReply: opts.expectReply ?? false,
  });
}

/** Asks the server for the exact question, then asks it. */
async function offer(
  state: EngineState,
  tools: EngineTools,
  lead: string,
  verify?: Member,
  headsUp?: Member,
): Promise<EngineReply> {
  if (!state.checkId) throw new Error("No open check.");
  const prepared = await tools.prepareOutreach(
    state.checkId,
    verify?.memberId,
    headsUp ? [headsUp.memberId] : undefined,
  );
  const say = lead ? `${lead} ${prepared.question}` : prepared.question;
  const next: Partial<EngineState> = {
    stage: "awaiting_confirmation",
    pendingId: prepared.pendingId,
    question: prepared.question,
  };
  if (verify) next.offered = verify;
  if (headsUp) next.headsUp = headsUp;
  return replier(state)(say, { expectReply: true, state: next });
}

async function describe(
  text: string,
  state: EngineState,
  tools: EngineTools,
): Promise<EngineReply> {
  const result = await tools.assessCall(text, state.checkId);
  const base: EngineState = { ...state, stage: "assessed", checkId: result.checkId };
  const reply = (say: string, extra: Partial<EngineState> = {}, expectReply = false) =>
    replier(base)(say, { cards: ["assess_call"], state: extra, expectReply });

  if (result.interrupt) return reply(phrases.sensitiveStop());
  if (result.danger) return reply(DOOR.test(text) ? phrases.dangerAtDoor() : phrases.danger());
  if (result.nextStep === "hang_up_first") return reply(phrases.hangUpFirst());

  const helper = result.headsUpCandidate;
  // Money already gone comes first, signs or not: one official first step, no blame.
  if (result.nextStep === "paid_guidance") {
    const guidance = await tools.getGuidance("already_paid", result.alreadyPaid?.method);
    const step = guidance.steps[0] ?? phrases.waitBeforePaying();
    if (helper) {
      const offered = await offer(
        { ...base, paid: true },
        tools,
        `${phrases.thanksPaid()} ${step}`,
        undefined,
        helper,
      );
      return { ...offered, cardsFrom: ["assess_call"] };
    }
    return reply(phrases.thankForTelling(step), { paid: true });
  }

  // A familiar voice is context: shown on screen, but not read aloud as a sign.
  const spoken = result.matchedSigns.filter((sign) => sign.id !== "family-voice");
  const labels = spoken.map((sign) => sign.label);
  if (labels.length === 0) {
    // During an open check, details without new signs keep the current question going.
    if (state.stage === "waiting" && state.offered)
      return reply(phrases.stillWaiting(state.offered));
    return reply(phrases.noSigns());
  }
  const waitingFact = spoken.find((sign) => !sign.explanation.includes(". "))?.explanation;
  if (waitingFact) base.waitingFact = waitingFact;
  // A caller who asked for secrecy gets a plain answer: telling family is right.
  const opener = spoken.some((sign) => sign.id === "secrecy")
    ? phrases.secrecyReassure()
    : phrases.thanks();
  const lead = `${opener} ${phrases.signs(labels)}`;

  if (result.nextStep === "pick_member" && result.familyMatches.length > 1) {
    const first = result.familyMatches[0];
    const extra: Partial<EngineState> = { stage: "pick_member", candidates: result.familyMatches };
    if (helper) extra.headsUp = helper;
    return reply(
      `${lead} ${phrases.pickMember(
        relationshipWord(first?.relationship ?? "other"),
        result.familyMatches.map((m) => m.name),
      )}`,
      extra,
      true,
    );
  }
  const target = result.familyMatches.length === 1 ? result.familyMatches[0] : undefined;
  if (target && result.nextStep === "offer_verify") {
    const offered = await offer(base, tools, lead, target, helper);
    return { ...offered, cardsFrom: ["assess_call"] };
  }
  if (helper && result.nextStep === "offer_heads_up") {
    // US2.3: the caller claimed a relative nobody saved; say why Alexa can't check with them.
    const unsaved =
      result.claimedIdentity && FAMILY_WORDS.has(result.claimedIdentity)
        ? `${phrases.signs(labels)} ${phrases.onlySavedPeople(result.claimedIdentity)}`
        : lead;
    const offered = await offer(base, tools, unsaved, undefined, helper);
    return { ...offered, cardsFrom: ["assess_call"] };
  }
  if (result.familySaved === false) return reply(`${lead} ${phrases.noFamilySaved()}`);
  return reply(`${lead} ${phrases.waitBeforePaying()}`);
}

async function confirm(text: string, state: EngineState, tools: EngineTools): Promise<EngineReply> {
  const reply = replier(state);
  if (!state.pendingId) return reply(phrases.nothingSent(), { state: { stage: "assessed" } });
  const result = await tools.confirmOutreach(state.pendingId, text);
  const cleared: Partial<EngineState> = { stage: "assessed" };
  const withoutPending = { ...state };
  delete withoutPending.pendingId;
  delete withoutPending.question;
  const done = replier(withoutPending);

  if (result.nothingSent) {
    if (result.reason === "unclear" && state.question) {
      return reply(phrases.unclearConfirm(state.question), { expectReply: true });
    }
    if (state.paid) {
      // Money already left: say nothing was sent, then the hotline and the report (FR-013, FR-021).
      return done(`${phrases.nothingSent()} ${phrases.hotline()} ${phrases.offerReport()}`, {
        expectReply: true,
        state: { stage: "report_offered", paid: false },
      });
    }
    return done(phrases.nothingSent(), { state: cleared });
  }
  const delivered = result.sent.filter((s) => s.delivery === "sent");
  const verified = delivered.find((s) => s.kind === "verify");
  const failed = result.sent.find((s) => s.delivery === "failed");
  const contacted = [
    ...(state.contacted ?? []),
    ...[state.offered, state.headsUp].filter(
      (m): m is Member => m !== undefined && delivered.some((s) => s.memberId === m.memberId),
    ),
  ];
  if (failed && !verified) {
    const person = [state.offered, state.headsUp].find((m) => m?.memberId === failed.memberId);
    if (person) return done(phrases.deliveryFailed(person), { state: { ...cleared, contacted } });
  }
  const headsUpNames = delivered.filter((s) => s.kind === "heads_up").map((s) => s.name);
  const sentLine = phrases.sent(verified?.name, verified ? [] : headsUpNames);
  if (state.paid && !verified) {
    const told = headsUpNames.length > 0 ? phrases.toldShort(headsUpNames) : sentLine;
    return done(`${told} ${phrases.hotline()} ${phrases.offerReport()}`, {
      cards: ["confirm_outreach"],
      expectReply: true,
      state: { stage: "report_offered", contacted, paid: false },
    });
  }
  const fact = verified && state.waitingFact ? ` ${phrases.whileWaiting(state.waitingFact)}` : "";
  return done(`${sentLine}${fact}`, {
    cards: ["confirm_outreach"],
    state: { stage: verified ? "waiting" : "assessed", contacted },
  });
}

async function news(state: EngineState, tools: EngineTools): Promise<EngineReply> {
  const reply = replier(state);
  const result = await tools.getUpdates(state.checkId);
  const people = [...(state.contacted ?? []), ...(state.offered ? [state.offered] : [])];
  const personNamed = (name: string): Member =>
    people.find((p) => p.name === name) ?? {
      memberId: "",
      name,
      relationship: "other",
      channel: "text",
    };

  const priority = ["it_wasnt_me", "it_was_me", "no_answer", "delivery_failed"] as const;
  const update = priority.map((kind) => result.updates.find((u) => u.kind === kind)).find(Boolean);
  if (update) {
    const person = personNamed(update.memberName);
    const opts = { cards: ["get_updates"] };
    switch (update.kind) {
      case "it_wasnt_me":
        return reply(phrases.replyDenied(person), {
          ...opts,
          expectReply: true,
          state: { stage: "report_offered" },
        });
      case "it_was_me":
        return reply(phrases.replyConfirmed(person), { ...opts, state: { stage: "assessed" } });
      case "no_answer":
      case "delivery_failed": {
        const next = result.nextMemberToTry;
        const lead =
          update.kind === "no_answer"
            ? phrases.noAnswer(person)
            : phrases.deliveryFailed(person).split(". ")[0] + ".";
        if (next && state.checkId) {
          const asVerify = next.role === "verify";
          const offered = await offer(
            { ...state, stage: "assessed" },
            tools,
            lead,
            asVerify ? next : undefined,
            asVerify ? undefined : next,
          );
          return { ...offered, cardsFrom: ["get_updates"] };
        }
        return reply(
          update.kind === "no_answer" ? phrases.noAnswer(person) : phrases.deliveryFailed(person),
          opts,
        );
      }
    }
  }
  const waiting = result.waitingOn[0];
  if (waiting)
    return reply(phrases.stillWaiting(personNamed(waiting.memberName)), { cards: ["get_updates"] });
  return reply(phrases.noNews());
}

async function password(
  text: string,
  state: EngineState,
  tools: EngineTools,
): Promise<EngineReply> {
  const phrase = phraseAfterPassword(text);
  if (!phrase) return replier(state)(phrases.passwordRefuse());
  let current = state;
  if (!current.checkId) {
    const assessed = await tools.assessCall(text);
    current = { ...current, checkId: assessed.checkId, stage: "assessed" };
  }
  const heard = { phrasesHeard: [...current.phrasesHeard, phrase] };
  const result = await tools.checkFamilyPassword(current.checkId as string, phrase);
  const reply = replier({ ...current, ...heard });
  switch (result) {
    case "matches":
      return reply(phrases.passwordMatches(current.offered));
    case "does_not_match":
      return reply(phrases.passwordNoMatch());
    case "not_set":
      return reply(phrases.passwordNotSet());
    case "locked":
      return reply(phrases.passwordLocked());
  }
}

async function report(state: EngineState, tools: EngineTools): Promise<EngineReply> {
  const reply = replier(state);
  if (!state.checkId) return reply(phrases.reportNeedsCall());
  await tools.prepareReport(state.checkId);
  return reply(phrases.reportReady(), { cards: ["prepare_report"], state: { stage: "assessed" } });
}

export async function simplifiedTurn(
  text: string,
  state: EngineState,
  tools: EngineTools,
): Promise<EngineReply> {
  const intent = classify(text);
  const reply = replier(state);

  switch (intent) {
    case "repeat":
      return reply(state.lastSay ?? phrases.closing());
    case "whats_new":
      return news(state, tools);
    case "pay_question":
      return reply(phrases.canIPay(state.offered));
    case "call_back": {
      const person = state.offered;
      if (!person || !state.checkId) return reply(phrases.callBackRefusal());
      if (state.stage === "awaiting_confirmation") {
        return reply(phrases.callBackRefusal(person), { expectReply: true });
      }
      const offered = await offer(state, tools, "", person, state.headsUp);
      return {
        ...offered,
        say: phrases.callBackRefusal(person),
        state: { ...offered.state, lastSay: phrases.callBackRefusal(person) },
      };
    }
    case "say_password":
      return reply(phrases.passwordRefuse());
    case "password_heard":
      return password(text, state, tools);
    case "file_for_me": {
      const helper = state.headsUp;
      if (!helper || !state.checkId) return reply(phrases.cannotFile());
      const offered = await offer({ ...state, stage: "assessed" }, tools, "", undefined, helper);
      const line = phrases.cannotFile(helper);
      return { ...offered, say: line, state: { ...offered.state, lastSay: line } };
    }
    case "report":
      return report(state, tools);
    case "off_topic": {
      const resume =
        state.stage === "awaiting_confirmation" && state.question ? ` ${state.question}` : "";
      return reply(`${phrases.cantHelpHere()} ${phrases.backToCheck()}${resume}`, {
        expectReply: resume !== "",
      });
    }
    case "closing":
      return reply(phrases.closing());
    case "bare_yes":
    case "bare_no":
    case "describe":
      break;
  }

  if (state.stage === "awaiting_confirmation") return confirm(text, state, tools);
  if (state.stage === "report_offered") {
    if (intent === "bare_yes") return report(state, tools);
    if (intent === "bare_no") return reply(phrases.closing(), { state: { stage: "assessed" } });
  }
  if (state.stage === "pick_member" && state.candidates) {
    const chosen = named(text, state.candidates);
    if (chosen) return offer({ ...state, stage: "assessed" }, tools, "", chosen, state.headsUp);
    if (intent === "bare_no") return reply(phrases.nothingSent(), { state: { stage: "assessed" } });
    const first = state.candidates[0];
    return reply(
      phrases.pickMember(
        relationshipWord(first?.relationship ?? "other"),
        state.candidates.map((m) => m.name),
      ),
      { expectReply: true },
    );
  }
  if (intent === "bare_no") return reply(phrases.closing());
  if (intent === "bare_yes") {
    return reply(
      state.stage === "waiting" && state.offered
        ? phrases.stillWaiting(state.offered)
        : phrases.closing(),
    );
  }
  return describe(text, state, tools);
}

export type { Channel };
