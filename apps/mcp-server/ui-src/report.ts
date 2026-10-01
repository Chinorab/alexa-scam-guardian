/** ui://guardian/report: the facts to report and the official places to report them. */
import { escapeHtml, runView, type Structured } from "./shared";

interface Link {
  name: string;
  url: string;
  whenToUse: string;
  phone?: string;
  hours?: string;
}

const KINDS: Record<string, string> = {
  call: "Phone call",
  voicemail: "Voicemail",
  text: "Text message",
  email: "Email",
};

function time(iso: unknown): string {
  if (typeof iso !== "string") return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function phoneNumber(digits: string): string {
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`
    : digits;
}

function render(data: Structured): string {
  const facts = (data.facts ?? {}) as Record<string, unknown>;
  const links = (Array.isArray(data.links) ? data.links : []) as Link[];
  const rows: [string, string][] = [];
  rows.push(["When", time(facts.toldAt)]);
  rows.push(["How", KINDS[String(facts.contactKind)] ?? "Phone call"]);
  if (facts.claimedIdentity) rows.push(["Caller said they were", String(facts.claimedIdentity)]);
  if (facts.whatWasAsked) rows.push(["They asked for", String(facts.whatWasAsked)]);
  if (facts.amountText) rows.push(["Amount", String(facts.amountText)]);
  if (typeof facts.callerNumber === "string")
    rows.push(["Number they called from", phoneNumber(facts.callerNumber)]);
  const signs = Array.isArray(facts.warningSigns) ? (facts.warningSigns as string[]) : [];
  if (signs.length > 0) rows.push(["Warning signs", signs.join(", ")]);

  return `<h1 class="title">Report summary</h1>
<dl class="facts">${rows
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join("")}</dl>
<h2 class="title">Where to report it</h2>
<ul class="places">${links
    .map(
      (l) =>
        `<li class="place"><h3>${escapeHtml(l.name)}</h3><p>${escapeHtml(l.whenToUse)}</p>${
          l.phone
            ? `<p class="place-phone">Call ${escapeHtml(l.phone)}${l.hours ? `, ${escapeHtml(l.hours)}` : ""}</p>`
            : ""
        }</li>`,
    )
    .join("")}</ul>
<p class="note">Nothing was sent to any agency. You or your family can file it.</p>`;
}

runView("report", render);
