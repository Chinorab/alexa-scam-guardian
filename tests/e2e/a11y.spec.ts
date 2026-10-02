/** WCAG 2.2 AA automated checks with axe on every page (SC-007), plus keyboard reach. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { OPENING, caption, openEcho, say } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page, name: string) {
  // Contrast is measured on the settled page, not halfway through a sign fading in.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, `${name} accessibility violations`).toEqual([]);
}

async function familyHome(page: Page) {
  await page.goto("/family/sign-in");
  await page.getByLabel("Your email").fill(`a11y-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await page.getByRole("link", { name: "Open the sign in link" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("First name of the person you are protecting").fill("Ruth");
  await page.getByRole("button", { name: "Continue" }).click();
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test("public pages", async ({ page }) => {
      for (const path of ["/", "/privacy", "/family/sign-in"]) {
        await page.goto(path);
        await expectNoViolations(page, path);
      }
    });

    test("family pages, including a form with errors", async ({ page }) => {
      await familyHome(page);
      await expectNoViolations(page, "family home");
      await page.getByRole("link", { name: "Add a person" }).click();
      await page.getByRole("button", { name: "Add this person" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expectNoViolations(page, "member form with errors");
      await page.goto("/family/activity");
      await expectNoViolations(page, "activity");
      await page.goto("/family/delete-all");
      await expectNoViolations(page, "delete all");
    });

    test("simulated Echo after a turn", async ({ page }) => {
      await openEcho(page);
      await say(page, OPENING);
      await expect(caption(page)).toContainText("Should I text Michael");
      await expectNoViolations(page, "echo");
    });
  });
}

test("the Echo works from the keyboard alone", async ({ page }) => {
  await openEcho(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.getByLabel("Type what you want to say").focus();
  await page.keyboard.type("So can I pay him?");
  await page.keyboard.press("Enter");
  await expect(caption(page)).toContainText("Let's not send any money yet");
});

// SC-007: usable at 200% zoom. A 1280 px window at 200% lays out like 640 px; WCAG 1.4.10
// asks for no sideways scrolling at 320 px. Both widths, every page.
for (const width of [640, 320]) {
  test(`no sideways scrolling at ${width} px (200% zoom and reflow)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const overflow = async (name: string) => {
      const extra = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(extra, `${name} scrolls sideways by ${extra} px`).toBeLessThanOrEqual(0);
    };
    for (const path of ["/", "/privacy", "/family/sign-in"]) {
      await page.goto(path);
      await overflow(path);
    }
    await openEcho(page);
    await say(page, OPENING);
    await expect(caption(page)).toContainText("Should I text Michael");
    await overflow("/echo after a turn");
    await familyHome(page);
    await overflow("family home");
    await page.getByRole("link", { name: "Add a person" }).click();
    await overflow("member form");
  });
}
