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
} from "./index";

const clone = <T>(value: T): T => structuredClone(value);

/** In memory Store for local runs and tests. Honors the same TTLs as DynamoDB would. */
export class MemoryStore implements Store {
  private households = new Map<string, Household>();
  private members = new Map<string, FamilyMember>();
  private passwords = new Map<string, FamilyPassword>();
  private checks = new Map<string, Check>();
  private pendings = new Map<string, PendingAction>();
  private verifications = new Map<string, VerificationRequest>();
  private headsUps = new Map<string, HeadsUp>();
  private reports = new Map<string, ReportSummary>();
  private events = new Map<string, DeviceEvent>();
  private signIns = new Map<string, SignInLink>();
  private rates = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly clock: Clock = systemClock) {}

  private alive(expiresAt: number | undefined): boolean {
    return expiresAt === undefined || expiresAt > epochSeconds(this.clock.now());
  }

  private key(...parts: string[]): string {
    return parts.join("#");
  }

  private scoped<T extends { householdId: string }>(map: Map<string, T>, householdId: string): T[] {
    return [...map.values()].filter((item) => item.householdId === householdId).map(clone);
  }

  async getHousehold(householdId: string) {
    const household = this.households.get(householdId);
    return household && this.alive(household.expiresAt) ? clone(household) : undefined;
  }

  async findHouseholdByEmail(email: string) {
    const target = email.toLowerCase();
    const found = [...this.households.values()].find(
      (h) => h.organizerEmail === target && this.alive(h.expiresAt),
    );
    return found && clone(found);
  }

  async putHousehold(household: Household) {
    this.households.set(household.householdId, clone(household));
  }

  async deleteHousehold(householdId: string) {
    this.households.delete(householdId);
    this.passwords.delete(householdId);
    const maps: Map<string, { householdId: string }>[] = [
      this.members,
      this.checks,
      this.pendings,
      this.verifications,
      this.headsUps,
      this.reports,
      this.events,
    ];
    for (const map of maps) {
      for (const [key, item] of map) if (item.householdId === householdId) map.delete(key);
    }
  }

  async listMembers(householdId: string) {
    return this.scoped(this.members, householdId).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getMember(householdId: string, memberId: string) {
    const member = this.members.get(this.key(householdId, memberId));
    return member && clone(member);
  }

  async putMember(member: FamilyMember) {
    this.members.set(this.key(member.householdId, member.memberId), clone(member));
  }

  async deleteMember(householdId: string, memberId: string) {
    this.members.delete(this.key(householdId, memberId));
  }

  async getPassword(householdId: string) {
    const password = this.passwords.get(householdId);
    return password && clone(password);
  }

  async putPassword(password: FamilyPassword) {
    this.passwords.set(password.householdId, clone(password));
  }

  async deletePassword(householdId: string) {
    this.passwords.delete(householdId);
  }

  async getCheck(householdId: string, checkId: string) {
    const check = this.checks.get(this.key(householdId, checkId));
    return check && this.alive(check.expiresAt) ? clone(check) : undefined;
  }

  async listChecks(householdId: string) {
    return this.scoped(this.checks, householdId)
      .filter((check) => this.alive(check.expiresAt))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async putCheck(check: Check) {
    this.checks.set(this.key(check.householdId, check.checkId), clone(check));
  }

  async getPending(householdId: string, pendingId: string) {
    const pending = this.pendings.get(this.key(householdId, pendingId));
    return pending && this.alive(pending.expiresAt) ? clone(pending) : undefined;
  }

  async putPending(pending: PendingAction) {
    this.pendings.set(this.key(pending.householdId, pending.pendingId), clone(pending));
  }

  async deletePending(householdId: string, pendingId: string) {
    this.pendings.delete(this.key(householdId, pendingId));
  }

  async listVerifications(householdId: string, checkId: string) {
    return this.scoped(this.verifications, householdId)
      .filter((request) => request.checkId === checkId)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async findVerificationByToken(tokenHash: string) {
    const found = [...this.verifications.values()].find(
      (request) => request.replyTokenHash === tokenHash,
    );
    return found && clone(found);
  }

  async putVerification(request: VerificationRequest) {
    this.verifications.set(this.key(request.householdId, request.requestId), clone(request));
  }

  async listHeadsUps(householdId: string, checkId: string) {
    return this.scoped(this.headsUps, householdId).filter((item) => item.checkId === checkId);
  }

  async putHeadsUp(headsUp: HeadsUp) {
    this.headsUps.set(this.key(headsUp.householdId, headsUp.headsUpId), clone(headsUp));
  }

  async getReport(householdId: string, checkId: string) {
    const report = this.reports.get(this.key(householdId, checkId));
    return report && clone(report);
  }

  async putReport(report: ReportSummary) {
    this.reports.set(this.key(report.householdId, report.checkId), clone(report));
  }

  async listEvents(householdId: string, options: { unreadOnly?: boolean } = {}) {
    return this.scoped(this.events, householdId)
      .filter((event) => !options.unreadOnly || !event.read)
      .sort((a, b) => a.at.localeCompare(b.at));
  }

  async putEvent(event: DeviceEvent) {
    this.events.set(this.key(event.householdId, event.eventId), clone(event));
  }

  async markEventsRead(householdId: string, eventIds: string[]) {
    for (const eventId of eventIds) {
      const event = this.events.get(this.key(householdId, eventId));
      if (event) event.read = true;
    }
  }

  async putSignInLink(link: SignInLink) {
    this.signIns.set(link.tokenHash, clone(link));
  }

  async takeSignInLink(tokenHash: string) {
    const link = this.signIns.get(tokenHash);
    this.signIns.delete(tokenHash);
    return link && this.alive(link.expiresAt) ? link : undefined;
  }

  async incrementRate(scope: string, windowSeconds: number) {
    const now = epochSeconds(this.clock.now());
    const window = Math.floor(now / windowSeconds);
    const key = this.key(scope, String(window));
    const current = this.rates.get(key);
    const count = (current && this.alive(current.expiresAt) ? current.count : 0) + 1;
    this.rates.set(key, { count, expiresAt: (window + 1) * windowSeconds });
    return count;
  }
}
