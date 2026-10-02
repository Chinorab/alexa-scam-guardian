// Runs Playwright with browsers stored on D: on Windows (never C:), default location elsewhere.
import { spawnSync } from "node:child_process";

const env = { ...process.env };
if (process.platform === "win32" && !env.PLAYWRIGHT_BROWSERS_PATH) {
  env.PLAYWRIGHT_BROWSERS_PATH = "D:/Anas/playwright-browsers";
}
// pnpm demo:play: the scripted demo in a visible browser, at a human pace.
if (process.argv.includes("demo-play")) env.DEMO_PLAY = "1";
if (process.argv.includes("video-cards")) env.VIDEO_CARDS = "1";
const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: true,
});
process.exit(result.status ?? 1);
