/**
 * Checks an AWS account before the first deploy and says what is missing, in order:
 * credentials, Bedrock model access, Polly, SES, CDK bootstrap, and an existing stack.
 * Usage: pnpm aws:check   (credentials in the environment or ~/.aws, region us-east-1)
 * The Bedrock check sends one tiny request (a few tokens).
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { DescribeVoicesCommand, PollyClient } from "@aws-sdk/client-polly";
import { GetAccountCommand, ListEmailIdentitiesCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

const region = "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const voice = process.env.POLLY_VOICE ?? "Joanna";

type Status = "ok" | "todo" | "info";
const results: { status: Status; name: string; detail: string }[] = [];
const note = (status: Status, name: string, detail: string) => {
  results.push({ status, name, detail });
  console.warn(
    `${status === "ok" ? "ok  " : status === "todo" ? "TODO" : "info"}  ${name}: ${detail}`,
  );
};
const reason = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error);
/** A missing IAM permission reads like a missing feature; say which one it is. */
const NO_PERMISSION =
  "The IAM user has no permission for this: in IAM, Users, add the AdministratorAccess policy to it (remove the user after the project).";
const missingPermission = (error: unknown) =>
  error instanceof Error &&
  /not authorized to perform|no identity-based policy/i.test(error.message);
const advice = (error: unknown, otherwise: string) =>
  `${reason(error)}. ${missingPermission(error) ? NO_PERMISSION : otherwise}`;

// 1. Credentials
try {
  const me = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
  note("ok", "Credentials", `account ${me.Account}`);
} catch (error) {
  note(
    "todo",
    "Credentials",
    `none found (${reason(error)}). Put an access key in ~/.aws/credentials (region us-east-1 in ~/.aws/config), or set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION in this terminal.`,
  );
  console.warn("\nStopping here: every other check needs credentials.");
  process.exit(1);
}

// 2. Bedrock model access
try {
  const output = await new BedrockRuntimeClient({ region }).send(
    new ConverseCommand({
      modelId,
      messages: [{ role: "user", content: [{ text: "Reply with the word ready." }] }],
      inferenceConfig: { maxTokens: 5, temperature: 0 },
    }),
  );
  note("ok", "Bedrock", `${modelId} answered (stop reason ${output.stopReason})`);
} catch (error) {
  note(
    "todo",
    "Bedrock",
    advice(
      error,
      "In the Bedrock console (us-east-1), Model catalog, open Claude Haiku 4.5 and submit the use case details if asked.",
    ),
  );
}

// 3. Polly
try {
  const voices = await new PollyClient({ region }).send(
    new DescribeVoicesCommand({ Engine: "neural", LanguageCode: "en-US" }),
  );
  const found = voices.Voices?.some((v) => v.Id === voice);
  note(
    found ? "ok" : "todo",
    "Polly",
    found ? `neural voice ${voice}` : `voice ${voice} not offered`,
  );
} catch (error) {
  note("todo", "Polly", advice(error, "Polly is needed for the Echo's voice."));
}

// 4. SES
try {
  const ses = new SESv2Client({ region });
  const account = await ses.send(new GetAccountCommand({}));
  const identities = await ses.send(new ListEmailIdentitiesCommand({}));
  const verified = (identities.EmailIdentities ?? [])
    .filter((i) => i.SendingEnabled)
    .map((i) => i.IdentityName);
  note(
    verified.length > 0 ? "ok" : "todo",
    "SES sender",
    verified.length > 0
      ? `verified: ${verified.join(", ")}`
      : "no verified identity; verify a domain or an address in the SES console, then deploy with -c sesFrom=...",
  );
  note(
    account.ProductionAccessEnabled ? "ok" : "info",
    "SES production access",
    account.ProductionAccessEnabled
      ? "granted"
      : "sandbox: only verified recipients get email. Request production access (one to two business days).",
  );
} catch (error) {
  note("todo", "SES", advice(error, "SES is only needed for real email."));
}

// 5. CDK bootstrap and the stack
const cloudformation = new CloudFormationClient({ region });
const stackStatus = async (name: string) => {
  try {
    const result = await cloudformation.send(new DescribeStacksCommand({ StackName: name }));
    return result.Stacks?.[0]?.StackStatus;
  } catch {
    return undefined;
  }
};
const toolkit = await stackStatus("CDKToolkit");
note(
  toolkit ? "ok" : "todo",
  "CDK bootstrap",
  toolkit ? toolkit : "not bootstrapped; run: pnpm --filter @asg/infra exec cdk bootstrap",
);
const stack = await stackStatus("ScamGuardian");
note("info", "ScamGuardian stack", stack ?? "not deployed yet; run: pnpm deploy");

const todo = results.filter((r) => r.status === "todo").length;
console.warn(todo === 0 ? "\nReady to deploy." : `\n${todo} thing(s) to do before deploying.`);
process.exitCode = todo === 0 ? 0 : 1;
