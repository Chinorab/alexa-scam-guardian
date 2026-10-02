/**
 * Households never see each other. A household token only reaches its own checks, even with
 * another household's ids, and a forged family page cookie opens nothing.
 */
import { describe, expect, it } from "vitest";
import type { Household } from "@asg/core/ports/index";
import { createWebApp } from "@asg/web";
import { openMcpSession } from "../../apps/web/src/agent/mcp-client";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { HOUSEHOLD_ID, MICHAEL, SECRET, SESSION, makeApp, makeDeps } from "./helpers";

const OTHER = "hh_01J9ZK3M8Q4R7T2V6X1Y5ZOTHER";

async function twoHouseholds() {
  const made = makeDeps();
  const now = made.deps.clock.now().toISOString();
  for (const householdId of [HOUSEHOLD_ID, OTHER]) {
    const household: Household = {
      householdId,
      kind: "real",
      olderAdultFirstName: "Ruth",
      waitMinutes: 10,
      createdAt: now,
      updatedAt: now,
    };
    await made.deps.store.putHousehold(household);
    await made.deps.store.putMember({
      ...MICHAEL,
      householdId,
      memberId: `${MICHAEL.memberId}_${householdId.slice(-5)}`,
    });
  }
  const app = makeApp(made.deps);
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const open = (householdId: string) =>
    openMcpSession(
      { householdId, kind: "real" },
      { url: "http://mcp.test/mcp", tokenSecret: SECRET, fetch: fetcher },
    );
  return { ...made, mine: await open(HOUSEHOLD_ID), theirs: await open(OTHER) };
}

describe("household isolation", () => {
  it("a token for one household cannot use another household's check", async () => {
    const h = await twoHouseholds();
    const assessed = await h.mine.call("assess_call", {
      description: "My grandson is in jail and needs gift cards.",
    });
    const checkId = String(assessed.structured?.checkId);
    const michael = `${MICHAEL.memberId}_${HOUSEHOLD_ID.slice(-5)}`;

    const attempts = await Promise.all([
      h.theirs.call("get_updates", { checkId }),
      h.theirs.call("prepare_report", { checkId }),
      h.theirs.call("prepare_outreach", { checkId, verifyMemberId: michael }),
      h.theirs.call("check_family_password", { checkId, phraseHeard: "blue river" }),
      h.theirs.call("close_check", { checkId }),
    ]);
    for (const outcome of attempts) {
      const text = JSON.stringify(outcome);
      expect(text).not.toContain("gift cards");
      expect(text).not.toContain(michael);
    }
    const prepared = attempts[2];
    expect(prepared?.isError).toBe(true);
    expect(await h.deps.demoOutbox.list(HOUSEHOLD_ID)).toEqual([]);
    expect((await h.deps.store.getCheck(HOUSEHOLD_ID, checkId))?.state).not.toBe("closed");
  });

  it("a forged or tampered family page cookie opens nothing", async () => {
    const { deps } = makeDeps();
    const app = createWebApp({
      deps,
      sessions: new MemoryDeviceSessions(),
      agent: { mode: "simplified", modelId: "none" },
      mcpUrl: "https://guardian.test/mcp",
      mountMcp: true,
      session: SESSION,
    });
    for (const cookie of [
      `sg_family=${HOUSEHOLD_ID}|${Math.floor(Date.now() / 1000)}`,
      `sg_family=${HOUSEHOLD_ID}%7C1790000000.forgedsignature%3D`,
      "sg_family=",
    ]) {
      const response = await app.request("https://guardian.test/family", {
        headers: { cookie },
        redirect: "manual",
      });
      expect(response.headers.get("location"), cookie).toBe("/family/sign-in");
    }
  });
});
