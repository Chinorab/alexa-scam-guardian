/** Visual captures of the family page for review (not an assertion suite). */
import { test } from "@playwright/test";

const OUT = process.env.SHOTS_DIR ?? "test-results/shots";
test.use({ viewport: { width: 390, height: 844 } });

for (const scheme of ["light", "dark"] as const) {
  test(`capture family ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/family/sign-in");
    await page.getByLabel("Your email").fill(`shot-${scheme}-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Email me a link" }).click();
    await page.getByRole("link", { name: "Open the sign in link" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByLabel("First name of the person you are protecting").fill("Ruth");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("link", { name: "Add a person" }).click();
    await page.getByRole("textbox", { name: "First name" }).fill("Michael");
    await page.getByRole("textbox", { name: "Mobile number (US)" }).fill("555 555 0142");
    await page.getByRole("button", { name: "Add this person" }).click();
    await page.screenshot({ path: `${OUT}/family-${scheme}-home.png`, fullPage: true });
    await page.getByRole("link", { name: "Add a person" }).click();
    await page.getByRole("button", { name: "Add this person" }).click();
    await page.screenshot({ path: `${OUT}/family-${scheme}-errors.png`, fullPage: true });
  });
}
