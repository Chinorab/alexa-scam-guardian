/** WCAG 2.2 AA automated checks with axe on every page (SC-007), plus keyboard reach. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { OPENING, caption, openEcho, say, tapOnPhone } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);

/**
 * MCP Apps cards run in sandboxed frames that a page scan does not enter, so axe is injected
 * into each card's own document. Returns the frames checked, by title.
 */
async function expectCardsAccessible(page: Page): Promise<string[]> {
  const checked: string[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    // Signs rise one after another; measure contrast once they have settled.
    await frame.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    );
    await frame.evaluate(axeSource);
    const { title, violations } = await frame.evaluate(async (tags) => {
      type Violation = { id: string; nodes: { target: string[] }[] };
      type Axe = { run: (...args: unknown[]) => Promise<{ violations: Violation[] }> };
      const axe = (window as unknown as { axe: Axe }).axe;
      const result = await axe.run(document, { runOnly: tags });
      return {
        title: document.title,
        violations: result.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      };
    }, TAGS);
    expect(violations, `${title} card accessibility violations`).toEqual([]);
    checked.push(title);
  }
  return checked;
}

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
  // A deployed site sends sign in links by email only: use the public demo family there.
  if (process.env.E2E_BASE_URL) {
    await page.goto("/family/sign-in");
    await page.getByRole("button", { name: "Open a demo family" }).click();
    await expect(page.getByText("Demo family.")).toBeVisible();
    return;
  }
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

test("MCP Apps cards on the Echo screen meet WCAG 2.2 AA", async ({ page }) => {
  await openEcho(page);
  await say(page, OPENING);
  await expect(caption(page)).toContainText("Should I text Michael");
  await expect(async () => {
    expect(await expectCardsAccessible(page)).toContain("Warning signs");
  }).toPass({ timeout: 15_000 });
  await say(page, "Yes");
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
  await tapOnPhone(page, "Michael", "It wasn't me");
  await expect(caption(page)).toContainText("Michael says he did not call you", {
    timeout: 10_000,
  });
  await expect(async () => {
    expect(await expectCardsAccessible(page)).toContain("Check status");
  }).toPass({ timeout: 15_000 });
  await say(page, "Yes");
  await expect(caption(page)).toContainText("summary on the screen");
  await expect(async () => {
    expect(await expectCardsAccessible(page)).toContain("Report summary");
  }).toPass({ timeout: 15_000 });
});

test("money already sent: the card says so, never no warning signs, and meets WCAG 2.2 AA", async ({
  page,
}) => {
  await openEcho(page);
  await say(page, "I already bought the cards and read him the numbers.");
  await expect(caption(page)).toContainText("Call the company that sold the gift card");
  await expect(async () => {
    const card = page.frames().find((f) => f !== page.mainFrame());
    expect(await card?.locator("body").innerText()).toMatch(/money already sent/i);
    expect(await card?.locator("body").innerText()).not.toMatch(/no common warning signs/i);
    expect(await expectCardsAccessible(page)).toContain("Warning signs");
  }).toPass({ timeout: 15_000 });
});

test("the pages a relative opens on a phone meet WCAG 2.2 AA", async ({ page }) => {
  await openEcho(page);
  await say(page, OPENING);
  await say(page, "Yes");
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
  const deviceId = await page.evaluate(() => sessionStorage.getItem("scam-guardian-device"));
  const phone = (await (await page.request.get(`/api/device/${deviceId}/demo-phone`)).json()) as {
    messages: { to: string; body: string; replyPath?: string }[];
  };
  const toMichael = phone.messages.find((m) => m.to === "Michael");
  const stopPath = toMichael?.body.match(/\/stop\/\S+/)?.[0];
  expect(toMichael?.replyPath).toBeTruthy();
  expect(stopPath).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(toMichael!.replyPath!);
    await expectNoViolations(page, `reply page, ${scheme}`);
    await page.goto(stopPath!);
    await expectNoViolations(page, `stop page, ${scheme}`);
  }
  await page.goto(toMichael!.replyPath!);
  await page.getByRole("button", { name: "It wasn't me" }).click();
  await expectNoViolations(page, "reply page after answering");
});

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
