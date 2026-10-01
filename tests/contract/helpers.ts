import { mintHouseholdToken } from "@asg/core/auth/household-token";
import { newId } from "@asg/core/ids";
import { createLogger } from "@asg/core/log/logger";
import { MemoryStore } from "@asg/core/ports/memory-store";
import { Outbox } from "@asg/core/ports/outbox";
import type { Clock } from "@asg/core/ports/index";
import { createMcpApp, type Deps } from "@asg/mcp-server";

export const SECRET = "contract-test-secret-0123456789abcdef";

/** A controllable clock for wait times and expiry. */
export function fakeClock(start = new Date("2026-10-05T15:00:00Z")) {
  let now = start.getTime();
  const clock: Clock = { now: () => new Date(now) };
  return { clock, advance: (ms: number) => (now += ms) };
}

export function makeDeps(overrides: Partial<Deps> = {}) {
  const outbox = new Outbox();
  const { clock, advance } = fakeClock();
  const deps: Deps = {
    store: new MemoryStore(clock),
    mailer: outbox,
    textChannel: outbox,
    clock,
    newId: () => newId("check"),
    logger: createLogger({ strict: true, sink: () => {} }),
    webUrl: "https://guardian.test",
    tokenSecret: SECRET,
    ...overrides,
  };
  return { deps, outbox, advance };
}

export function makeApp(deps: Deps) {
  return createMcpApp(deps, { authorizationServer: "https://guardian.test" });
}

export const tokenFor = (householdId: string, kind: "real" | "demo" = "demo") =>
  mintHouseholdToken({ householdId, kind }, SECRET);

import type { FamilyMember, Household } from "@asg/core/ports/index";
import { openMcpSession } from "../../apps/web/src/agent/mcp-client";

export const HOUSEHOLD_ID = "hh_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B";

export function member(
  overrides: Partial<FamilyMember> & Pick<FamilyMember, "name">,
): FamilyMember {
  return {
    memberId: `mem_${overrides.name.toLowerCase()}`,
    householdId: HOUSEHOLD_ID,
    relationship: "other",
    nicknames: [],
    channel: "text",
    phone: "+15555550100",
    canVerify: true,
    getsHeadsUp: false,
    optedOut: false,
    ...overrides,
  };
}

export const MICHAEL = member({ name: "Michael", relationship: "grandson", nicknames: ["Mikey"] });
export const SARAH = member({
  name: "Sarah",
  relationship: "daughter",
  channel: "email",
  email: "sarah@example.com",
  canVerify: false,
  getsHeadsUp: true,
});

/** Seeds a household with members and opens an MCP session to the in process server. */
export async function seededSession(members: FamilyMember[] = [MICHAEL, SARAH]) {
  const made = makeDeps();
  const now = made.deps.clock.now().toISOString();
  const household: Household = {
    householdId: HOUSEHOLD_ID,
    kind: "real",
    olderAdultFirstName: "Ruth",
    waitMinutes: 10,
    createdAt: now,
    updatedAt: now,
  };
  await made.deps.store.putHousehold(household);
  for (const m of members) await made.deps.store.putMember(m);
  const app = makeApp(made.deps);
  const session = await openMcpSession(
    { householdId: HOUSEHOLD_ID, kind: "real" },
    {
      url: "http://mcp.test/mcp",
      tokenSecret: SECRET,
      fetch: (async (input: string | URL | Request, init?: RequestInit) =>
        app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch,
    },
  );
  return { ...made, app, session };
}
