import { GENERATED_VIEWS } from "./generated/views";

/** Bundled MCP Apps views (scripts/build-views.ts). */
export const VIEWS = {
  warningSigns: () => GENERATED_VIEWS.warningSigns,
};

export type ViewKey = keyof typeof VIEWS;
