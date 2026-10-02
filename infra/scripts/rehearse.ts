/**
 * Cloud rehearsal without an AWS account: runs the real Lambda bundles from infra/build behind
 * two local Function URL emulators, with fake Secrets Manager, SSM and DynamoDB endpoints that
 * speak the AWS JSON protocols the SDK uses. Catches bundling, static file, cold start and
 * event format problems before the first deploy. Then runs scripts/smoke.ts against it.
 *   pnpm --filter @asg/infra rehearse
 */
import { execSync, spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AWS_PORT = 8890;
const MCP_PORT = 8891;
const WEB_PORT = 8892;

// ---------------------------------------------------------------- fake AWS (JSON protocols)

type Attr = { S?: string; N?: string };
type Item = Record<string, Attr>;
/** The request fields the bundles send; each operation reads only its own. */
interface Input {
  Key: Item;
  Item: Item;
  ReturnValues?: string;
  ExpressionAttributeValues: Record<string, Attr>;
  IndexName?: string;
  ScanIndexForward?: boolean;
  RequestItems: Record<string, { DeleteRequest: { Key: Item } }[]>;
}
const table = new Map<string, Item>();
const keyOf = (item: Item) => `${item.PK?.S}\u0000${item.SK?.S}`;
const str = (value: Attr | undefined) => value?.S ?? "";

function query(input: Input): Item[] {
  const values = input.ExpressionAttributeValues ?? {};
  const pk = str(values[":pk"]);
  const prefix = str(values[":sk"]);
  const byIndex = input.IndexName === "GSI1";
  const rows = [...table.values()].filter((item) =>
    byIndex ? str(item.GSI1PK) === pk : str(item.PK) === pk && str(item.SK).startsWith(prefix),
  );
  rows.sort((a, b) => (str(a.SK) < str(b.SK) ? -1 : 1));
  return input.ScanIndexForward === false ? rows.reverse() : rows;
}

const handlers: Record<string, (input: Input) => unknown> = {
  "secretsmanager.GetSecretValue": () => ({
    SecretString: "rehearsal-master-secret-".padEnd(64, "x"),
  }),
  "AmazonSSM.GetParameter": () => ({ Parameter: { Value: `http://localhost:${WEB_PORT}/` } }),
  "DynamoDB_20120810.GetItem": (input) => {
    const item = table.get(`${str(input.Key.PK)}\u0000${str(input.Key.SK)}`);
    return item ? { Item: item } : {};
  },
  "DynamoDB_20120810.PutItem": (input) => {
    table.set(keyOf(input.Item), input.Item);
    return {};
  },
  "DynamoDB_20120810.DeleteItem": (input) => {
    const key = `${str(input.Key.PK)}\u0000${str(input.Key.SK)}`;
    const old = table.get(key);
    table.delete(key);
    return input.ReturnValues === "ALL_OLD" && old ? { Attributes: old } : {};
  },
  "DynamoDB_20120810.Query": (input) => ({ Items: query(input) }),
  "DynamoDB_20120810.UpdateItem": (input) => {
    const key = `${str(input.Key.PK)}\u0000${str(input.Key.SK)}`;
    const item = table.get(key) ?? { ...input.Key };
    const count = Number(item.count?.N ?? 0) + 1;
    item.count = { N: String(count) };
    const expires = input.ExpressionAttributeValues[":expires"];
    if (!item.expiresAt && expires) item.expiresAt = expires;
    table.set(key, item);
    return { Attributes: { count: { N: String(count) } } };
  },
  "DynamoDB_20120810.BatchWriteItem": (input) => {
    for (const requests of Object.values(input.RequestItems)) {
      for (const request of requests) {
        const key = request.DeleteRequest.Key;
        table.delete(`${str(key.PK)}\u0000${str(key.SK)}`);
      }
    }
    return { UnprocessedItems: {} };
  },
};

const body = (req: IncomingMessage) =>
  new Promise<Buffer>((done) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => done(Buffer.concat(chunks)));
  });

const awsCalls = new Map<string, number>();
const aws = createServer(async (req, res) => {
  const target = String(req.headers["x-amz-target"] ?? "");
  const handler = handlers[target];
  awsCalls.set(target, (awsCalls.get(target) ?? 0) + 1);
  const input = JSON.parse((await body(req)).toString() || "{}") as Input;
  res.setHeader("content-type", "application/x-amz-json-1.0");
  if (!handler) {
    res.statusCode = 400;
    res.end(JSON.stringify({ __type: "UnknownOperationException", message: target }));
    return;
  }
  res.end(JSON.stringify(handler(input)));
});

// ---------------------------------------------------------------- Function URL emulator

interface LambdaResult {
  statusCode?: number;
  headers?: Record<string, string | number | boolean>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
}
type LambdaHandler = (event: unknown, context: unknown) => Promise<LambdaResult>;

function functionUrl(port: number, handler: LambdaHandler) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const raw = await body(req);
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers[name] = value;
      else if (Array.isArray(value)) headers[name] = value.join(",");
    }
    headers["x-forwarded-for"] = "203.0.113.10";
    headers["x-forwarded-proto"] = "http";
    const cookies = headers.cookie?.split(/;\s*/).filter(Boolean);
    const event = {
      version: "2.0",
      routeKey: "$default",
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers,
      ...(cookies ? { cookies } : {}),
      requestContext: {
        accountId: "anonymous",
        apiId: "rehearsal",
        domainName: `localhost:${port}`,
        domainPrefix: "localhost",
        http: {
          method: req.method,
          path: url.pathname,
          protocol: "HTTP/1.1",
          sourceIp: "203.0.113.10",
          userAgent: headers["user-agent"] ?? "",
        },
        requestId: crypto.randomUUID(),
        routeKey: "$default",
        stage: "$default",
        time: new Date().toUTCString(),
        timeEpoch: Date.now(),
      },
      ...(raw.length > 0
        ? { body: raw.toString("base64"), isBase64Encoded: true }
        : { isBase64Encoded: false }),
    };
    try {
      const result = await handler(event, { awsRequestId: "rehearsal" });
      res.statusCode = result.statusCode ?? 200;
      for (const [name, value] of Object.entries(result.headers ?? {}))
        res.setHeader(name, String(value));
      if (result.cookies?.length) res.setHeader("set-cookie", result.cookies);
      res.end(
        result.isBase64Encoded ? Buffer.from(result.body ?? "", "base64") : (result.body ?? ""),
      );
    } catch (error) {
      res.statusCode = 502;
      res.end(`Lambda error: ${(error as Error).stack}`);
    }
  });
}

// ---------------------------------------------------------------- run

execSync("pnpm bundle", { cwd: join(root, "infra"), stdio: "inherit" });

Object.assign(process.env, {
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "rehearsal",
  AWS_SECRET_ACCESS_KEY: "rehearsal",
  AWS_ENDPOINT_URL: `http://localhost:${AWS_PORT}`,
  TABLE_NAME: "rehearsal-table",
  APP_SECRET_ARN: "arn:aws:secretsmanager:us-east-1:000000000000:secret:rehearsal",
  WEB_URL_PARAM: "/scam-guardian/web-url",
  MCP_URL: `http://localhost:${MCP_PORT}/mcp`,
  // No Bedrock or Polly here: the rule based mode answers, the browser speaks.
  AGENT_MODE: "simplified",
});

await new Promise<void>((done) => aws.listen(AWS_PORT, done));

// Lambda runs each function from its own folder; static files are read relative to it.
const load = async (name: string) => {
  process.chdir(join(root, "infra/build", name));
  const module = (await import(
    pathToFileURL(join(root, "infra/build", name, "index.mjs")).href
  )) as {
    handler: LambdaHandler;
  };
  return module.handler;
};
const mcpHandler = await load("mcp");
const webHandler = await load("web");
process.chdir(join(root, "infra/build/web"));

const mcpServer = functionUrl(MCP_PORT, mcpHandler);
const webServer = functionUrl(WEB_PORT, webHandler);
await new Promise<void>((done) => mcpServer.listen(MCP_PORT, done));
await new Promise<void>((done) => webServer.listen(WEB_PORT, done));
console.warn(
  `\nRehearsal: web http://localhost:${WEB_PORT}, MCP http://localhost:${MCP_PORT}/mcp\n`,
);

// Spawned, not execSync: the emulated Function URLs run in this process and must keep serving.
const failed = await new Promise<boolean>((done) => {
  const smoke = spawn(
    "pnpm",
    ["-s", "smoke", `http://localhost:${WEB_PORT}`, `http://localhost:${MCP_PORT}/mcp`],
    { cwd: root, stdio: "inherit", shell: true },
  );
  smoke.on("exit", (code) => done(code !== 0));
});

console.warn("\nAWS calls made by the bundles:");
for (const [target, count] of [...awsCalls].sort()) console.warn(`  ${target}: ${count}`);
console.warn(`DynamoDB rows written: ${table.size}`);

if (process.argv.includes("--keep")) {
  console.warn("\n--keep: servers stay up; press Ctrl+C to stop.");
} else {
  mcpServer.close();
  webServer.close();
  aws.close();
  process.exitCode = failed ? 1 : 0;
}
