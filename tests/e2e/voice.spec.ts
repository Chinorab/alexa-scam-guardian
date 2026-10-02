/**
 * The voice path (FR-031, FR-017) with a scripted stand in for the browser's speech
 * recognition: the test decides what the microphone "hears", interim and final.
 */
import { expect, test, type Page } from "@playwright/test";
import { OPENING, caption, openEcho } from "./helpers";

/** Installs a controllable SpeechRecognition before the page loads. */
async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    type Handler = ((event: unknown) => void) | null;
    const state: { active?: FakeRecognition; starts: number } = { starts: 0 };
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: Handler = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        state.active = this;
        state.starts++;
      }
      stop() {
        this.abort();
      }
      abort() {
        if (state.active !== this) return;
        state.active = undefined;
        this.onend?.();
      }
    }
    const results = (parts: { text: string; final: boolean }[]) => {
      const list = parts.map((p) => Object.assign([{ transcript: p.text }], { isFinal: p.final }));
      return { results: list };
    };
    Object.assign(window, {
      SpeechRecognition: FakeRecognition,
      __mic: {
        listening: () => state.active !== undefined,
        starts: () => state.starts,
        interim(text: string) {
          state.active?.onresult?.(results([{ text, final: false }]));
        },
        say(text: string) {
          const active = state.active;
          if (!active) throw new Error("the microphone is not listening");
          active.onresult?.(results([{ text, final: true }]));
          state.active = undefined;
          active.onend?.();
        },
        fail() {
          const active = state.active;
          state.active = undefined;
          active?.onerror?.();
        },
      },
    });
  });
}

interface Mic {
  listening(): boolean;
  starts(): number;
  interim(text: string): void;
  say(text: string): void;
  fail(): void;
}

test.beforeEach(async ({ page }) => {
  await fakeMicrophone(page);
  await openEcho(page);
});

test("the main scenario by voice, listening again after a question", async ({ page }) => {
  await page.getByRole("button", { name: "Talk" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.listening()))
    .toBe(true);
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", "listening");

  await page.evaluate((text) => (window as unknown as { __mic: Mic }).__mic.say(text), OPENING);
  await expect(caption(page)).toContainText("Should I text Michael");
  await expect(page.getByText(`You said: ${OPENING}`)).toBeVisible();

  // The question expects an answer, and the last input was voice: the microphone reopens.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.listening()))
    .toBe(true);
  await page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.say("Yes"));
  await expect(caption(page)).toContainText("I'll tell you when Michael answers");
});

test("a card number is stopped while it is still being said", async ({ page }) => {
  await page.getByRole("button", { name: "Talk" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.listening()))
    .toBe(true);
  await page.evaluate(() =>
    (window as unknown as { __mic: Mic }).__mic.interim(
      "my card number is four one two two three three",
    ),
  );
  // While it is being said, the screen never shows the number back.
  await expect(page.getByText(/You said: .*(4 1 2 2|four one two two)/)).toHaveCount(0);
  await expect(caption(page)).toContainText("Let me stop you there", { timeout: 5_000 });
  // The microphone was closed before the rest of the number, and nothing was sent as a turn.
  expect(await page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.listening())).toBe(
    false,
  );
  await expect(page.getByText(/You said: .*4/)).toHaveCount(0);
});

test("a microphone error leaves the Echo ready", async ({ page }) => {
  await page.getByRole("button", { name: "Talk" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.listening()))
    .toBe(true);
  await page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.fail());
  await expect(page.getByTestId("light-bar")).toHaveAttribute("data-state", "idle");
  await expect(page.getByRole("button", { name: "Talk" })).toBeEnabled();
  await page.getByRole("button", { name: "Talk" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mic: Mic }).__mic.starts()))
    .toBe(2);
});
