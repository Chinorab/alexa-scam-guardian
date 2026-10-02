/**
 * A report summary as plain facts (FR-019): shown on the family page and offered as text a
 * family member can keep or paste into ReportFraud.ftc.gov or ic3.gov. Nothing is sent.
 */
import { claimedIdentityWords } from "@asg/core/copy/identity";
import type { ReportSummary } from "@asg/core/ports/index";

const CONTACT: Record<string, string> = {
  call: "Phone call",
  voicemail: "Voicemail",
  text: "Text message",
  email: "Email",
};

const METHODS: Record<string, string> = {
  gift_card: "Gift cards",
  wire: "Wire transfer",
  money_order: "Money order",
  money_transfer_app: "Payment app",
  crypto: "Cryptocurrency",
  cash_mail: "Cash by mail",
  cash_courier: "Cash picked up in person",
  bank_transfer: "Bank transfer",
  other: "Other",
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  }) + " Eastern";

const phone = (digits: string) =>
  /^\d{10}$/.test(digits)
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`
    : digits;

export function reportFacts(
  report: ReportSummary,
  olderAdultFirstName: string,
): [string, string][] {
  const f = report.facts;
  const rows: [string, string][] = [
    ["When", time(f.toldAt)],
    ["How", CONTACT[f.contactKind] ?? "Phone call"],
  ];
  if (f.claimedIdentity) {
    rows.push([
      "Caller said they were",
      claimedIdentityWords(f.claimedIdentity, olderAdultFirstName),
    ]);
  }
  if (f.whatWasAsked) rows.push(["They asked for", f.whatWasAsked]);
  if (f.paymentMethod) rows.push(["Already paid by", METHODS[f.paymentMethod] ?? "Other"]);
  if (f.amountText) rows.push(["Amount", f.amountText]);
  if (f.callerNumber) rows.push(["Number they called from", phone(f.callerNumber)]);
  if (f.warningSigns.length > 0) rows.push(["Warning signs", f.warningSigns.join(", ")]);
  return rows;
}

export function reportText(report: ReportSummary, olderAdultFirstName: string): string {
  const lines = [
    `Scam report summary for ${olderAdultFirstName}`,
    "",
    ...reportFacts(report, olderAdultFirstName).map(([label, value]) => `${label}: ${value}`),
    "",
    "Where to report it (nothing was sent to any agency):",
    ...report.links.map(
      (link) =>
        `${link.name}: ${link.whenToUse}${link.phone ? ` Call ${link.phone}${link.hours ? `, ${link.hours}` : ""}.` : ""} ${link.url}`,
    ),
    "",
  ];
  return lines.join("\n");
}
