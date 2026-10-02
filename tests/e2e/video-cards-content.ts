/**
 * The video cards and the Devpost cover, in the product's own road sign style. One definition
 * serves the still images (pnpm video:cards) and the animated cards of the video
 * (pnpm video:motion): `motion` is the extra CSS that plays once the page adds `.go` to body.
 */
export const ARROW =
  '<svg class="signpost-arrow" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 21h22.5l-8.8-8.8 4.6-4.6L43 24.3 26.3 41l-4.6-4.6 8.8-8.8H8z"/></svg>';

export const SIGNPOST = `
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

export const BASE = `
  .card { position: fixed; inset: 0; display: grid; background: var(--ground); color: var(--ink);
    font-family: var(--font-text); padding: 96px 120px; box-sizing: border-box; }
  .card h1 { font-family: var(--font-sign); font-weight: 800; letter-spacing: -0.02em; margin: 0; }
  .eyebrow-card { font-family: var(--font-sign); font-weight: 750; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-muted); font-size: 28px; margin: 0 0 24px; }
  .sub { font-size: 40px; color: var(--ink-muted); margin: 32px 0 0; max-width: 28ch; line-height: 1.35; }
  .signpost-diamond span { font-size: 1.32em; }
`;

/** Stills show the finished signs; the animated cards let the home page motion play. */
export const STILL = `.signpost > *, .signpost > *::after { animation: none !important; }`;

/**
 * Motion vocabulary of the cards, the same as the site: a confident ease out, things settle
 * into place, the signs catch the headlights once. Nothing moves before body gets `.go`.
 */
export const MOTION_BASE = `
  body:not(.go) * { animation-play-state: paused !important; }
  .in { animation: card-in 640ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .fade { animation: card-fade 700ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .wipe { animation: card-wipe 1100ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes card-in { from { opacity: 0; translate: 0 28px; } }
  @keyframes card-fade { from { opacity: 0; } }
  @keyframes card-wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
`;

export const HD = { width: 1920, height: 1080 };

export interface Card {
  file: string;
  size: { width: number; height: number };
  theme: "light" | "asphalt";
  html: string;
  css?: string;
  /** Animated version for the video: extra CSS and its length in seconds. */
  motion?: { css: string; seconds: number };
}

const delay = (selector: string, ms: number) => `${selector} { animation-delay: ${ms}ms; }`;

export const CARDS: Card[] = [
  {
    file: "01-cold-open.png",
    size: HD,
    theme: "asphalt",
    html: `<div class="card" style="place-items:center;text-align:center;background:#000">
      <p style="font-size:64px;line-height:1.3;max-width:24ch;margin:0;color:#f4f5f2"><span class="fade line-1">Ruth just hung up.</span><br><span class="fade line-2">The caller said he was her grandson.</span></p>
    </div>`,
    motion: { seconds: 3.5, css: delay(".line-1", 200) + delay(".line-2", 1300) },
  },
  {
    file: "02-title.png",
    size: HD,
    theme: "light",
    html: `<div class="card" style="grid-template-columns:1.3fr 1fr;align-items:center;gap:64px">
      <div>
        <p class="eyebrow-card in t-1"><span class="sign-diamond"></span> Amazon Developer Hackathon, Alexa+ track</p>
        <h1 class="in t-2" style="font-size:132px;line-height:1">Scam Guardian<br>for Alexa+</h1>
        <p class="sub fade t-3">The moment right after a scary call: hang up, ask Alexa, check with family.</p>
      </div>
      ${SIGNPOST}
    </div>`,
    motion: { seconds: 4.6, css: delay(".t-1", 100) + delay(".t-2", 220) + delay(".t-3", 900) },
  },
  {
    file: "03-why.png",
    size: HD,
    theme: "light",
    html: `<div class="card" style="align-content:center">
      <p class="eyebrow-card fade w-1">2025, people aged 60 and over</p>
      <h1 class="wipe w-2" style="font-size:120px;line-height:1.05;max-width:16ch">$7.7 billion in losses reported to the FBI.</h1>
      <p class="sub fade w-3" style="max-width:none;font-size:34px">Source: FBI Internet Crime Complaint Center, 2025 IC3 Annual Report, complaints by age group.</p>
    </div>`,
    motion: { seconds: 8.6, css: delay(".w-1", 150) + delay(".w-2", 450) + delay(".w-3", 1700) },
  },
  {
    file: "04-architecture.png",
    size: HD,
    theme: "asphalt",
    html: `<div class="card" style="align-content:center;gap:48px">
      <h1 class="in a-0" style="font-size:64px">How it is built</h1>
      <div class="arch">
        <div class="box in a-1"><b>Simulated Echo Show</b><span>speech, captions, MCP Apps cards</span></div>
        <div class="link wipe a-2">${ARROW}</div>
        <div class="box in a-3"><b>Web app on Lambda</b><span>redaction, rules for what must be exact, Claude Haiku 4.5 on Bedrock for open questions, one output guard</span></div>
        <div class="link wipe a-4">${ARROW}</div>
        <div class="box guide in a-5"><b>MCP server on Lambda</b><span>8 tools, Streamable HTTP, safety rules inside the tools</span></div>
      </div>
      <div class="services">
        <span class="in s-1">DynamoDB</span><span class="in s-2">SES</span><span class="in s-3">Polly</span><span class="in s-4">Bedrock</span><span class="in s-5">Secrets Manager</span><span class="in s-6">CDK</span>
      </div>
    </div>`,
    css: `.arch { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 24px; }
     .box { position: relative; overflow: hidden; display: grid; gap: 12px; padding: 36px; border-radius: 14px; background: var(--ground-raised);
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
    motion: {
      seconds: 14.4,
      // In the order the narration names them: the server and its tools, then the rules and
      // the model, then the AWS services underneath.
      css:
        delay(".a-0", 100) +
        delay(".a-1", 400) +
        delay(".a-2", 900) +
        delay(".a-3", 1200) +
        delay(".a-4", 1700) +
        delay(".a-5", 2000) +
        `.box.guide::after { content: ""; position: absolute; inset: 0; pointer-events: none;
           background: var(--glint) no-repeat; background-size: 260% 100%; opacity: 0;
           animation: headlights 1100ms cubic-bezier(0.16, 1, 0.3, 1) 2700ms both; }` +
        [1, 2, 3, 4, 5, 6].map((i) => delay(`.s-${i}`, 6200 + i * 140)).join(""),
    },
  },
  {
    file: "05-closing.png",
    size: HD,
    theme: "light",
    html: `<div class="card" style="place-items:center;text-align:center;align-content:center;gap:48px">
      <a class="guide-link closing-sign" style="font-size:1.6rem"><span class="signpost-small">Next step</span>
        <span class="guide-link-legend" style="font-size:88px">Try the Echo demo ${ARROW}</span></a>
      <p class="fade c-1" style="font-size:40px;margin:0">github.com/Chinorab/alexa-scam-guardian</p>
      <p class="sub fade c-2" style="margin:0;max-width:none">Hang up. Ask Alexa. Check with family.</p>
    </div>`,
    motion: {
      seconds: 9.2,
      css:
        `.closing-sign { animation: card-in 640ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both; }
         .closing-sign::after { animation: headlights 1100ms cubic-bezier(0.16, 1, 0.3, 1) 900ms both; }` +
        delay(".c-1", 1300) +
        // The tagline arrives when the narrator says it.
        delay(".c-2", 5600),
    },
  },
  {
    file: "devpost-cover.png",
    size: { width: 1500, height: 1000 },
    theme: "light",
    html: `<div class="card" style="grid-template-columns:1.2fr 1fr;align-items:center;gap:48px;padding:80px">
      <div>
        <p class="eyebrow-card" style="font-size:24px"><span class="sign-diamond"></span> For Alexa+</p>
        <h1 style="font-size:104px;line-height:1">Scam Guardian</h1>
        <p class="sub" style="font-size:36px">Check the call before you send money.</p>
      </div>
      ${SIGNPOST.replace("font-size:1.6rem", "font-size:1.3rem")}
    </div>`,
  },
];
