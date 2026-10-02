/**
 * Renders the video cards and the Devpost cover in the product's own road sign style, with
 * its real fonts and tokens: pnpm video:cards  ->  docs/video/*.png
 * Never part of the normal test run.
 */
import { test, type Page } from "@playwright/test";

test.skip(!process.env.VIDEO_CARDS, "only with pnpm video:cards");
// The cards are composed in the page itself; the site's CSP would block their styles.
test.use({ bypassCSP: true });

const OUT = "../docs/video";

const ARROW =
  '<svg class="signpost-arrow" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 21h22.5l-8.8-8.8 4.6-4.6L43 24.3 26.3 41l-4.6-4.6 8.8-8.8H8z"/></svg>';

const SIGNPOST = `
<div class="signpost" style="font-size:1.6rem">
  <div class="signpost-diamond"><span>Gift cards<br>for bail</span></div>
  <div class="signpost-guide">
    <span class="signpost-small">Check with</span>
    <span class="signpost-big">Michael ${ARROW}</span>
    <span class="signpost-small">Saved number</span>
  </div>
  <div class="signpost-services"><span>Report</span><span class="signpost-small signpost-pair"><span>FTC</span><span>IC3</span></span></div>
  <div class="signpost-pole"></div>
</div>`;

const BASE = `
  .card { position: fixed; inset: 0; display: grid; background: var(--ground); color: var(--ink);
    font-family: var(--font-text); padding: 96px 120px; box-sizing: border-box; }
  .card h1 { font-family: var(--font-sign); font-weight: 800; letter-spacing: -0.02em; margin: 0; }
  .eyebrow-card { font-family: var(--font-sign); font-weight: 750; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-muted); font-size: 28px; margin: 0 0 24px; }
  .sub { font-size: 40px; color: var(--ink-muted); margin: 32px 0 0; max-width: 28ch; line-height: 1.35; }
  .signpost > * { animation: none !important; }
  .signpost-diamond span { font-size: 1.32em; }
`;

async function render(
  page: Page,
  file: string,
  size: { width: number; height: number },
  theme: "light" | "asphalt",
  html: string,
  css = "",
) {
  await page.setViewportSize(size);
  await page.goto("/privacy");
  await page.evaluate(
    ({ html, css, theme }) => {
      document.body.className = theme === "asphalt" ? "theme-asphalt" : "";
      document.body.innerHTML = `<style>${css}</style>${html}`;
    },
    { html, css: BASE + css, theme },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}` });
}

const HD = { width: 1920, height: 1080 };

test("video cards and Devpost cover", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

  await render(
    page,
    "01-cold-open.png",
    HD,
    "asphalt",
    `<div class="card" style="place-items:center;text-align:center;background:#000">
      <p style="font-size:64px;line-height:1.3;max-width:24ch;margin:0;color:#f4f5f2">Ruth just hung up.<br>The caller said he was her grandson.</p>
    </div>`,
  );

  await render(
    page,
    "02-title.png",
    HD,
    "light",
    `<div class="card" style="grid-template-columns:1.3fr 1fr;align-items:center;gap:64px">
      <div>
        <p class="eyebrow-card"><span class="sign-diamond"></span> Amazon Developer Hackathon, Alexa+ track</p>
        <h1 style="font-size:132px;line-height:1">Scam Guardian<br>for Alexa+</h1>
        <p class="sub">The moment right after a scary call: hang up, ask Alexa, check with family.</p>
      </div>
      ${SIGNPOST}
    </div>`,
  );

  await render(
    page,
    "03-why.png",
    HD,
    "light",
    `<div class="card" style="align-content:center">
      <p class="eyebrow-card">2025, people aged 60 and over</p>
      <h1 style="font-size:120px;line-height:1.05;max-width:16ch">$7.7 billion in losses reported to the FBI.</h1>
      <p class="sub" style="max-width:none;font-size:34px">Source: FBI Internet Crime Complaint Center, 2025 IC3 Annual Report, complaints by age group.</p>
    </div>`,
  );

  await render(
    page,
    "04-architecture.png",
    HD,
    "asphalt",
    `<div class="card" style="align-content:center;gap:48px">
      <h1 style="font-size:64px">How it is built</h1>
      <div class="arch">
        <div class="box"><b>Simulated Echo Show</b><span>speech, captions, MCP Apps cards</span></div>
        <div class="link">${ARROW}</div>
        <div class="box"><b>Web app on Lambda</b><span>redaction, rules for what must be exact, Claude Haiku 4.5 on Bedrock for open questions, one output guard</span></div>
        <div class="link">${ARROW}</div>
        <div class="box guide"><b>MCP server on Lambda</b><span>8 tools, Streamable HTTP, safety rules inside the tools</span></div>
      </div>
      <div class="services">
        <span>DynamoDB</span><span>SES</span><span>Polly</span><span>Bedrock</span><span>Secrets Manager</span><span>CDK</span>
      </div>
    </div>`,
    `.arch { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 24px; }
     .box { display: grid; gap: 12px; padding: 36px; border-radius: 14px; background: var(--ground-raised);
       box-shadow: inset 0 0 0 3px var(--rule); min-height: 260px; align-content: start; }
     .box b { font-family: var(--font-sign); font-size: 38px; }
     .box span { font-size: 28px; color: var(--ink-muted); line-height: 1.35; }
     .box.guide { background: var(--sign-guide); color: #fff; box-shadow: inset 0 0 0 6px var(--sign-guide), inset 0 0 0 10px #fff; }
     .box.guide span { color: #fff; }
     .link .signpost-arrow { width: 56px; height: 56px; fill: var(--ink-muted); }
     .services { display: flex; flex-wrap: wrap; gap: 16px; }
     .services span { font-family: var(--font-sign); font-weight: 800; font-size: 30px; text-transform: uppercase;
       letter-spacing: 0.04em; padding: 14px 24px; border-radius: 10px; background: var(--sign-services); color: #fff;
       box-shadow: inset 0 0 0 4px var(--sign-services), inset 0 0 0 7px #fff; }`,
  );

  await render(
    page,
    "05-closing.png",
    HD,
    "light",
    `<div class="card" style="place-items:center;text-align:center;align-content:center;gap:48px">
      <a class="guide-link" style="font-size:1.6rem"><span class="signpost-small">Next step</span>
        <span class="guide-link-legend" style="font-size:88px">Try the Echo demo ${ARROW}</span></a>
      <p style="font-size:40px;margin:0">github.com/Chinorab/alexa-scam-guardian</p>
      <p class="sub" style="margin:0;max-width:none">Hang up. Ask Alexa. Check with family.</p>
    </div>`,
  );

  // Devpost gallery and thumbnail: 3:2.
  await render(
    page,
    "devpost-cover.png",
    { width: 1500, height: 1000 },
    "light",
    `<div class="card" style="grid-template-columns:1.2fr 1fr;align-items:center;gap:48px;padding:80px">
      <div>
        <p class="eyebrow-card" style="font-size:24px"><span class="sign-diamond"></span> For Alexa+</p>
        <h1 style="font-size:104px;line-height:1">Scam Guardian</h1>
        <p class="sub" style="font-size:36px">Check the call before you send money.</p>
      </div>
      ${SIGNPOST.replace("font-size:1.6rem", "font-size:1.3rem")}
    </div>`,
  );
});
