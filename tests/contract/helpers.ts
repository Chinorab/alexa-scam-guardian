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
