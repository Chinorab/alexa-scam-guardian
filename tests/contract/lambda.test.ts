/**
 * The MCP server behind a Lambda Function URL: the same app, driven by Function URL events
 * (payload format 2.0) instead of HTTP requests. Guards the Lambda adapter and the encoding.
 */
import { handle, type LambdaEvent } from "@hono/aws-lambda";
import { describe, expect, it } from "vitest";
import { makeApp, makeDeps, tokenFor } from "./helpers";

const DOMAIN = "abc123.lambda-url.us-east-1.on.aws";

function functionUrlEvent(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string,
) {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: "",
    headers: { host: DOMAIN, "x-forwarded-proto": "https", ...headers },
    requestContext: {
      accountId: "anonymous",
      apiId: "abc123",
      domainName: DOMAIN,
      domainPrefix: "abc123",
      http: { method, path, protocol: "HTTP/1.1", sourceIp: "203.0.113.9", userAgent: "test" },
      requestId: "req-1",
      routeKey: "$default",
      stage: "$default",
      time: "05/Oct/2026:15:00:00 +0000",
      timeEpoch: 1791212400000,
    },
    ...(body !== undefined ? { body, isBase64Encoded: false } : { isBase64Encoded: false }),
  };
}

const text = (result: { body: string; isBase64Encoded: boolean }) =>
  result.isBase64Encoded ? Buffer.from(result.body, "base64").toString("utf8") : result.body;

describe("MCP server on Lambda", () => {
  const handler = handle(makeApp(makeDeps().deps));

  it("answers tools/list through a Function URL event", async () => {
    const token = await tokenFor("hh_lambda");
    const call = (body: unknown) =>
      handler(
        functionUrlEvent(
          "POST",
          "/mcp",
          {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${token}`,
            "mcp-protocol-version": "2025-11-25",
          },
          JSON.stringify(body),
        ) as unknown as LambdaEvent,
      );
    const result = await call({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(result.statusCode).toBe(200);
    const body = text(result);
    for (const tool of ["assess_call", "prepare_outreach", "confirm_outreach", "prepare_report"]) {
      expect(body).toContain(`"${tool}"`);
    }
  });

  it("rejects a missing token and points to metadata on the public domain", async () => {
    const result = await handler(
      functionUrlEvent(
        "POST",
        "/mcp",
        { "content-type": "application/json" },
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      ) as unknown as LambdaEvent,
    );
    expect(result.statusCode).toBe(401);
    expect(JSON.stringify(result.headers)).toContain(
      `https://${DOMAIN}/.well-known/oauth-protected-resource`,
    );
  });
});
