/** Placeholder views until the bundled MCP Apps HTML lands (T045). */
export const VIEWS = {
  warningSigns: () => '<!doctype html><html lang="en"><body></body></html>',
};

export type ViewKey = keyof typeof VIEWS;
