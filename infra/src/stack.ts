/**
 * Everything the cloud version needs (plan.md, research R8 to R12): one DynamoDB table with
 * TTL, two arm64 Node.js 24 Lambda functions with public Function URLs (MCP server and web
 * app), one generated secret, and least privilege access to Bedrock, Polly and SES.
 */
import { join } from "node:path";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
  aws_ssm as ssm,
  type StackProps,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface GuardianStackProps extends StackProps {
  /** Folder holding the bundles made by scripts/bundle.ts. */
  buildDir: string;
  /** Verified SES sender, for example "Scam Guardian <alerts@example.org>". Optional. */
  sesFrom?: string;
  /** Amazon Polly neural voice for the simulated Echo. */
  pollyVoice: string;
  /** Bedrock model or inference profile for the full conversation mode. */
  bedrockModelId: string;
}

export const WEB_URL_PARAM = "/scam-guardian/web-url";

export class GuardianStack extends Stack {
  constructor(scope: Construct, id: string, props: GuardianStackProps) {
    super(scope, id, props);

    // Deleting the stack deletes the data: nothing about a family outlives the service.
    const table = new dynamodb.TableV2(this, "Table", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: "expiresAt",
      globalSecondaryIndexes: [
        {
          indexName: "GSI1",
          partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // One random master secret; the functions derive the token and cookie secrets from it.
    const secret = new secretsmanager.Secret(this, "AppSecret", {
      description: "Scam Guardian master secret (household tokens, family page cookies)",
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const common = (name: string, memorySize: number, timeout: number) => ({
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "index.handler",
      code: lambda.Code.fromAsset(join(props.buildDir, name), { exclude: ["*.map"] }),
      memorySize,
      timeout: Duration.seconds(timeout),
      logGroup: new logs.LogGroup(this, `${name}Logs`, {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      environment: {
        TABLE_NAME: table.tableName,
        APP_SECRET_ARN: secret.secretArn,
        WEB_URL_PARAM,
        ...(props.sesFrom ? { SES_FROM: props.sesFrom } : {}),
      },
    });

    const mcp = new lambda.Function(this, "McpServer", {
      ...common("mcp", 1024, 10),
      description: "Scam Guardian MCP server (Streamable HTTP)",
    });
    const mcpUrl = mcp.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST, lambda.HttpMethod.DELETE],
        allowedHeaders: [
          "authorization",
          "content-type",
          "accept",
          "mcp-protocol-version",
          "mcp-session-id",
        ],
        exposedHeaders: ["www-authenticate", "mcp-session-id"],
      },
    });

    const web = new lambda.Function(this, "WebApp", {
      ...common("web", 1024, 20),
      description: "Scam Guardian simulated Echo Show and family page",
    });
    web.addEnvironment("MCP_URL", `${mcpUrl.url}mcp`);
    web.addEnvironment("POLLY_VOICE", props.pollyVoice);
    web.addEnvironment("BEDROCK_MODEL_ID", props.bedrockModelId);
    web.addEnvironment("AGENT_MODE", "full");
    const webUrl = web.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    // The functions read their public URL at cold start; passing it as an environment
    // variable would make each function depend on its own URL.
    new ssm.StringParameter(this, "WebUrlParam", {
      parameterName: WEB_URL_PARAM,
      stringValue: webUrl.url,
      description: "Public URL of the Scam Guardian web app",
    });

    // Built by name, not from the parameter resource, so the grant does not depend on it.
    const webUrlParamArn = `arn:aws:ssm:${this.region}:${this.account}:parameter${WEB_URL_PARAM}`;
    for (const fn of [mcp, web]) {
      table.grantReadWriteData(fn);
      secret.grantRead(fn);
      fn.addToRolePolicy(
        new iam.PolicyStatement({ actions: ["ssm:GetParameter"], resources: [webUrlParamArn] }),
      );
      if (props.sesFrom) {
        fn.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["ses:SendEmail"],
            resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
          }),
        );
      }
    }

    // Bedrock: the US cross region inference profile and the model it routes to.
    const model = props.bedrockModelId.replace(/^us\./, "");
    web.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${props.bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/${model}`,
        ],
      }),
    );
    web.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["polly:SynthesizeSpeech"], resources: ["*"] }),
    );

    new CfnOutput(this, "WebUrl", { value: webUrl.url });
    new CfnOutput(this, "McpUrl", { value: `${mcpUrl.url}mcp` });
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "SecretArn", { value: secret.secretArn });
  }
}
