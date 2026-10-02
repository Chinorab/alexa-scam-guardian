import { expect, type Page } from "@playwright/test";

export const OPENING =
  "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.";

/** Speech output is mocked: utterances end at once so the flow never waits on audio. */
export async function openEcho(page: Page) {
  await page.addInitScript(() => {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
      };
    }
  });
  await page.goto("/echo");
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", "idle");
}

export async function say(page: Page, text: string) {
  await page.getByLabel("Type what you want to say").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

export const caption = (page: Page) => page.getByTestId("caption");

export async function tapOnPhone(page: Page, to: string, answer: "It was me" | "It wasn't me") {
  const phone = page.getByRole("region", { name: "Demo phone" });
  const message = phone
    .getByRole("article")
    .filter({ hasText: `To ${to}` })
    .first();
  await message.getByRole("button", { name: answer }).click();
}
