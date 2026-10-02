/**
 * The web app on AWS Lambda behind a Function URL: simulated Echo, family page, reply page.
 * It reaches the MCP server over HTTPS (MCP_URL), like Alexa+ would. Static files ship inside
 * the bundle under ./dist and ./public.
 */
import { handle } from "@hono/aws-lambda";
import { serveStatic } from "@hono/node-server/serve-static";
import { DynamoTable } from "@asg/mcp-server/adapters/table";
import { cloudDeps } from "@asg/mcp-server/lambda";
import { bedrockConverse } from "./agent/bedrock-agent";
import { createWebApp } from "./app";
import { TableDeviceSessions } from "./device/sessions";
import { pollySpeech } from "./routes/tts";

let ready: Promise<ReturnType<typeof handle>> | undefined;

async function build() {
  const deps = await cloudDeps();
  const region = process.env.AWS_REGION ?? "us-east-1";
  const mcpUrl = process.env.MCP_URL;
  if (!mcpUrl) throw new Error("MCP_URL is not set");
  const mode = process.env.AGENT_MODE === "simplified" ? "simplified" : "full";
  const app = createWebApp({
    deps,
    sessions: new TableDeviceSessions(new DynamoTable(process.env.TABLE_NAME ?? "")),
    agent: {
      mode,
      modelId: process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      ...(mode === "full" ? { converse: bedrockConverse(region) } : {}),
    },
    mcpUrl,
    session: { secret: deps.sessionSecret, secure: true },
    // Never show sign in links on screen in the cloud: they only go by email.
    showSignInLink: false,
    emailSignIn: Boolean(process.env.SES_FROM),
    speech: pollySpeech(region, process.env.POLLY_VOICE ?? "Joanna"),
    pollMs: Number(process.env.DEMO_POLL_MS ?? 3000),
    staticFiles: [serveStatic({ root: "./dist" }), serveStatic({ root: "./public" })],
  });
  return handle(app);
}

export const handler: ReturnType<typeof handle> = async (event, context) => {
  ready ??= build().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return (await ready)(event, context);
};
