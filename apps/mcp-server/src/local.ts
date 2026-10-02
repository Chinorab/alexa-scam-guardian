/**
 * Standalone local MCP server on port 8788, for MCP Inspector checks. In memory store and
 * outbox; prints a demo household token. The web app also mounts this server in local runs.
 */
import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { mintHouseholdToken } from "@asg/core/auth/household-token";
import { newId } from "@asg/core/ids";
import { createLogger } from "@asg/core/log/logger";
import { MemoryStore } from "@asg/core/ports/memory-store";
import { Outbox } from "@asg/core/ports/outbox";
import { systemClock } from "@asg/core/ports/index";
import { createMcpApp } from "./app";

const port = Number(process.env.MCP_PORT ?? 8788);
const tokenSecret = process.env.HOUSEHOLD_TOKEN_SECRET || randomBytes(32).toString("base64url");
const outbox = new Outbox();

const app = createMcpApp(
  {
    store: new MemoryStore(),
    mailer: outbox,
    textChannel: outbox,
    demoOutbox: outbox,
    clock: systemClock,
    newId: () => newId("check"),
    logger: createLogger({ strict: true }),
    webUrl: process.env.WEB_URL ?? "http://localhost:8787",
    tokenSecret,
  },
  { authorizationServer: process.env.WEB_URL ?? "http://localhost:8787" },
);

serve({ fetch: app.fetch, port }, async () => {
  const token = await mintHouseholdToken({ householdId: "hh_local", kind: "demo" }, tokenSecret);
  console.warn(`MCP server on http://localhost:${port}/mcp`);
  console.warn(`Demo bearer token (15 minutes): ${token}`);
});
