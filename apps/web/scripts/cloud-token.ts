/**
 * Prints a 15 minute demo household token for the deployed MCP server, without the AWS CLI:
 * reads the stack's SecretArn output, then the master secret, and derives the token secret.
 * Without a household id it first creates a fresh demo household in the deployed table (Ruth,
 * Michael and Sarah, gone after 24 hours), so MCP Inspector sees the same flow as the Echo.
 * Usage: pnpm token:cloud [householdId]   (AWS credentials in the environment, as for deploy)
 */
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { seedDemoHousehold } from "@asg/core/demo/seed";
import { deriveSecret } from "@asg/mcp-server/adapters/cloud-config";
import { DynamoStore } from "@asg/mcp-server/adapters/dynamo-store";
import { DynamoTable } from "@asg/mcp-server/adapters/table";
import { mintHouseholdToken } from "../src/auth/household-token";

const region = process.env.AWS_REGION ?? "us-east-1";
const stacks = await new CloudFormationClient({ region }).send(
  new DescribeStacksCommand({ StackName: "ScamGuardian" }),
);
const outputs = stacks.Stacks?.[0]?.Outputs ?? [];
const value = (key: string) => outputs.find((o) => o.OutputKey === key)?.OutputValue;
const secretArn = value("SecretArn");
if (!secretArn) {
  console.error("The ScamGuardian stack has no SecretArn output. Deploy it first.");
  process.exit(1);
}
const secret = await new SecretsManagerClient({ region }).send(
  new GetSecretValueCommand({ SecretId: secretArn }),
);
let householdId = process.argv[2];
if (!householdId) {
  const tableName = value("TableName");
  if (!tableName) {
    console.error("The ScamGuardian stack has no TableName output. Deploy it first.");
    process.exit(1);
  }
  const household = await seedDemoHousehold(
    new DynamoStore(new DynamoTable(tableName)),
    new Date(),
  );
  householdId = household.householdId;
  console.warn(
    `Demo household ${householdId}: Ruth, with Michael (grandson) and Sarah (daughter).`,
  );
}
const token = await mintHouseholdToken(
  { householdId, kind: "demo" },
  deriveSecret(secret.SecretString ?? "", "household-token"),
);
console.warn(`MCP URL: ${value("McpUrl")}`);
console.log(token);
