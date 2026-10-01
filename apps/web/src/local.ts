/** Local web app on port 8787, with the MCP server mounted at /mcp on the same origin. */
import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { newId } from "@asg/core/ids";
import { createLogger } from "@asg/core/log/logger";
import { MemoryStore } from "@asg/core/ports/memory-store";
import { Outbox } from "@asg/core/ports/outbox";
import { systemClock } from "@asg/core/ports/index";
import { createWebApp } from "./app";

const port = Number(process.env.WEB_PORT ?? 8787);
const outbox = new Outbox();

const app = createWebApp({
  deps: {
    store: new MemoryStore(),
    mailer: outbox,
    textChannel: outbox,
    clock: systemClock,
    newId: () => newId("check"),
    logger: createLogger({ strict: true }),
    webUrl: process.env.WEB_URL ?? `http://localhost:${port}`,
    tokenSecret: process.env.HOUSEHOLD_TOKEN_SECRET || randomBytes(32).toString("base64url"),
  },
  mountMcp: true,
  staticFiles: [serveStatic({ root: "./dist" }), serveStatic({ root: "./public" })],
});

serve({ fetch: app.fetch, port }, () => {
  console.warn(`Web app on http://localhost:${port} (MCP at /mcp)`);
});
