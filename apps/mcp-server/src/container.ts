/**
 * The MCP server as a container for Amazon Bedrock AgentCore Runtime (T110): AgentCore
 * expects a stateless Streamable HTTP server on 0.0.0.0:8000 at /mcp. With TABLE_NAME and
 * APP_SECRET_ARN it uses the same DynamoDB, SES and Secrets Manager setup as the Lambda;
 * without them it runs in memory with HOUSEHOLD_TOKEN_SECRET, for a local container check.
 */
import { serve } from "@hono/node-server";
import { newId } from "@asg/core/ids";
import { createLogger } from "@asg/core/log/logger";
import { MemoryStore } from "@asg/core/ports/memory-store";
import { Outbox } from "@asg/core/ports/outbox";
import { systemClock } from "@asg/core/ports/index";
import { createMcpApp } from "./app";
import type { Deps } from "./deps";
import { cloudDeps } from "./lambda";

async function deps(): Promise<Deps> {
  if (process.env.TABLE_NAME && process.env.APP_SECRET_ARN) return cloudDeps();
  const tokenSecret = process.env.HOUSEHOLD_TOKEN_SECRET;
  if (!tokenSecret || tokenSecret.length < 32) {
    throw new Error("Set TABLE_NAME and APP_SECRET_ARN, or HOUSEHOLD_TOKEN_SECRET (32+ chars)");
  }
  const outbox = new Outbox();
  return {
    store: new MemoryStore(),
    mailer: outbox,
    textChannel: outbox,
    demoOutbox: outbox,
    clock: systemClock,
    newId: () => newId("check"),
    logger: createLogger({ strict: false }),
    webUrl: process.env.WEB_URL ?? "http://localhost:8787",
    tokenSecret,
  };
}

const ready = await deps();
const app = createMcpApp(ready, { authorizationServer: ready.webUrl });
const port = Number(process.env.PORT ?? 8000);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.warn(`MCP server on http://0.0.0.0:${port}/mcp`);
});
