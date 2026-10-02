import data from "../data/patterns.json" with { type: "json" };
import type { Dataset } from "./types";

export type * from "./types";

/** The dataset, typed. Validated in CI by scripts/check-sources.ts. */
export const dataset = data as unknown as Dataset;
