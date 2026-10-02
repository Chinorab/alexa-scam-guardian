/**
 * Demo video: the animated cards, recorded from the product's own CSS (the home page sign
 * motion included) into video-out/cards/<card>.webm, with the moment the motion starts.
 *   pnpm video:motion
 * Never part of the normal test run.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";
import { BASE, CARDS, MOTION_BASE } from "./video-cards-content";

test.skip(!process.env.VIDEO_MOTION, "only with pnpm video:motion");

const OUT = resolve(import.meta.dirname, "../../video-out/cards");

for (const card of CARDS.filter((c) => c.motion)) {
  test(`animated card ${card.file}`, async ({ browser }) => {
    test.setTimeout(60_000);
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({
      viewport: card.size,
      baseURL: test.info().project.use.baseURL,
      recordVideo: { dir: OUT, size: card.size },
      // The cards are composed in the page itself; the site's CSP would block their styles.
      bypassCSP: true,
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const started = Date.now();
    await page.goto("/privacy");
    await page.evaluate(
      ({ html, css, theme }) => {
        document.body.className = theme === "asphalt" ? "theme-asphalt" : "";
        document.body.innerHTML = `<style>${css}</style>${html}`;
      },
      {
        html: card.html,
        css: BASE + MOTION_BASE + (card.css ?? "") + (card.motion?.css ?? ""),
        theme: card.theme,
      },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    // Restart every animation from zero at the same instant, then let them play.
    const offset = (Date.now() - started) / 1000;
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.currentTime = 0;
      document.body.classList.add("go");
    });
    await page.waitForTimeout((card.motion?.seconds ?? 3) * 1000 + 500);
    const video = page.video();
    await context.close();
    const path = await video?.path();
    if (!path) throw new Error("no video");
    const name = card.file.replace(/\.png$/, "");
    renameSync(path, join(OUT, `${name}.webm`));
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ offset }));
  });
}
