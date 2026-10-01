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
            "scripts/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "contract",
          include: ["tests/contract/**/*.test.ts", "tests/redteam/offline.test.ts"],
        },
      },
    ],
    passWithNoTests: true,
  },
});
