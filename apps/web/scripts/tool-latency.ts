/**
 * Tool latency from the deployed MCP server's logs (T080): count, median and p95 per tool over
 * the last hours, with CloudWatch Logs Insights. Reads the log group from the stack.
 * Usage: pnpm tool-latency [hours, default 24]   (AWS credentials, region us-east-1)
 */
import {
  CloudFormationClient,
  DescribeStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const region = "us-east-1";
const hours = Number(process.argv[2] ?? 24);

const resources = await new CloudFormationClient({ region }).send(
  new DescribeStackResourcesCommand({ StackName: "ScamGuardian" }),
);
const logGroup = resources.StackResources?.find(
  (r) => r.ResourceType === "AWS::Logs::LogGroup" && r.LogicalResourceId?.startsWith("mcpLogs"),
)?.PhysicalResourceId;
if (!logGroup) throw new Error("No MCP log group in the ScamGuardian stack. Deployed yet?");

const logs = new CloudWatchLogsClient({ region });
const end = Math.floor(Date.now() / 1000);
const { queryId } = await logs.send(
  new StartQueryCommand({
    logGroupName: logGroup,
    startTime: end - hours * 3600,
    endTime: end,
    queryString: `filter event = "tool_call"
| stats count() as calls, pct(durationMs, 50) as median, pct(durationMs, 95) as p95, max(durationMs) as worst by tool
| sort calls desc`,
  }),
);

let rows: { field?: string; value?: string }[][] = [];
for (let attempt = 0; attempt < 30; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const result = await logs.send(new GetQueryResultsCommand({ queryId }));
  if (result.status === "Complete") {
    rows = result.results ?? [];
    break;
  }
  if (result.status === "Failed" || result.status === "Cancelled") {
    throw new Error(`Query ${result.status}`);
  }
}

const value = (row: { field?: string; value?: string }[], field: string) =>
  row.find((cell) => cell.field === field)?.value ?? "";
const ms = (text: string) => `${Math.round(Number(text))} ms`;

console.log(`Log group: ${logGroup}, last ${hours} h`);
console.log("");
console.log("| Tool | Calls | Median | p95 | Max |");
console.log("|---|---|---|---|---|");
for (const row of rows) {
  console.log(
    `| ${value(row, "tool")} | ${value(row, "calls")} | ${ms(value(row, "median"))} | ${ms(value(row, "p95"))} | ${ms(value(row, "worst"))} |`,
  );
}
