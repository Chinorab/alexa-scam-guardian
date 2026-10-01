/** The cloud stack keeps its promises: data expires, no secret in the template, least access. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { GuardianStack } from "./stack";

function synth(sesFrom?: string) {
  const buildDir = mkdtempSync(join(tmpdir(), "guardian-build-"));
  for (const name of ["mcp", "web"]) {
    mkdirSync(join(buildDir, name));
    writeFileSync(join(buildDir, name, "index.mjs"), "export const handler = () => {};");
  }
  const app = new App();
  const stack = new GuardianStack(app, "Test", {
    env: { account: "111111111111", region: "us-east-1" },
    buildDir,
    pollyVoice: "Joanna",
    bedrockModelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ...(sesFrom ? { sesFrom } : {}),
  });
  return Template.fromStack(stack);
}

describe("cloud stack", () => {
  const template = synth("Scam Guardian <alerts@example.org>");

  it("deletes expired rows with DynamoDB TTL", () => {
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("runs both functions on arm64 Node.js 24 with public Function URLs", () => {
    template.resourceCountIs("AWS::Lambda::Function", 2);
    template.allResourcesProperties("AWS::Lambda::Function", {
      Runtime: "nodejs24.x",
      Architectures: ["arm64"],
    });
    template.resourceCountIs("AWS::Lambda::Url", 2);
  });

  it("puts no secret value in the template, only the secret's ARN", () => {
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toMatch(/SECRET\b(?!_ARN)|SESSION_SECRET|HOUSEHOLD_TOKEN_SECRET/);
    template.allResourcesProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({ APP_SECRET_ARN: Match.anyValue() }) },
    });
  });

  it("lets only the web function call Bedrock, on one model", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    const withBedrock = Object.entries(policies).filter(([, policy]) =>
      JSON.stringify(policy).includes("bedrock:InvokeModel"),
    );
    expect(withBedrock.map(([id]) => id)).toEqual([expect.stringMatching(/^WebApp/)]);
    expect(JSON.stringify(withBedrock[0]?.[1])).toContain("claude-haiku-4-5-20251001-v1:0");
    expect(JSON.stringify(withBedrock[0]?.[1])).not.toContain('"bedrock:*"');
  });

  it("only allows sending email when a sender is configured", () => {
    expect(JSON.stringify(template.toJSON())).toContain("ses:SendEmail");
    expect(JSON.stringify(synth().toJSON())).not.toContain("ses:SendEmail");
  });

  it("keeps logs one week", () => {
    template.allResourcesProperties("AWS::Logs::LogGroup", { RetentionInDays: 7 });
  });
});
