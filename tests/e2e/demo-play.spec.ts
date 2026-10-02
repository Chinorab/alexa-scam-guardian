/**
 * Plays docs/demo-script.md on the simulated Echo at a human pace, with the real voice, in a
 * visible browser, so the video can be screen recorded without typing live.
 *   pnpm demo:play                       # local server started for you
 *   E2E_BASE_URL=https://... pnpm demo:play
 * Never part of the normal test run.
 */
import { expect, test, type Page } from "@playwright/test";
import { caption, tapOnPhone } from "./helpers";

test.skip(!process.env.DEMO_PLAY, "only with pnpm demo:play");
test.use({ viewport: { width: 1440, height: 900 } });

/** Types like a person, then waits until the Echo has finished speaking. */
async function speak(page: Page, text: string, expected: string | RegExp) {
  const field = page.getByLabel("Type what you want to say");
  await field.click();
  await field.pressSequentially(text, { delay: 45 });
  await page.keyboard.press("Enter");
  await expect(caption(page)).toContainText(expected, { timeout: 20_000 });
  await idle(page);
}

async function idle(page: Page) {
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", /idle|notification/, {
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);
}

async function startOver(page: Page) {
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(caption(page)).toContainText("Tell me what happened", { timeout: 10_000 });
  await page.waitForTimeout(800);
}

test("demo video run", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  await page.goto("/echo");
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", "idle");
  await page.waitForTimeout(2500);

  // 0:00 to 0:30, the check
  await speak(
    page,
    "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.",
    "Should I text Michael",
  );
  await speak(page, "Yes.", "I'll tell you when Michael answers");
  await page.waitForTimeout(1500);
  await tapOnPhone(page, "Michael", "It wasn't me");
  await expect(caption(page)).toContainText("Michael says he did not call you", {
    timeout: 20_000,
  });
  await idle(page);

  // 1:30, the report, kept next to the check it belongs to
  await speak(page, "Yes, help me report it.", "summary on the screen");
  await page.waitForTimeout(3000);

  // 0:45 to 1:30, the rules it never breaks
  const beats: [string, string][] = [
    ["So can I pay him?", "Let's not send any money yet"],
    ["He's still on the other phone, he says I have to hurry.", "You can hang up now"],
    ["My card number is four one two two three three", "Let me stop you there"],
    ["Call back the number that called me.", "I won't call that number"],
    ["There's a man at my door, he says he's here for the money.", "call 911"],
  ];
  for (const [line, expected] of beats) {
    await startOver(page);
    await speak(page, line, expected);
  }

  // 1:42, already paid
  await startOver(page);
  await speak(
    page,
    "I already bought the cards and read him the numbers.",
    "Call the company that sold the gift card",
  );
  await speak(page, "Yes.", "Elder Fraud Hotline");
  await page.waitForTimeout(3000);
});
