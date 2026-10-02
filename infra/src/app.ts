/**
 * CDK app. Settings come from context (cdk.json or -c key=value), never from code:
 *   sesFrom       verified SES sender (optional; without it email goes to the demo phone)
 *   pollyVoice    Polly neural voice (default Joanna)
 *   bedrockModel  Bedrock inference profile (default Claude Haiku 4.5, US profile)
 */
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { GuardianStack } from "./stack";

const app = new App();
const context = (key: string) => app.node.tryGetContext(key) as string | undefined;
const sesFrom = context("sesFrom");

new GuardianStack(app, "ScamGuardian", {
  // Bedrock's US inference profile and Polly neural voices are both in us-east-1.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
  buildDir: join(import.meta.dirname, "../build"),
  ...(sesFrom ? { sesFrom } : {}),
  pollyVoice: context("pollyVoice") ?? "Joanna",
  bedrockModelId: context("bedrockModel") ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  description: "Scam Guardian: voice scam check for Alexa+ (hackathon build)",
});
