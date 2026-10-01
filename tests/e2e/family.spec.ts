/**
 * Quickstart V13 and V14 on a phone sized screen (390 px): a family organizer sets up the
 * household, then deletes everything. The local run shows the sign in link on screen.
 */
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

async function signIn(page: Page, email: string) {
  await page.goto("/family");
  await expect(page.getByRole("heading", { name: "Family sign in" })).toBeVisible();
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByRole("link", { name: "Open the sign in link" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function addPerson(
  page: Page,
  person: {
    name: string;
    relationship: string;
    channel: "Text message" | "Email";
    contact: string;
    roles: string[];
  },
) {
  await page.getByRole("link", { name: "Add a person" }).click();
  await page.getByLabel("First name").fill(person.name);
  await page.getByLabel("Relationship to Ruth").selectOption(person.relationship);
  await page.getByRole("radio", { name: person.channel }).check();
  if (person.channel === "Text message") {
    await page.getByRole("textbox", { name: "Mobile number (US)" }).fill(person.contact);
  } else {
    await page.getByRole("textbox", { name: "Email" }).fill(person.contact);
  }
  const confirm = page.getByRole("checkbox", { name: /Confirm a call/ });
  const headsUp = page.getByRole("checkbox", { name: /Get a heads up/ });
  if (person.roles.includes("confirm")) await confirm.check();
  else await confirm.uncheck();
  if (person.roles.includes("heads up")) await headsUp.check();
  else await headsUp.uncheck();
  await page.getByRole("button", { name: "Add this person" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
}

test("V13: set up a relative, a trusted contact and a password, then send a test", async ({
  page,
}) => {
  const started = Date.now();
  await signIn(page, `organizer-${started}@example.com`);

  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await page.getByLabel("First name of the person you are protecting").fill("Ruth");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Ruth's family" })).toBeVisible();

  await addPerson(page, {
    name: "Michael",
    relationship: "grandson",
    channel: "Text message",
    contact: "555 555 0142",
    roles: ["confirm"],
  });
  await addPerson(page, {
    name: "Sarah",
    relationship: "daughter",
    channel: "Email",
    contact: "sarah@example.com",
    roles: ["heads up"],
  });

  await page.getByLabel("Family password", { exact: true }).fill("blue river");
  await page.getByLabel("Type it again").fill("blue river");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("status")).toHaveText("Family password saved.");
  await expect(page.getByText("A family password is set")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("blue river");

  await page.getByRole("button", { name: "Send a test to Michael" }).click();
  await expect(page.getByRole("status")).toHaveText("Test message sent.");

  // SC-005: under five minutes; a scripted run is far below, this guards regressions.
  expect(Date.now() - started).toBeLessThan(5 * 60_000);
});

test("shows what to fix in a form", async ({ page }) => {
  await signIn(page, `errors-${Date.now()}@example.com`);
  await page.getByLabel("First name of the person you are protecting").fill("Ruth");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Add a person" }).click();
  await page.getByLabel("Mobile number (US)").fill("12");
  await page.getByRole("button", { name: "Add this person" }).click();
  const summary = page.getByRole("alert");
  await expect(summary).toContainText("Enter a first name.");
  await expect(summary).toContainText("Enter a US mobile number with 10 digits.");
});

test("V14: delete all household data after typing the first name", async ({ page }) => {
  await signIn(page, `delete-${Date.now()}@example.com`);
  await page.getByLabel("First name of the person you are protecting").fill("Ruth");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Delete all household data" }).click();
  await page.getByLabel("To confirm, type Ruth").fill("Rut");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("Type Ruth to confirm.")).toBeVisible();
  await page.getByLabel("To confirm, type Ruth").fill("Ruth");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByRole("heading", { name: "Everything was deleted" })).toBeVisible();
  await page.goto("/family");
  await expect(page.getByRole("heading", { name: "Family sign in" })).toBeVisible();
});
