/**
 * The Store contract, run against the in memory store and the DynamoDB store (on an in memory
 * table with DynamoDB's ordering rules). Both must behave the same for every tool.
 */
import { describe, expect, it } from "vitest";
import { MemoryStore } from "@asg/core/ports/memory-store";
import type {
  Check,
  DeviceEvent,
  FamilyMember,
  Household,
  Store,
  VerificationRequest,
} from "@asg/core/ports/index";
import { DynamoStore } from "../../apps/mcp-server/src/adapters/dynamo-store";
import { DynamoOutbox } from "../../apps/mcp-server/src/adapters/dynamo-outbox";
import { MemoryTable } from "../../apps/mcp-server/src/adapters/table";
import { fakeClock } from "./helpers";

const NOW = Date.parse("2026-10-05T15:00:00Z") / 1000;
const iso = (offsetSeconds = 0) => new Date((NOW + offsetSeconds) * 1000).toISOString();

const household = (id: string, extra: Partial<Household> = {}): Household => ({
  householdId: id,
  kind: "real",
  organizerEmail: `${id}@example.com`,
  olderAdultFirstName: "Ruth",
  waitMinutes: 10,
  createdAt: iso(),
  updatedAt: iso(),
  ...extra,
});

const person = (householdId: string, memberId: string, name: string): FamilyMember => ({
  memberId,
  householdId,
  name,
  relationship: "grandson",
  nicknames: [],
  channel: "text",
  phone: "+15555550142",
  canVerify: true,
  getsHeadsUp: false,
  optedOut: false,
});

const check = (householdId: string, checkId: string, createdOffset: number): Check => ({
  checkId,
  householdId,
  state: "assessed",
  description: "a call",
  contactKind: "call",
  matchedSigns: [],
  danger: false,
  passwordAttempts: 0,
  outcome: "unknown",
  createdAt: iso(createdOffset),
  updatedAt: iso(createdOffset),
  expiresAt: NOW + 30 * 86400,
});

const request = (householdId: string, id: string, hash: string): VerificationRequest => ({
  requestId: id,
  householdId,
  checkId: "chk_1",
  memberId: "mem_1",
  channel: "text",
  sentAt: iso(),
  delivery: "sent",
  reply: "none",
  replyTokenHash: hash,
  replyExpiresAt: NOW + 86400,
});

const stores: [string, (clock: ReturnType<typeof fakeClock>["clock"]) => Store][] = [
  ["memory", (clock) => new MemoryStore(clock)],
  ["dynamo", (clock) => new DynamoStore(new MemoryTable(), clock)],
];

describe.each(stores)("%s store", (_name, make) => {
  const setup = () => {
    const { clock, advance } = fakeClock(new Date(NOW * 1000));
    return { store: make(clock), advance };
  };

  it("finds a household by organizer email, in any case", async () => {
    const { store } = setup();
    await store.putHousehold(household("hh_a"));
    expect((await store.findHouseholdByEmail("HH_A@example.com"))?.householdId).toBe("hh_a");
    expect(await store.findHouseholdByEmail("nobody@example.com")).toBeUndefined();
  });

  it("hides a demo household once it expires", async () => {
    const { store, advance } = setup();
    await store.putHousehold(household("hh_demo", { kind: "demo", expiresAt: NOW + 60 }));
    expect(await store.getHousehold("hh_demo")).toBeDefined();
    advance(61_000);
    expect(await store.getHousehold("hh_demo")).toBeUndefined();
  });

  it("lists members by name and deletes one", async () => {
    const { store } = setup();
    await store.putHousehold(household("hh_a"));
    await store.putMember(person("hh_a", "mem_2", "Sarah"));
    await store.putMember(person("hh_a", "mem_1", "Michael"));
    await store.putMember(person("hh_b", "mem_3", "Other"));
    expect((await store.listMembers("hh_a")).map((m) => m.name)).toEqual(["Michael", "Sarah"]);
    await store.deleteMember("hh_a", "mem_1");
    expect((await store.listMembers("hh_a")).map((m) => m.name)).toEqual(["Sarah"]);
  });

  it("lists checks newest first and hides expired pending actions", async () => {
    const { store, advance } = setup();
    await store.putCheck(check("hh_a", "chk_old", 0));
    await store.putCheck(check("hh_a", "chk_new", 60));
    expect((await store.listChecks("hh_a")).map((c) => c.checkId)).toEqual(["chk_new", "chk_old"]);
    await store.putPending({
      pendingId: "pend_1",
      householdId: "hh_a",
      checkId: "chk_new",
      verifyMemberIds: ["mem_1"],
      headsUpMemberIds: [],
      question: "Should I text Michael?",
      expiresAt: NOW + 120,
    });
    expect(await store.getPending("hh_a", "pend_1")).toBeDefined();
    advance(121_000);
    expect(await store.getPending("hh_a", "pend_1")).toBeUndefined();
  });

  it("finds a check message by its reply token hash and records the reply", async () => {
    const { store } = setup();
    await store.putVerification(request("hh_a", "ver_1", "hash-1"));
    const found = await store.findVerificationByToken("hash-1");
    expect(found?.requestId).toBe("ver_1");
    await store.putVerification({ ...found!, reply: "it_wasnt_me", repliedAt: iso(30) });
    expect((await store.listVerifications("hh_a", "chk_1"))[0]?.reply).toBe("it_wasnt_me");
    expect(await store.findVerificationByToken("hash-2")).toBeUndefined();
  });

  it("returns events in time order and marks them read", async () => {
    const { store } = setup();
    const event = (id: string, offset: number): DeviceEvent => ({
      eventId: id,
      householdId: "hh_a",
      checkId: "chk_1",
      kind: "reply_received",
      at: iso(offset),
      read: false,
    });
    await store.putEvent(event("evt_2", 20));
    await store.putEvent(event("evt_1", 10));
    expect((await store.listEvents("hh_a")).map((e) => e.eventId)).toEqual(["evt_1", "evt_2"]);
    await store.markEventsRead("hh_a", ["evt_1"]);
    const unread = await store.listEvents("hh_a", { unreadOnly: true });
    expect(unread.map((e) => e.eventId)).toEqual(["evt_2"]);
  });

  it("uses a sign in link once, and not after 15 minutes", async () => {
    const { store, advance } = setup();
    const link = {
      tokenHash: "t1",
      email: "a@example.com",
      createdAt: iso(),
      expiresAt: NOW + 900,
    };
    await store.putSignInLink(link);
    expect(await store.takeSignInLink("t1")).toEqual(link);
    expect(await store.takeSignInLink("t1")).toBeUndefined();
    await store.putSignInLink({ ...link, tokenHash: "t2" });
    advance(901_000);
    expect(await store.takeSignInLink("t2")).toBeUndefined();
  });

  it("counts within a window and starts over in the next one", async () => {
    const { store, advance } = setup();
    expect(await store.incrementRate("outreach#hh_a", 3600)).toBe(1);
    expect(await store.incrementRate("outreach#hh_a", 3600)).toBe(2);
    expect(await store.incrementRate("outreach#hh_b", 3600)).toBe(1);
    advance(3600_000);
    expect(await store.incrementRate("outreach#hh_a", 3600)).toBe(1);
  });

  it("deletes everything under a household and nothing else", async () => {
    const { store } = setup();
    for (const id of ["hh_a", "hh_b"]) {
      await store.putHousehold(household(id));
      await store.putMember(person(id, `mem_${id}`, "Michael"));
      await store.putPassword({ householdId: id, hash: "h", salt: "s", setAt: iso() });
      await store.putCheck(check(id, `chk_${id}`, 0));
      await store.putVerification(request(id, `ver_${id}`, `hash-${id}`));
    }
    await store.deleteHousehold("hh_a");
    expect(await store.getHousehold("hh_a")).toBeUndefined();
    expect(await store.listMembers("hh_a")).toEqual([]);
    expect(await store.getPassword("hh_a")).toBeUndefined();
    expect(await store.listChecks("hh_a")).toEqual([]);
    expect(await store.findVerificationByToken("hash-hh_a")).toBeUndefined();
    expect(await store.findHouseholdByEmail("hh_a@example.com")).toBeUndefined();
    expect(await store.getHousehold("hh_b")).toBeDefined();
    expect(await store.listMembers("hh_b")).toHaveLength(1);
  });
});

describe("dynamo store expiry", () => {
  it("expires every item of a demo household with it, so nothing outlives the demo", async () => {
    const { clock } = fakeClock(new Date(NOW * 1000));
    const table = new MemoryTable();
    const store = new DynamoStore(table, clock);
    await store.putHousehold(household("hh_demo", { kind: "demo", expiresAt: NOW + 86400 }));
    await store.putMember(person("hh_demo", "mem_1", "Michael"));
    await store.putPassword({ householdId: "hh_demo", hash: "h", salt: "s", setAt: iso() });
    await store.putCheck(check("hh_demo", "chk_1", 0));
    for (const row of table.dump()) expect(row.expiresAt).toBeLessThanOrEqual(NOW + 86400);
  });

  it("keeps check records of a real household 30 days, members without expiry", async () => {
    const { clock } = fakeClock(new Date(NOW * 1000));
    const table = new MemoryTable();
    const store = new DynamoStore(table, clock);
    await store.putHousehold(household("hh_real"));
    await store.putMember(person("hh_real", "mem_1", "Michael"));
    await store.putVerification(request("hh_real", "ver_1", "hash"));
    const rows = table.dump();
    expect(rows.find((r) => r.SK === "MEM#mem_1")?.expiresAt).toBeUndefined();
    expect(rows.find((r) => r.SK.startsWith("VER#"))?.expiresAt).toBe(NOW + 30 * 86400);
  });

  it("never stores a raw reply token, only its hash", async () => {
    const { clock } = fakeClock(new Date(NOW * 1000));
    const table = new MemoryTable();
    await new DynamoStore(table, clock).putVerification(request("hh_a", "ver_1", "hash-only"));
    expect(table.dump()[0]?.GSI1PK).toBe("TOKEN#hash-only");
  });
});

describe("dynamo demo outbox", () => {
  it("shows messages newest first, clears them, and drops them after 24 hours", async () => {
    const { clock, advance } = fakeClock(new Date(NOW * 1000));
    const outbox = new DynamoOutbox(new MemoryTable(), clock);
    await outbox.send({ householdId: "hh_a", memberId: "mem_1", to: "+15555550142", body: "one" });
    advance(1000);
    await outbox.send({
      householdId: "hh_a",
      memberId: "mem_2",
      to: "sarah@example.com",
      subject: "Heads up",
      text: "two",
    });
    expect((await outbox.list("hh_a")).map((m) => m.body)).toEqual(["two", "one"]);
    expect(await outbox.list("hh_b")).toEqual([]);
    // The first message is now 24 hours old, the second one second younger.
    advance(86_399_500);
    expect((await outbox.list("hh_a")).map((m) => m.body)).toEqual(["two"]);
    await outbox.clear("hh_a");
    expect(await outbox.list("hh_a")).toEqual([]);
  });
});
