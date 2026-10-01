/** ui://guardian/warning-signs: the signs found in a described call, each with its source. */
import { DIAMOND, escapeHtml, runView, type Structured } from "./shared";

interface Sign {
  id: string;
  label: string;
  explanation: string;
  source?: { publisher: string; label: string; url: string };
}

function render(data: Structured): string {
  const signs = (Array.isArray(data.matchedSigns) ? data.matchedSigns : []) as Sign[];
  if (data.danger === true) {
    return `<section class="sign-panel stop"><h1>Call 911 if you feel unsafe</h1><p>Do not open the door. Do not hand over money.</p></section>`;
  }
  if (signs.length === 0) {
    return `<section class="sign-panel guide"><h1>No common warning signs</h1><p>Still check with the person on a number you know before you send money.</p></section>`;
  }
  const items = signs
    .slice(0, 4)
    .map(
      (sign) => `<li class="sign">
  ${DIAMOND}
  <div>
    <h2>${escapeHtml(sign.label)}</h2>
    <p>${escapeHtml(sign.explanation)}</p>
    ${sign.source ? `<p class="source">Source: ${escapeHtml(sign.source.label)}</p>` : ""}
  </div>
</li>`,
    )
    .join("");
  return `<h1 class="title">Warning signs</h1><ul class="signs">${items}</ul>`;
}

runView("warning-signs", render);
