import { defineConfig } from "vitest/config";

// Live red team only: calls Bedrock, so it is never part of `pnpm test`.
export default defineConfig({
  test: {
    include: ["redteam/live.test.ts"],
    sequence: { concurrent: false },
  },
});
