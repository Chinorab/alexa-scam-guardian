/**
 * Renders the video cards and the Devpost cover in the product's own road sign style, with
 * its real fonts and tokens: pnpm video:cards  ->  docs/video/*.png
 * Never part of the normal test run. The cards themselves live in video-cards-content.ts.
 */
import { test } from "@playwright/test";
import { BASE, CARDS, STILL } from "./video-cards-content";

test.skip(!process.env.VIDEO_CARDS, "only with pnpm video:cards");
// The cards are composed in the page itself; the site's CSP would block their styles.
test.use({ bypassCSP: true });

const OUT = "../docs/video";

test("video cards and Devpost cover", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  for (const card of CARDS) {
    await page.setViewportSize(card.size);
    await page.goto("/privacy");
    await page.evaluate(
      ({ html, css, theme }) => {
        document.body.className = theme === "asphalt" ? "theme-asphalt" : "";
        document.body.innerHTML = `<style>${css}</style>${html}`;
      },
      { html: card.html, css: BASE + STILL + (card.css ?? ""), theme: card.theme },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${card.file}` });
  }
});
