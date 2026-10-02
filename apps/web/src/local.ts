/** Local web app on port 8787, with the MCP server mounted at /mcp on the same origin. */
import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { newId } from "@asg/core/ids";
import { createLogger } from "@asg/core/log/logger";
import { MemoryStore } from "@asg/core/ports/memory-store";
import { Outbox } from "@asg/core/ports/outbox";
import { systemClock } from "@asg/core/ports/index";
import { bedrockConverse } from "./agent/bedrock-agent";
import { createWebApp } from "./app";
import { MemoryDeviceSessions } from "./device/sessions";
import { pollySpeech } from "./routes/tts";

const port = Number(process.env.WEB_PORT ?? 8787);
const outbox = new Outbox();
const webUrl = process.env.WEB_URL ?? `http://localhost:${port}`;
const mode = process.env.AGENT_MODE === "full" ? "full" : "simplified";
const region = process.env.AWS_REGION ?? "us-east-1";

const app = createWebApp({
  deps: {
    store: new MemoryStore(),
    mailer: outbox,
    textChannel: outbox,
    demoOutbox: outbox,
    clock: systemClock,
    newId: () => newId("check"),
    logger: createLogger({ strict: true }),
    webUrl,
    tokenSecret: process.env.HOUSEHOLD_TOKEN_SECRET || randomBytes(32).toString("base64url"),
  },
  sessions: new MemoryDeviceSessions(),
  agent: {
    mode,
    modelId: process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ...(mode === "full" ? { converse: bedrockConverse(region) } : {}),
  },
  mcpUrl: process.env.MCP_URL ?? `${webUrl}/mcp`,
  mountMcp: true,
  session: {
    secret: process.env.SESSION_SECRET || randomBytes(32).toString("base64url"),
    secure: webUrl.startsWith("https://"),
  },
  showSignInLink: !process.env.SES_FROM,
  ...(process.env.POLLY_VOICE ? { speech: pollySpeech(region, process.env.POLLY_VOICE) } : {}),
  pollMs: Number(process.env.DEMO_POLL_MS ?? 3000),
  staticFiles: [serveStatic({ root: "./dist" }), serveStatic({ root: "./public" })],
});

serve({ fetch: app.fetch, port }, () => {
  console.warn(`Web app on http://localhost:${port} (MCP at /mcp, agent mode ${mode})`);
});
