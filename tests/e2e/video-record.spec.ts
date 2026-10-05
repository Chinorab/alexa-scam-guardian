/**
 * Demo video, step 2: records the Echo beats of docs/demo-script.md on the site, one video per
 * segment, with a timeline of what Ruth said and what Alexa said, to the millisecond.
 *   VIDEO_RECORD=1 E2E_BASE_URL=https://... node e2e/run.mjs video-record
 * Ruth types at the pace of her recorded voice (video-out/voices.json); Alexa speaks with the
 * product's own Polly voice, so every wait in the recording is real. Never part of the test run.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { caption, tapOnPhone } from "./helpers";

test.skip(!process.env.VIDEO_RECORD, "only with the video build");

const OUT = resolve(import.meta.dirname, "../../video-out");
const RAW = join(OUT, "raw");
/** Full HD, the page at 76% so the whole Echo and the demo phone fit without scrolling. */
const DESKTOP = { width: 1920, height: 1080 };
const DESKTOP_ZOOM = "0.76";
const PHONE = { width: 390, height: 844 };

interface Voice {
  id: string;
  text: string;
  seconds: number;
}
const voices: Voice[] = process.env.VIDEO_RECORD
  ? JSON.parse(readFileSync(join(OUT, "voices.json"), "utf8"))
  : [];
const voice = (id: string) => {
  const found = voices.find((v) => v.id === id);
  if (!found) throw new Error(`no voice ${id}`);
  return found;
};

type Event =
  | { t: number; kind: "ruth"; id: string; text: string }
  | { t: number; kind: "alexa"; text: string }
  | { t: number; kind: "mark"; name: string };

/** A recorded page with its own clock: t is milliseconds since the video started. */
async function recorder(browser: Browser, name: string, size: { width: number; height: number }) {
  mkdirSync(RAW, { recursive: true });
  const context = await browser.newContext({
    viewport: size,
    baseURL: test.info().project.use.baseURL,
    recordVideo: { dir: RAW, size },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const started = Date.now();
  const events: Event[] = [];
  const now = () => Date.now() - started;
  // Every new caption, as Alexa shows it.
  await page.exposeFunction("__caption", (text: string) =>
    events.push({ t: now(), kind: "alexa", text }),
  );
  if (size === DESKTOP) {
    // Set through the DOM: the site's CSP rightly refuses injected style sheets.
    await page.addInitScript((zoom) => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.zoom = zoom;
      });
    }, DESKTOP_ZOOM);
  }
  // The burned in captions sit where the footer is: hide it, keeping its space so nothing moves.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const footer = document.querySelector<HTMLElement>(".site-footer");
      if (footer) footer.style.visibility = "hidden";
    });
  });
  await page.addInitScript(() => {
    let last = "";
    const watch = () => {
      const node = document.querySelector('[data-testid="caption"]');
      const text = node?.textContent?.trim() ?? "";
      if (text && text !== last) {
        last = text;
        (window as unknown as { __caption: (t: string) => void }).__caption(text);
      }
    };
    new MutationObserver(watch).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  return {
    page,
    mark: (markName: string) => events.push({ t: now(), kind: "mark", name: markName }),
    async finish() {
      const video = page.video();
      await context.close();
      const path = await video?.path();
      if (!path) throw new Error("no video");
      const file = join(RAW, `${name}.webm`);
      renameSync(path, file);
      writeFileSync(join(RAW, `${name}.json`), JSON.stringify({ file, events }, null, 2));
    },
    events,
    now,
  };
}

/** Ruth says a line: typed while her voice plays, sent when she has finished. */
async function ruth(
  rec: Awaited<ReturnType<typeof recorder>>,
  id: string,
  expected: string | RegExp,
) {
  const line = voice(id);
  const page = rec.page;
  const field = page.getByLabel("Type what you want to say");
  await field.click();
  rec.events.push({ t: rec.now(), kind: "ruth", id, text: line.text });
  const typing = Math.min(25, Math.floor((line.seconds * 1000) / line.text.length));
  await field.pressSequentially(line.text, { delay: typing });
  const left = line.seconds * 1000 - typing * line.text.length;
  if (left > 0) await page.waitForTimeout(left);
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await expect(caption(page)).toContainText(expected, { timeout: 20_000 });
  await idle(page);
}

async function idle(page: Page) {
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", /idle|notification/, {
    timeout: 60_000,
  });
  await page.waitForTimeout(600);
}

async function startOver(rec: Awaited<ReturnType<typeof recorder>>) {
  await rec.page.getByRole("button", { name: "Start over" }).click();
  await expect(caption(rec.page)).toContainText("Tell me what happened", { timeout: 10_000 });
  await rec.page.waitForTimeout(600);
}

async function openEcho(rec: Awaited<ReturnType<typeof recorder>>) {
  await rec.page.goto("/echo");
  await expect(rec.page.getByTestId("light-bar")).toHaveAttribute("data-state", "idle");
  await rec.page.waitForTimeout(1500);
}

test.describe.configure({ mode: "serial" });

test("record: the check, the denial and the report", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const rec = await recorder(browser, "check", DESKTOP);
  await openEcho(rec);
  rec.mark("start");
  await ruth(rec, "r-opening", "Should I text Michael");
  await ruth(rec, "r-yes", "I'll tell you when Michael answers");
  rec.mark("tap");
  await tapOnPhone(rec.page, "Michael", "It wasn't me");
  await expect(caption(rec.page)).toContainText("Michael says he did not call you", {
    timeout: 20_000,
  });
  await idle(rec.page);
  rec.mark("denied");
  await ruth(rec, "r-report", "summary on the screen");
  await rec.page.waitForTimeout(2500);
  rec.mark("end");
  await rec.finish();
});

test("record: the rules it never breaks", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const rec = await recorder(browser, "rules", DESKTOP);
  await openEcho(rec);
  const beats: [string, string][] = [
    ["r-pay", "Let's not send any money yet"],
    ["r-on-line", "You can hang up now"],
    ["r-card", "Let me stop you there"],
    ["r-call-back", "I won't call that number"],
    ["r-door", "call 911"],
  ];
  for (const [id, expected] of beats) {
    await startOver(rec);
    rec.mark(`beat-${id}`);
    await ruth(rec, id, expected);
  }
  await rec.page.waitForTimeout(1000);
  rec.mark("end");
  await rec.finish();
});

test("record: already paid", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const rec = await recorder(browser, "paid", DESKTOP);
  await openEcho(rec);
  rec.mark("start");
  await ruth(rec, "r-paid", "Call the company that sold the gift card");
  await ruth(rec, "r-yes-2", "Elder Fraud Hotline");
  await rec.page.waitForTimeout(2500);
  rec.mark("end");
  await rec.finish();
});

test("record: the family page on a phone", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const rec = await recorder(browser, "family", PHONE);
  // A check first, quietly, so the activity page has one.
  await rec.page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      setTimeout(() => this.dispatchEvent(new Event("ended")), 10);
      return Promise.resolve();
    };
  });
  await rec.page.goto("/echo");
  await rec.page
    .getByLabel("Type what you want to say")
    .fill("My grandson just called. He's in jail and needs gift cards for bail.");
  await rec.page.keyboard.press("Enter");
  await expect(caption(rec.page)).toContainText("Should I text Michael", { timeout: 20_000 });
  await rec.page.getByRole("button", { name: /family page/ }).click();
  await expect(rec.page.getByRole("heading", { name: "Ruth's family" })).toBeVisible();
  await rec.page.waitForTimeout(500);
  rec.mark("start");
  await rec.page.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) {
    await rec.page.mouse.wheel(0, 260);
    await rec.page.waitForTimeout(700);
  }
  await rec.page.waitForTimeout(800);
  await rec.page.goto("/family/activity");
  await expect(rec.page.getByRole("heading", { name: "Recent checks" })).toBeVisible();
  rec.mark("activity");
  await rec.page.waitForTimeout(3500);
  rec.mark("end");
  await rec.finish();
});
