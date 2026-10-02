/**
 * Domain types (data-model.md) and the ports the apps implement. No AWS imports here:
 * the MCP server and web app plug in DynamoDB, SES and Polly; tests use the in memory ones.
 */

export type HouseholdKind = "real" | "demo";

export interface Household {
  householdId: string;
  kind: HouseholdKind;
  organizerEmail?: string;
  olderAdultFirstName: string;
  /** Minutes before an unanswered check message counts as "no answer" (FR-010). */
  waitMinutes: number;
  createdAt: string;
  updatedAt: string;
  /** Epoch seconds; set for demo households (24 h). */
  expiresAt?: number;
}

export const RELATIONSHIPS = [
  "grandson",
  "granddaughter",
  "son",
  "daughter",
  "nephew",
  "niece",
  "other",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export type Channel = "email" | "text";

/** One person; can be a relative to verify, a trusted contact, or both. */
export interface FamilyMember {
  memberId: string;
  householdId: string;
  name: string;
  relationship: Relationship;
  /** Free text when relationship is "other", for example "family friend". */
  relationshipOther?: string;
  nicknames: string[];
  channel: Channel;
  email?: string;
  /** E.164, +1 only. */
  phone?: string;
  canVerify: boolean;
  getsHeadsUp: boolean;
  optedOut: boolean;
}

export interface FamilyPassword {
  householdId: string;
  /** scrypt hash of the normalized phrase, base64url. Never returned by any API. */
  hash: string;
  salt: string;
  setAt: string;
}

export type ContactKind = "call" | "voicemail" | "text" | "email";

export type CheckState =
  | "open"
  | "assessed"
  | "awaiting_confirmation"
  | "waiting_for_reply"
  | "resolved"
  | "no_answer"
  | "closed";

export type CheckOutcome =
  "unknown" | "not_from_them" | "confirmed_by_them" | "no_answer" | "no_red_flags";

export type PaymentMethod =
  | "gift_card"
  | "wire"
  | "money_order"
  | "money_transfer_app"
  | "crypto"
  | "cash_mail"
  | "cash_courier"
  | "bank_transfer"
  | "other";

export interface MatchedSign {
  signId: string;
  patternId: string;
}

export interface Check {
  checkId: string;
  householdId: string;
  state: CheckState;
  /** Redacted text, appended turn after turn, at most 4,000 characters. */
  description: string;
  contactKind: ContactKind;
  claimedIdentity?: string;
  matchedSigns: MatchedSign[];
  danger: boolean;
  alreadyPaid?: { method: PaymentMethod; amountText?: string };
  /** Number the suspicious contact used, kept for reports. Never a destination. */
  callerNumber?: string;
  passwordAttempts: number;
  outcome: CheckOutcome;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  /** Epoch seconds, 30 days after creation (FR-030). */
  expiresAt: number;
}

export interface PendingAction {
  pendingId: string;
  householdId: string;
  checkId: string;
  verifyMemberIds: string[];
  headsUpMemberIds: string[];
  /** Exact question asked; names every recipient (FR-012). */
  question: string;
  /** Epoch seconds, 2 minutes after creation. */
  expiresAt: number;
}

export type Delivery = "sent" | "failed";
export type Reply = "none" | "it_was_me" | "it_wasnt_me";

export interface VerificationRequest {
  requestId: string;
  householdId: string;
  checkId: string;
  memberId: string;
  channel: Channel;
  sentAt: string;
  delivery: Delivery;
  reply: Reply;
  repliedAt?: string;
  replyTokenHash: string;
  /** Epoch seconds; the reply link works for 24 hours. */
  replyExpiresAt: number;
  /** Set when the household wait time passed without a reply (FR-010). */
  noAnswerAt?: string;
}

export interface HeadsUp {
  headsUpId: string;
  householdId: string;
  checkId: string;
  memberId: string;
  channel: Channel;
  sentAt: string;
  delivery: Delivery;
}

export interface SourceRef {
  publisher: "FTC" | "FBI" | "IC3" | "DOJ";
  title: string;
  url: string;
  retrievedOn: string;
}

export interface ReportSummary {
  reportId: string;
  householdId: string;
  checkId: string;
  facts: {
    toldAt: string;
    contactKind: ContactKind;
    claimedIdentity?: string;
    whatWasAsked?: string;
    paymentMethod?: PaymentMethod;
    amountText?: string;
    callerNumber?: string;
    warningSigns: string[];
  };
  links: (SourceRef & { name: string; whenToUse: string; phone?: string; hours?: string })[];
  submittedBySystem: false;
  createdAt: string;
}

export type DeviceEventKind = "reply_received" | "delivery_failed" | "no_answer";

export interface DeviceEvent {
  eventId: string;
  householdId: string;
  checkId: string;
  kind: DeviceEventKind;
  memberId?: string;
  /** For reply_received: what the relative answered. */
  reply?: Reply;
  at: string;
  read: boolean;
}

export interface SignInLink {
  tokenHash: string;
  email: string;
  createdAt: string;
  /** Epoch seconds, 15 minutes after creation. */
  expiresAt: number;
}

/** Persistence port. Every household scoped read takes the householdId first. */
export interface Store {
  getHousehold(householdId: string): Promise<Household | undefined>;
  findHouseholdByEmail(email: string): Promise<Household | undefined>;
  putHousehold(household: Household): Promise<void>;
  /** Erases the household and everything under it (FR-029). */
  deleteHousehold(householdId: string): Promise<void>;

  listMembers(householdId: string): Promise<FamilyMember[]>;
  getMember(householdId: string, memberId: string): Promise<FamilyMember | undefined>;
  putMember(member: FamilyMember): Promise<void>;
  deleteMember(householdId: string, memberId: string): Promise<void>;

  getPassword(householdId: string): Promise<FamilyPassword | undefined>;
  putPassword(password: FamilyPassword): Promise<void>;
  deletePassword(householdId: string): Promise<void>;

  getCheck(householdId: string, checkId: string): Promise<Check | undefined>;
  listChecks(householdId: string): Promise<Check[]>;
  putCheck(check: Check): Promise<void>;

  getPending(householdId: string, pendingId: string): Promise<PendingAction | undefined>;
  putPending(pending: PendingAction): Promise<void>;
  deletePending(householdId: string, pendingId: string): Promise<void>;

  listVerifications(householdId: string, checkId: string): Promise<VerificationRequest[]>;
  findVerificationByToken(tokenHash: string): Promise<VerificationRequest | undefined>;
  putVerification(request: VerificationRequest): Promise<void>;

  listHeadsUps(householdId: string, checkId: string): Promise<HeadsUp[]>;
  putHeadsUp(headsUp: HeadsUp): Promise<void>;

  getReport(householdId: string, checkId: string): Promise<ReportSummary | undefined>;
  putReport(report: ReportSummary): Promise<void>;

  listEvents(householdId: string, options?: { unreadOnly?: boolean }): Promise<DeviceEvent[]>;
  putEvent(event: DeviceEvent): Promise<void>;
  markEventsRead(householdId: string, eventIds: string[]): Promise<void>;

  putSignInLink(link: SignInLink): Promise<void>;
  /** Returns the link and deletes it, so each link works once. */
  takeSignInLink(tokenHash: string): Promise<SignInLink | undefined>;

  /** Adds one to a counter for the current window and returns the new count. */
  incrementRate(scope: string, windowSeconds: number): Promise<number>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Lets the demo phone show email sent to demo households. */
  householdId?: string;
  memberId?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

export interface TextMessage {
  householdId: string;
  memberId: string;
  to: string;
  body: string;
}

/** Text messages. In this version they land on the on screen demo phone (FR-014). */
export interface TextChannel {
  send(message: TextMessage): Promise<{ messageId: string }>;
}

export interface Clock {
  now(): Date;
}

export type IdGen = () => string;

export const systemClock: Clock = { now: () => new Date() };

export const epochSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);
