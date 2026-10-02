/**
 * Quickstart V1 to V4 in a real browser (typed input, mocked speech output).
 */
import { expect, test } from "@playwright/test";
import { OPENING, caption, openEcho, say, tapOnPhone } from "./helpers";

test("V1: warning signs are spoken and shown on a screen card with sources", async ({ page }) => {
  await openEcho(page);
  await say(page, OPENING);
  await expect(caption(page)).toContainText("common signs of a scam");
  await expect(caption(page)).toContainText("Should I text Michael to check");
  const card = page.frameLocator('iframe[title="Warning signs"]');
  await expect(card.getByText("gift cards", { exact: false }).first()).toBeVisible();
  await expect(card.getByText("Source: FTC consumer advice").first()).toBeVisible();
});

test("V2: check message to Michael, his denial is announced in the open conversation", async ({
  page,
}) => {
  await openEcho(page);
  await say(page, OPENING);
  await expect(caption(page)).toContainText("Should I text Michael");
  await say(page, "Yes");
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
  await tapOnPhone(page, "Michael", "It wasn't me");
  await expect(caption(page)).toContainText("Michael says he did not call you", {
    timeout: 10_000,
  });
});

test("V3: a confirmation still comes with talk before you pay", async ({ page }) => {
  await openEcho(page);
  await say(page, OPENING);
  await say(page, "Yes");
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
  await tapOnPhone(page, "Michael", "It was me");
  await expect(caption(page)).toContainText("Michael says it was him", { timeout: 10_000 });
  await expect(caption(page)).toContainText("call him on the number you know");
});

test("V4: a late reply only lights the bar until the user asks", async ({ page }) => {
  await openEcho(page);
  await say(page, OPENING);
  await say(page, "Yes");
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
  await say(page, "Thank you, bye");
  await expect(caption(page)).toContainText("I'm here if you need me again");
  await tapOnPhone(page, "Michael", "It wasn't me");
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", "notification", {
    timeout: 10_000,
  });
  await expect(caption(page)).toContainText("I'm here if you need me again");
  await say(page, "What's new?");
  await expect(caption(page)).toContainText("Michael says he did not call you");
  await expect(page.getByTestId("light-bar")).not.toHaveAttribute("data-state", "notification");
});

test("repeat replays the last line", async ({ page }) => {
  await openEcho(page);
  await say(page, "The pharmacy called about my refill");
  await expect(caption(page)).toContainText("I didn't hear the common signs");
  await page.getByRole("button", { name: "Repeat" }).click();
  await expect(caption(page)).toContainText("I didn't hear the common signs");
});

test("start over gives a fresh demo family", async ({ page }) => {
  await openEcho(page);
  await say(page, OPENING);
  await say(page, "Yes");
  const phone = page.getByRole("region", { name: "Demo phone" });
  await expect(phone.getByRole("article").first()).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(phone.getByRole("article")).toHaveCount(0);
  await expect(caption(page)).toContainText("Tell me what happened");
});

test("FR-026: opens the Echo's demo family page and keeps the family after coming back", async ({
  page,
}) => {
  await openEcho(page);
  await say(page, OPENING);
  await expect(caption(page)).toContainText("Should I text Michael");
  await page.getByRole("button", { name: "Open Ruth's family page" }).click();
  await expect(page.getByRole("heading", { name: "Ruth's family" })).toBeVisible();
  await expect(page.getByText("Demo family.")).toBeVisible();
  await page.getByRole("link", { name: "See recent checks and report summaries" }).click();
  await expect(page.locator("main")).toContainText("gift cards");
  await page.getByRole("link", { name: "Back to Ruth's family" }).click();
  await page.getByRole("link", { name: "Open Ruth's simulated Echo" }).click();
  await say(page, "Yes");
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
});
