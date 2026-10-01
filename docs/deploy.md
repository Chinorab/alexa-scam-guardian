# Deploy to AWS

The cloud version runs in `us-east-1` as one CDK stack named `ScamGuardian`:

| Resource | Purpose |
|---|---|
| DynamoDB table (on demand, TTL on `expiresAt`, index `GSI1`) | Households, people, checks, messages, reports, Echo sessions, the demo phone |
| Lambda `McpServer` (Node.js 24, arm64) and its Function URL | The MCP server, Streamable HTTP at `/mcp` |
| Lambda `WebApp` (Node.js 24, arm64) and its Function URL | Simulated Echo Show, family page, reply page |
| Secrets Manager secret | One generated master secret; household token and cookie secrets are derived from it |
| SSM parameter `/scam-guardian/web-url` | The web URL, read by both functions at cold start |
| IAM | Table access for both; Bedrock (one model), Polly for the web function; SES only when a sender is set |

Deleting the stack deletes the table: no family data outlives the service.

## Before the first deploy

1. Install the AWS CLI v2 and sign in (`aws configure sso` or `aws configure`). Check with
   `aws sts get-caller-identity`.
2. In the Bedrock console (us-east-1), open Model access and enable Anthropic Claude Haiku 4.5.
   The first Anthropic model needs the short use case form.
3. Optional, for real email: verify a sender in Amazon SES (us-east-1). A domain identity is
   best. New accounts start in the SES sandbox, where only verified recipients receive email;
   request production access early, it usually takes one to two business days. Without a
   sender, email goes to the on screen demo phone and the family page cannot send sign in
   links.
4. Bootstrap CDK once per account and region:

```bash
pnpm --filter @asg/infra exec cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

## Deploy

```bash
pnpm deploy
```

With a verified SES sender:

```bash
pnpm deploy -- -c "sesFrom=Scam Guardian <alerts@example.org>"
```

`pnpm deploy` bundles both functions with esbuild (`infra/scripts/bundle.ts`), builds the Echo
client, then runs `cdk deploy`. The outputs print `WebUrl` and `McpUrl`.

Other settings, all optional, passed the same way with `-c`:

| Context key | Default |
|---|---|
| `pollyVoice` | `Joanna` (Polly neural) |
| `bedrockModel` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |

## Check it

```bash
pnpm measure https://YOUR-WEB-URL.lambda-url.us-east-1.on.aws 20
```

The MCP server answers 401 without a household token and publishes its protected resource
metadata at `/.well-known/oauth-protected-resource`. To call it from MCP Inspector, mint a demo
token from the deployed master secret (the stack prints its ARN as `SecretArn`):

```bash
APP_SECRET="$(aws secretsmanager get-secret-value --secret-id SECRET_ARN --query SecretString --output text)" pnpm token:demo
```

Tool latency per call is in the logs (`event: tool_call`, `durationMs`). CloudWatch Logs
Insights, log group of `McpServer`:

```text
filter event = "tool_call"
| stats count(), pct(durationMs, 50), pct(durationMs, 95) by tool
```

## Remove everything

```bash
pnpm --filter @asg/infra destroy
```

## Cost guards

- On demand DynamoDB, Lambda and Function URLs cost nothing while idle.
- A public visitor can start at most 20 demo families per hour from one address.
- Each household gets at most 120 model backed turns per hour; past that the rule based mode
  answers, so a person is never refused mid call.
- Outreach messages are limited to 10 per household per hour, sign in links to 5 per email
  per hour, test messages to 3 per person per hour.

## Optional: the MCP server on Amazon Bedrock AgentCore Runtime

AgentCore Runtime hosts MCP servers as arm64 containers serving stateless Streamable HTTP on
`0.0.0.0:8000/mcp`. The same server ships that way:

```bash
pnpm --filter @asg/infra bundle:container
docker buildx build --platform linux/arm64 -f apps/mcp-server/Dockerfile -t scam-guardian-mcp .
```

Push the image to Amazon ECR and create an AgentCore Runtime with the MCP protocol. Give its
role the same table, secret and SES access as the `McpServer` function and set `TABLE_NAME`,
`APP_SECRET_ARN` and `WEB_URL`. Without those variables the container runs in memory with
`HOUSEHOLD_TOKEN_SECRET`, which is how the bundle was checked locally (8 tools listed, 401
without a token). Callers still need a household bearer token. Not yet run on AgentCore.

