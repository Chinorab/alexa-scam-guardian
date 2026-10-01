/**
 * Store on one DynamoDB table (data-model.md). Every household item lives under
 * PK = HH#<householdId>, so deleting a household is one query and a batch delete (FR-029).
 * DynamoDB TTL removes rows late, sometimes days late, so every read also checks expiry.
 */
import {
  epochSeconds,
  systemClock,
  type Check,
  type Clock,
  type DeviceEvent,
  type FamilyMember,
  type FamilyPassword,
  type HeadsUp,
  type Household,
  type PendingAction,
  type ReportSummary,
  type SignInLink,
  type Store,
  type VerificationRequest,
} from "@asg/core/ports/index";
import type { Row, Table } from "./table";

const DAY = 86400;
/** Check records, messages and reports are kept 30 days (FR-030). */
export const RECORD_SECONDS = 30 * DAY;
/** Echo notifications are kept 24 hours. */
export const EVENT_SECONDS = DAY;

export const hh = (householdId: string) => `HH#${householdId}`;

const parse = <T>(row: Row | undefined): T | undefined =>
  row ? (JSON.parse(row.body) as T) : undefined;

const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

export class DynamoStore implements Store {
  constructor(
    private readonly table: Table,
    private readonly clock: Clock = systemClock,
  ) {}

  private alive(row: Row | undefined): row is Row {
    return !!row && (row.expiresAt === undefined || row.expiresAt > epochSeconds(this.clock.now()));
  }

  private async one<T>(pk: string, sk: string): Promise<T | undefined> {
    const row = await this.table.get({ PK: pk, SK: sk });
    return this.alive(row) ? parse<T>(row) : undefined;
  }

  private async many<T>(pk: string, prefix: string, descending = false): Promise<T[]> {
    const rows = await this.table.query(pk, prefix, descending);
    return rows.filter((row) => this.alive(row)).map((row) => JSON.parse(row.body) as T);
  }

  /**
   * Items of a demo household expire with it; real household items keep their own expiry.
   * Returns the earliest of the two.
   */
  private async within(householdId: string, own?: number): Promise<number | undefined> {
    const meta = await this.table.get({ PK: hh(householdId), SK: "META" });
    const limits = [own, meta?.expiresAt].filter((n): n is number => n !== undefined);
    return limits.length > 0 ? Math.min(...limits) : undefined;
  }

  private async write(
    householdId: string,
    sk: string,
    item: object,
    options: { own?: number; gsi1pk?: string } = {},
  ) {
    const expiresAt = await this.within(householdId, options.own);
    await this.table.put({
      PK: hh(householdId),
      SK: sk,
      body: JSON.stringify(item),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(options.gsi1pk ? { GSI1PK: options.gsi1pk } : {}),
    });
  }

  // Households

  getHousehold(householdId: string) {
    return this.one<Household>(hh(householdId), "META");
  }

  async findHouseholdByEmail(email: string) {
    const rows = await this.table.queryIndex(`EMAIL#${email.toLowerCase()}`);
    const row = rows.find((r) => this.alive(r));
    return parse<Household>(row);
  }

  async putHousehold(household: Household) {
    await this.table.put({
      PK: hh(household.householdId),
      SK: "META",
      body: JSON.stringify(household),
      ...(household.expiresAt !== undefined ? { expiresAt: household.expiresAt } : {}),
      ...(household.organizerEmail
        ? { GSI1PK: `EMAIL#${household.organizerEmail.toLowerCase()}` }
        : {}),
    });
  }

  async deleteHousehold(householdId: string) {
    const rows = await this.table.query(hh(householdId));
    await this.table.deleteMany(rows.map(({ PK, SK }) => ({ PK, SK })));
  }

  // People

  listMembers(householdId: string) {
    return this.many<FamilyMember>(hh(householdId), "MEM#").then((members) =>
      members.sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  getMember(householdId: string, memberId: string) {
    return this.one<FamilyMember>(hh(householdId), `MEM#${memberId}`);
  }

  putMember(member: FamilyMember) {
    return this.write(member.householdId, `MEM#${member.memberId}`, member);
  }

  async deleteMember(householdId: string, memberId: string) {
    await this.table.deleteMany([{ PK: hh(householdId), SK: `MEM#${memberId}` }]);
  }

  // Family password

  getPassword(householdId: string) {
    return this.one<FamilyPassword>(hh(householdId), "PWD");
  }

  putPassword(password: FamilyPassword) {
    return this.write(password.householdId, "PWD", password);
  }

  async deletePassword(householdId: string) {
    await this.table.deleteMany([{ PK: hh(householdId), SK: "PWD" }]);
  }

  // Checks

  getCheck(householdId: string, checkId: string) {
    return this.one<Check>(hh(householdId), `CHK#${checkId}`);
  }

  async listChecks(householdId: string) {
    const checks = await this.many<Check>(hh(householdId), "CHK#");
    return checks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  putCheck(check: Check) {
    return this.write(check.householdId, `CHK#${check.checkId}`, check, { own: check.expiresAt });
  }

  // Pending actions

  getPending(householdId: string, pendingId: string) {
    return this.one<PendingAction>(hh(householdId), `PEND#${pendingId}`);
  }

  putPending(pending: PendingAction) {
    return this.write(pending.householdId, `PEND#${pending.pendingId}`, pending, {
      own: pending.expiresAt,
    });
  }

  async deletePending(householdId: string, pendingId: string) {
    await this.table.deleteMany([{ PK: hh(householdId), SK: `PEND#${pendingId}` }]);
  }

  // Check messages and heads ups

  async listVerifications(householdId: string, checkId: string) {
    const requests = await this.many<VerificationRequest>(hh(householdId), `VER#${checkId}#`);
    return requests.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async findVerificationByToken(tokenHash: string) {
    const rows = await this.table.queryIndex(`TOKEN#${tokenHash}`);
    return parse<VerificationRequest>(rows.find((r) => this.alive(r)));
  }

  putVerification(request: VerificationRequest) {
    return this.write(request.householdId, `VER#${request.checkId}#${request.requestId}`, request, {
      own: seconds(request.sentAt) + RECORD_SECONDS,
      gsi1pk: `TOKEN#${request.replyTokenHash}`,
    });
  }

  listHeadsUps(householdId: string, checkId: string) {
    return this.many<HeadsUp>(hh(householdId), `HUP#${checkId}#`);
  }

  putHeadsUp(headsUp: HeadsUp) {
    return this.write(headsUp.householdId, `HUP#${headsUp.checkId}#${headsUp.headsUpId}`, headsUp, {
      own: seconds(headsUp.sentAt) + RECORD_SECONDS,
    });
  }

  // Report summaries

  getReport(householdId: string, checkId: string) {
    return this.one<ReportSummary>(hh(householdId), `REP#${checkId}`);
  }

  putReport(report: ReportSummary) {
    return this.write(report.householdId, `REP#${report.checkId}`, report, {
      own: seconds(report.createdAt) + RECORD_SECONDS,
    });
  }

  // Echo notifications

  async listEvents(householdId: string, options: { unreadOnly?: boolean } = {}) {
    const events = await this.many<DeviceEvent>(hh(householdId), "EVT#");
    return events.filter((event) => !options.unreadOnly || !event.read);
  }

  putEvent(event: DeviceEvent) {
    return this.write(event.householdId, `EVT#${event.at}#${event.eventId}`, event, {
      own: seconds(event.at) + EVENT_SECONDS,
    });
  }

  async markEventsRead(householdId: string, eventIds: string[]) {
    const wanted = new Set(eventIds);
    const rows = await this.table.query(hh(householdId), "EVT#");
    for (const row of rows) {
      const event = JSON.parse(row.body) as DeviceEvent;
      if (!wanted.has(event.eventId) || event.read) continue;
      await this.table.put({ ...row, body: JSON.stringify({ ...event, read: true }) });
    }
  }

  // Sign in links

  async putSignInLink(link: SignInLink) {
    await this.table.put({
      PK: `LOGIN#${link.tokenHash}`,
      SK: "LOGIN",
      body: JSON.stringify(link),
      expiresAt: link.expiresAt,
    });
  }

  async takeSignInLink(tokenHash: string) {
    const row = await this.table.take({ PK: `LOGIN#${tokenHash}`, SK: "LOGIN" });
    return this.alive(row) ? parse<SignInLink>(row) : undefined;
  }

  // Rate limits

  incrementRate(scope: string, windowSeconds: number) {
    const window = Math.floor(epochSeconds(this.clock.now()) / windowSeconds);
    return this.table.increment(
      { PK: `RATE#${scope}#${window}`, SK: "RATE" },
      (window + 1) * windowSeconds,
    );
  }
}
