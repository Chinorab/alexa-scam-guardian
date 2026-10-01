/** Visual captures of the home page for review (not an assertion suite). */
import { test } from "@playwright/test";

const OUT = process.env.SHOTS_DIR ?? "test-results/shots";

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 960 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`capture home ${name} ${scheme}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/home-${name}-${scheme}.png`, fullPage: true });
    });
  }
}
