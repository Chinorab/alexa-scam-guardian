/**
 * The MCP server on AWS Lambda behind a Function URL (Streamable HTTP, stateless). DynamoDB
 * for state, SES for real email, the shared table as the on screen demo phone.
 */
import { handle } from "@hono/aws-lambda";
import { newId } from "@asg/core/ids";
import { createLogger } from "@asg/core/log/logger";
import { systemClock } from "@asg/core/ports/index";
import { loadCloudConfig } from "./adapters/cloud-config";
import { DynamoOutbox } from "./adapters/dynamo-outbox";
import { DynamoStore } from "./adapters/dynamo-store";
import { SesMailer } from "./adapters/ses-mailer";
import { DynamoTable } from "./adapters/table";
import { createMcpApp } from "./app";
import type { Deps } from "./deps";

/** Builds the dependencies every cloud function shares. */
export async function cloudDeps(): Promise<Deps & { sessionSecret: string }> {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error("TABLE_NAME is not set");
  const config = await loadCloudConfig();
  const table = new DynamoTable(tableName);
  const outbox = new DynamoOutbox(table);
  const from = process.env.SES_FROM;
  return {
    store: new DynamoStore(table),
    // Without a verified sender, email falls back to the demo phone.
    mailer: from ? new SesMailer({ from }) : outbox,
    textChannel: outbox,
    demoOutbox: outbox,
    clock: systemClock,
    newId: () => newId("check"),
    // Never throw in production: unsafe values are dropped from the log line instead.
    logger: createLogger({ strict: false }),
    webUrl: config.webUrl,
    tokenSecret: config.tokenSecret,
    sessionSecret: config.sessionSecret,
  };
}

let ready: Promise<ReturnType<typeof handle>> | undefined;

async function build() {
  const deps = await cloudDeps();
  return handle(createMcpApp(deps, { authorizationServer: deps.webUrl }));
}

export const handler: ReturnType<typeof handle> = async (event, context) => {
  ready ??= build().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return (await ready)(event, context);
};
