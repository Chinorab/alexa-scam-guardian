/**
 * Configuration for the Lambda functions, read once per cold start. Secrets come from AWS
 * Secrets Manager, never from the template or the code. One random master secret is stored;
 * the token and cookie secrets are derived from it, so each one serves a single purpose.
 */
import { createHmac } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export interface CloudConfig {
  /** Signs household tokens (web app mints, MCP server verifies). */
  tokenSecret: string;
  /** Signs family page cookies. */
  sessionSecret: string;
  /** Public web URL used in message links. */
  webUrl: string;
}

export const deriveSecret = (master: string, purpose: string) =>
  createHmac("sha256", master).update(`scam-guardian:${purpose}`).digest("base64url");

export interface CloudEnv {
  /** ARN of the Secrets Manager secret that holds the master secret. */
  APP_SECRET_ARN?: string;
  /** Public web URL, when known at deploy time (custom domain). */
  WEB_URL?: string;
  /** SSM parameter holding the web URL, when it is only known after deploy. */
  WEB_URL_PARAM?: string;
}

export async function loadCloudConfig(env: CloudEnv = process.env): Promise<CloudConfig> {
  if (!env.APP_SECRET_ARN) throw new Error("APP_SECRET_ARN is not set");
  const secret = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: env.APP_SECRET_ARN }),
  );
  const master = secret.SecretString;
  if (!master || master.length < 32) throw new Error("The app secret is missing or too short");

  let webUrl = env.WEB_URL;
  if (!webUrl && env.WEB_URL_PARAM) {
    const parameter = await new SSMClient({}).send(
      new GetParameterCommand({ Name: env.WEB_URL_PARAM }),
    );
    webUrl = parameter.Parameter?.Value;
  }
  if (!webUrl) throw new Error("WEB_URL or WEB_URL_PARAM must be set");

  return {
    tokenSecret: deriveSecret(master, "household-token"),
    sessionSecret: deriveSecret(master, "family-session"),
    webUrl: webUrl.replace(/\/+$/, ""),
  };
}
