/** ui://guardian/check-status: who was messaged, delivery, waiting time, replies. */
import { escapeHtml, runView, type Structured } from "./shared";

interface Row {
  tone: "guide" | "warning" | "neutral";
  title: string;
  detail: string;
}

function rows(data: Structured): Row[] {
  const out: Row[] = [];
  const sent = (Array.isArray(data.sent) ? data.sent : []) as {
    name: string;
    kind: string;
    delivery: string;
  }[];
  for (const s of sent) {
    out.push(
      s.delivery === "sent"
        ? {
            tone: "guide",
            title: s.kind === "verify" ? `Message sent to ${s.name}` : `${s.name} was told`,
            detail: s.kind === "verify" ? "Waiting for an answer." : "They know you got this call.",
          }
        : {
            tone: "warning",
            title: `Message to ${s.name} did not go through`,
            detail: "Try someone else.",
          },
    );
  }
  if (data.nothingSent === true && sent.length === 0) {
    out.push({
      tone: "neutral",
      title: "Nothing was sent",
      detail: "No message left this device.",
    });
  }
  const updates = (Array.isArray(data.updates) ? data.updates : []) as {
    memberName: string;
    kind: string;
    aboutThemselves?: boolean;
  }[];
  for (const u of updates) {
    // Asked about someone else: the answer is whether the story is true.
    const other = u.aboutThemselves === false;
    if (u.kind === "it_wasnt_me") {
      out.push({
        tone: "warning",
        title: `${u.memberName} says ${other ? "it is not true" : "it was not them"}`,
        detail: "Do not send any money.",
      });
    } else if (u.kind === "it_was_me") {
      out.push({
        tone: "guide",
        title: `${u.memberName} says ${other ? "it is true" : "it was them"}`,
        detail: "Call them on the number you know before sending anything.",
      });
    } else if (u.kind === "no_answer") {
      out.push({
        tone: "neutral",
        title: `No answer from ${u.memberName} yet`,
        detail: "That does not mean something is wrong. Do not send money for now.",
      });
    } else if (u.kind === "delivery_failed") {
      out.push({
        tone: "warning",
        title: `Message to ${u.memberName} did not go through`,
        detail: "Try someone else.",
      });
    }
  }
  const waiting = (Array.isArray(data.waitingOn) ? data.waitingOn : []) as {
    memberName: string;
    minutesWaiting: number;
  }[];
  for (const w of waiting) {
    out.push({
      tone: "neutral",
      title: `Waiting for ${w.memberName}`,
      detail: w.minutesWaiting < 1 ? "Sent just now." : `Sent ${w.minutesWaiting} minutes ago.`,
    });
  }
  return out;
}

function render(data: Structured): string {
  const list = rows(data);
  if (list.length === 0) return `<section class="sign-panel guide"><h1>No news yet</h1></section>`;
  return `<h1 class="title">Check status</h1><ul class="status">${list
    .map(
      (r) =>
        `<li class="status-row ${r.tone}"><h2>${escapeHtml(r.title)}</h2><p>${escapeHtml(r.detail)}</p></li>`,
    )
    .join("")}</ul>`;
}

runView("check-status", render);
