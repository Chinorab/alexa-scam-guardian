import { defineConfig } from "vitest/config";

// One root config; every package and the tests workspace are discovered as projects.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "packages/*/src/**/*.test.ts",
            "apps/*/src/**/*.test.ts",
            "infra/src/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "contract",
          include: [
            "tests/contract/**/*.test.ts",
            "tests/redteam/offline.test.ts",
            "tests/redteam/multiturn.test.ts",
          ],
        },
      },
      {
        // The same contract tests on the DynamoDB store, through an in memory table.
        test: {
          name: "contract-dynamo",
          include: ["tests/contract/**/*.test.ts"],
          exclude: ["tests/contract/store.test.ts"],
          env: { TEST_STORE: "dynamo" },
        },
      },
    ],
    passWithNoTests: true,
  },
});
