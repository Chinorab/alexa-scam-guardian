/**
 * Simplified mode (FR-036, research R5 layer 3). Rule based dialogue over the real MCP tools:
 * it classifies what the older adult said, calls a tool through the EngineTools port, and
 * answers only with lines from the phrase catalog. Also the reference behavior in tests.
 */
import type { Channel, PaymentMethod, Relationship } from "../ports/index";
import { isCallerOnLine, isDanger } from "../match/match";
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
    /** False when they were asked about someone else: the answer is "true" or "not true". */
    aboutThemselves?: boolean;
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
  /** Signs already spoken in this check: details with nothing new don't repeat the offer. */
  heardSigns?: string[];
  /** Alexa asked them to hang up first; the next turn continues the check. */
  afterHangUp?: boolean;
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
  | "greeting"
  | "what_to_do"
  | "self_blame"
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
    // Short forms only as the whole reply ("What?"), so "What should I do?" is not a repeat.
    /^(?:(?:what|huh|pardon(?: me)?|sorry|sorry what|come again|again|one more time|slower|louder|say it slower)(?: please)?[?.!]*$|(?:please |sorry,? |excuse me,? )?(?:repeat|say (?:that|it) (?:again|slower)|what did you say|what was that|(?:can|could|would) you (?:please )?(?:repeat|say (?:that|it) again|speak (?:up|slower|louder|more slowly))|i (?:didn'?t|did not|can'?t|couldn'?t) (?:hear|catch|understand)(?: (?:you|that|it|what you said))?[?.!]*$))/i,
  ],
  [
    "greeting",
    /^(?:(?:hi|hello|hey|good (?:morning|afternoon|evening))(?: alexa| there)?[.!?]*$|(?:what can you do|what do you do|how does this work|who are you|how can you help(?: me)?)\b)/i,
  ],
  [
    "whats_new",
    /\b(what'?s new|any (news|word|update)|is there (any |an )?(news|update|word)|did (\w+|my \w+|anyone|anybody) (answer|reply|respond|write back|text back|call back|get back( to me)?|get (my|the) message)|has (\w+|my \w+|anyone|anybody) (answered|replied|responded|written back|texted back|gotten back)|have you heard (from|back)|what did (\w+|my \w+) (say|answer|reply))\b/i,
  ],
  ["file_for_me", /\b(send|file|submit) (it|the report|a report) for me\b/i],
  [
    "report",
    // Danger is checked first elsewhere, so "call the police" here means reporting the scam.
    /\b(report (it|this|the call|that|a scam|the scam)|help (me )?(to )?report|how (do|can) i report|file a (report|complaint)|make a (report|complaint)|who (should|do) i tell|(should|can) i (call|tell) the police)\b/i,
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
    /\b((can|should|may|do) i (just |now |still )?(pay|send|wire|buy|give|mail|use)|is it (safe|ok|okay|fine) to (pay|send|wire|buy|give)|so i can (pay|send|wire|buy|give|mail)|go ahead and (pay|send|wire|buy)|i (still |really |just )?(want|am going|'m going) to (pay|send|wire|buy|give|mail)|i'?m (just )?gonna (pay|send|wire|buy|give|mail))\b/i,
  ],
  [
    // Asking for approval in other words ("Just tell me I can pay", "would paying be okay?",
    // "approve the payment") gets the same fixed answer, never a model's wording.
    "pay_question",
    /\b(tell me|say|confirm|approve)\b[^.?!]{0,30}\b(i can|it'?s (safe|ok|okay|fine)|yes|go ahead|the payment|to (pay|send|wire|buy))\b|\b(paying|sending|wiring) (be|is|would be) (ok|okay|fine|safe|alright)\b|\bdecided to (pay|send|wire|buy)\b/i,
  ],
  [
    // Feeling foolish gets reassurance at once, never a tool call (no blame, Principle V).
    "self_blame",
    /\b(i (feel|felt)|i'?m|i am|i was)( so| really| very| such an?)? (stupid|dumb|foolish|silly|embarrassed|ashamed|an idiot|a fool|gullible)\b|\bhow could i (be|have been) so\b/i,
  ],
  [
    "what_to_do",
    /\b(what (should|do|can|must) i do|what now|what do you (think|suggest|recommend)|what'?s (my|the) next step)\b/i,
  ],
  // Any other mention of the password asks for it ("he wants the family password"); after
  // payment questions, so "he knew the password so I can send it" stays a payment question.
  ["say_password", /\b(password|secret word|code word)\b/i],
  [
    "off_topic",
    /\b(weather|what time is it|play (some )?music|set a timer|tell me a joke|recipe|turn (on|off) the)\b/i,
  ],
  [
    "bare_yes",
    /^(yes|yeah|yep|sure|ok|okay|please|please do|go ahead|do it|yes please|absolutely|certainly|uh huh|mm hmm|sure thing|you bet)[.!]?$/i,
  ],
  ["bare_no", /^(no|nope|nah|no thanks|not now|not yet|stop|cancel|never mind)[.!]?$/i],
  ["closing", /^(ok(ay)? )?(thanks|thank you|bye|goodbye|that'?s all)\b/i],
];

export function classify(text: string): Intent {
  const trimmed = text.trim();
  return INTENTS.find(([, pattern]) => pattern.test(trimmed))?.[0] ?? "describe";
}

/** They already reached the real relative: "I called him on his real number and he's fine". */
const CHECKED_FINE =
  /\b(i|we) (just |already )?(called|talked to|spoke (to|with)|reached|texted|heard from|checked with|got hold of)\b.*\b((he'?s|she'?s|they'?re|he is|she is|they are) (just )?(fine|okay|ok|safe|alright|all right|at home|at work|at school)|(it )?(wasn'?t|was not) (really )?(him|her|them)|(he|she|they) (didn'?t|did not|never) call)\b/i;

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
  delete base.afterHangUp;
  const reply = (say: string, extra: Partial<EngineState> = {}, expectReply = false) =>
    replier(base)(say, { cards: ["assess_call"], state: extra, expectReply });

  if (result.interrupt) return reply(phrases.sensitiveStop());
  if (result.danger) return reply(DOOR.test(text) ? phrases.dangerAtDoor() : phrases.danger());
  if (result.nextStep === "hang_up_first") {
    const person = result.familyMatches.length === 1 ? result.familyMatches[0] : undefined;
    return reply(phrases.hangUpFirst(person), { afterHangUp: true });
  }

  const helper = result.headsUpCandidate;
  // Money already gone comes first, signs or not: one official first step, no blame.
  if (result.nextStep === "paid_guidance") {
    const guidance = await tools.getGuidance("already_paid", result.alreadyPaid?.method);
    const step = guidance.steps[0] ?? phrases.waitBeforePaying();
    const alreadyTold = state.contacted?.some((m) => m.memberId === helper?.memberId);
    if (helper && !alreadyTold) {
      const offered = await offer(
        { ...base, paid: true },
        tools,
        `${phrases.thanksPaid()} ${step}`,
        undefined,
        helper,
      );
      return { ...offered, cardsFrom: ["assess_call"] };
    }
    // Nobody to tell, or they were told already: the hotline and the report come now.
    return reply(
      `${step} ${phrases.hotline()} ${phrases.offerReport()}`,
      { stage: "report_offered" },
      true,
    );
  }

  if (CHECKED_FINE.test(text)) {
    return reply(
      `${phrases.checkedWithFamily()} ${phrases.offerReport()}`,
      { stage: "report_offered" },
      true,
    );
  }

  // A familiar voice is context: shown on screen, but not read aloud as a sign.
  const spoken = result.matchedSigns.filter((sign) => sign.id !== "family-voice");
  const labels = spoken.map((sign) => sign.label);
  const heard = state.heardSigns ?? [];
  base.heardSigns = [...new Set([...heard, ...spoken.map((sign) => sign.id)])];
  const target = result.familyMatches.length === 1 ? result.familyMatches[0] : undefined;
  // During an open check, details without new signs keep the current question going.
  if (state.stage === "waiting" && state.offered && spoken.every((s) => heard.includes(s.id))) {
    return reply(phrases.stillWaiting(state.offered));
  }
  if (
    state.stage === "assessed" &&
    heard.length > 0 &&
    spoken.every((sign) => heard.includes(sign.id))
  ) {
    // After a no, more details don't bring the same offer back, unless they name the person.
    const again = [state.offered, state.headsUp].find((m) => m && named(text, [m]));
    if (again) {
      const offered = await offer(base, tools, "", state.offered, state.headsUp);
      return { ...offered, cardsFrom: ["assess_call"] };
    }
    return reply(phrases.noNewSigns());
  }
  if (labels.length === 0) {
    if (target && result.nextStep === "offer_verify") {
      const offered = await offer(base, tools, phrases.noSignsCheck(), target);
      return { ...offered, cardsFrom: ["assess_call"] };
    }
    if (result.nextStep === "pick_member" && result.familyMatches.length > 1) {
      const first = result.familyMatches[0];
      return reply(
        `${phrases.noSignsCheck()} ${phrases.pickMember(
          relationshipWord(first?.relationship ?? "other"),
          result.familyMatches.map((m) => m.name),
        )}`,
        { stage: "pick_member", candidates: result.familyMatches },
        true,
      );
    }
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
        return reply(
          update.aboutThemselves === false
            ? phrases.replyNotTrue(person)
            : phrases.replyDenied(person),
          {
            ...opts,
            expectReply: true,
            state: { stage: "report_offered" },
          },
        );
      case "it_was_me":
        return reply(
          update.aboutThemselves === false
            ? phrases.replyTrue(person)
            : phrases.replyConfirmed(person),
          { ...opts, state: { stage: "assessed" } },
        );
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

  // Danger and a caller still on the line outrank everything else, including any open
  // question: "Someone is at my door" is never read as the answer to "Should I text Michael?".
  if (isDanger(text) || isCallerOnLine(text)) {
    return describe(text, { ...state, stage: state.stage === "idle" ? "idle" : "assessed" }, tools);
  }
  // They were asked to hang up first: whatever they say next, the check goes on.
  if (state.afterHangUp && ["bare_yes", "bare_no", "describe", "closing"].includes(intent)) {
    return describe(text, { ...state, stage: "assessed" }, tools);
  }

  switch (intent) {
    case "repeat":
      // Nothing said yet: repeat the invitation the Echo shows on screen.
      return reply(state.lastSay ?? phrases.askWhatHappened());
    case "greeting":
      return reply(phrases.intro(), { expectReply: true });
    case "self_blame": {
      const open = state.stage === "awaiting_confirmation" && state.question;
      return reply(open ? `${phrases.reassure()} ${state.question}` : phrases.reassure(), {
        expectReply: Boolean(open),
      });
    }
    case "what_to_do": {
      if (!state.checkId) return reply(phrases.askWhatHappened(), { expectReply: true });
      if (state.stage === "awaiting_confirmation" && state.question) {
        return reply(`${phrases.whatToDo()} ${state.question}`, { expectReply: true });
      }
      return reply(phrases.whatToDo(state.stage === "waiting" ? state.offered : undefined));
    }
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
