/** User story 5: prepare a report, guidance after paying (FR-019, FR-020, FR-021). */
import { afterEach, describe, expect, it } from "vitest";
import { HOUSEHOLD_ID, MICHAEL, SARAH, seededSession } from "./helpers";

type Seeded = Awaited<ReturnType<typeof seededSession>>;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let opened: Seeded | undefined;
afterEach(async () => opened?.session.close());

async function reported(description: string, extraDetails?: string) {
  opened = await seededSession([MICHAEL, SARAH]);
  const assessed = (await opened.session.call("assess_call", { description })).structured as Json;
  const args: Record<string, unknown> = { checkId: assessed.checkId };
  if (extraDetails) args.extraDetails = extraDetails;
  const outcome = await opened.session.call("prepare_report", args);
  return { outcome, report: outcome.structured as Json, checkId: assessed.checkId as string };
}

describe("prepare_report", () => {
  it("is listed with the report screen card and never submits anything", async () => {
    const { report } = await reported(
      "My grandson called from jail, he wants two thousand dollars in gift cards right away",
    );
    const tool = opened?.session.tools.find((t) => t.name === "prepare_report");
    expect(tool?.uiResourceUri).toBe("ui://guardian/report");
    expect(report.submittedBySystem).toBe(false);
  });

  it("summarizes the facts without the older adult's sensitive numbers", async () => {
    const { report } = await reported(
      "He called from 555 123 4567 saying he was my grandson in jail and wants two thousand dollars in gift cards right away",
      "He also asked for my card number 4111 1111 1111 1111",
    );
    expect(report.facts).toMatchObject({
      contactKind: "call",
      claimedIdentity: "grandson",
      whatWasAsked: "Money by gift cards",
      amountText: "two thousand dollars",
      callerNumber: "5551234567",
    });
    expect(report.facts.warningSigns).toEqual(
      expect.arrayContaining(["rush", "emergency story", "gift cards"]),
    );
    expect(JSON.stringify(report)).not.toMatch(/4111/);
  });

  it("links the three official places with when to use each", async () => {
    const { report } = await reported(
      "Someone from the IRS said I owe taxes and must pay in Bitcoin",
    );
    const names = report.links.map((l: Json) => l.name);
    expect(names).toEqual(["ReportFraud.ftc.gov", "ic3.gov", "National Elder Fraud Hotline"]);
    for (const link of report.links) {
      expect(link.whenToUse.length).toBeGreaterThan(10);
      expect(link.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(ftc\.gov|ic3\.gov|ojp\.gov)/);
    }
    expect(report.links[2].phone).toBe("833 372 8311");
  });

  it("stores the summary for the family page", async () => {
    const { checkId } = await reported("My grandson needs bail money in gift cards right away");
    const stored = await opened?.deps.store.getReport(HOUSEHOLD_ID, checkId);
    expect(stored?.submittedBySystem).toBe(false);
  });
});

describe("get_guidance after paying", () => {
  async function guidance(paymentMethod: string) {
    opened = await seededSession();
    return (await opened.session.call("get_guidance", { topic: "already_paid", paymentMethod }))
      .structured as Json;
  }

  it.each([
    ["gift_card", /company that sold the gift card/],
    ["wire", /wire transfer company/],
    ["money_order", /company that issued the money order/],
    ["money_transfer_app", /in the app/],
    ["crypto", /exchange or the coin ATM/],
    ["cash_mail", /Postal Inspection Service/],
    ["cash_courier", /Do not hand over any more cash/],
    ["bank_transfer", /bank or credit union/],
  ])("%s gives the official first step", async (method, step) => {
    const out = await guidance(method);
    expect(out.steps[0]).toMatch(step);
    expect(out.sources.length).toBeGreaterThan(0);
    expect(out.helpResources[0]).toMatchObject({
      name: "National Elder Fraud Hotline",
      phone: "833 372 8311",
    });
  });
});
