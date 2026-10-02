/** Visual captures for review (not an assertion suite). Run: node e2e/run.mjs capture */
import { test } from "@playwright/test";
import { OPENING, caption, openEcho, say, tapOnPhone } from "./helpers";
import { expect } from "@playwright/test";

const OUT = process.env.SHOTS_DIR ?? "test-results/shots";

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test(`capture ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openEcho(page);
    await page.screenshot({ path: `${OUT}/${name}-1-idle.png`, fullPage: true });
    await say(page, OPENING);
    await expect(caption(page)).toContainText("Should I text Michael");
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}-2-signs.png`, fullPage: true });
    await say(page, "Yes");
    await expect(caption(page)).toContainText("I'll tell you when Michael answers");
    await tapOnPhone(page, "Michael", "It wasn't me");
    await expect(caption(page)).toContainText("Michael says he did not call you", {
      timeout: 10_000,
    });
    await page.waitForTimeout(900);
    // Clicking scrolled the phone to Michael's message; show the phone from the top.
    await page.evaluate(() => document.querySelector(".demo-phone-screen")?.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/${name}-3-denied.png`, fullPage: true });
  });
}
