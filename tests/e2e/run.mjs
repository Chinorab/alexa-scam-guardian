// Runs Playwright with browsers stored on D: on Windows (never C:), default location elsewhere.
import { spawnSync } from "node:child_process";

const env = { ...process.env };
if (process.platform === "win32" && !env.PLAYWRIGHT_BROWSERS_PATH) {
  env.PLAYWRIGHT_BROWSERS_PATH = "D:/Anas/playwright-browsers";
}
const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: true,
});
process.exit(result.status ?? 1);
