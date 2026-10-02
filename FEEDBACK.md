# Product Feedback

One section per tool, SDK or API used. Updated as the project goes.

---

## Alexa+ MCP Toolkit documentation (developer.amazon.com/docs/alexaplus)

- **Used for:** Checking whether the MCP server could be onboarded to real Alexa+, and shaping the server so it matches the add-on contract (MCP 2025-11-25, Streamable HTTP, sub 500 ms tool latency, MCP Apps visuals, OAuth 2.1 + PKCE).
- **What worked well:** The technical requirements are concrete and short. Adopting standard MCP (instead of a proprietary skill model) means the same server can serve Alexa+ and any other MCP client.
- **What needs work:** Access status (partner only) is stated on one page and missing from the QuickStart. See FRICTION_LOG.md #1.
- **Onboarding:** Could not go past reading the docs: the toolkit is partner gated.
- **Would I build with it again:** Yes, once the toolkit opens to independent developers.

---

## Vitest 5

- **Used for:** Unit, contract and red team suites, one root config with `projects`; the same contract suite runs a second time on the DynamoDB store through a project level `env`; the live Bedrock red team has its own config so it never runs by accident.
- **What worked well:** Zero config TypeScript, fast first run, clear output. `it.each` over a JSON file turned the red team list into one named test per phrase, which made each safety gap easy to read in CI.
- **What needs work:** A project's `exclude` replaces the default excludes instead of adding to them; easy to miss.
- **Onboarding:** Smooth.
- **Would I build with it again:** Yes.

---

## TypeScript 6.0 and typescript-eslint 8

- **Used for:** Strict typing across the monorepo, ESLint flat config, and the compiler API in the copy lint script.
- **What worked well:** The compiler API makes it easy to pull user facing strings and JSX text out of source files.
- **What needs work:** typescript-eslint does not support TypeScript 7 yet, so `latest` cannot be used (FRICTION_LOG.md #3).
- **Onboarding:** Smooth once the version was pinned.
- **Would I build with it again:** Yes.

---

## MCP TypeScript SDK v2 (`@modelcontextprotocol/server` and `client` 2.2.0)

- **Used for:** The self-hosted MCP server (stateless Streamable HTTP, protocol 2026-07-28 and 2025-11-25 from one endpoint) and the MCP client in the simulated Echo and the contract tests.
- **What worked well:** `createMcpHandler` exposes a web standard `fetch(Request) => Response` face, so it drops into Hono, Lambda or tests with no adapter. `authInfo` passes straight through to the per request server factory, which makes multi tenant servers simple. The official client connected to our server on the first try in an in process test.
- **What needs work:** The docs do not state the release status of v2 (see FRICTION_LOG.md #2). No guidance for serverless runtimes such as AWS Lambda, although the stateless design fits them well. The large generated type bundle is hard to browse; a short API page for `McpServer.registerTool` with zod v4 would help.
- **Onboarding:** Good once past the version question; reading the `.d.mts` types was faster than finding the right docs page.
- **Would I build with it again:** Yes.

---

## MCP Apps extension (`@modelcontextprotocol/ext-apps` 2.0.3)

- **Used for:** Echo Show screen cards. The MCP server registers `ui://guardian/*` views (`text/html;profile=mcp-app`) linked from tools through `_meta.ui.resourceUri`; the simulated Echo is an MCP Apps host using `AppBridge` and `PostMessageTransport`, rendering each view in a sandboxed iframe with an opaque origin.
- **What worked well:** `registerAppTool` and `registerAppResource` make the server side a two line change. `AppBridge` handles the host handshake. The protocol itself (JSON-RPC over postMessage) is small and clear, which let us write the view side by hand.
- **What needs work:** Bundling the `App` class into a view pulls in the whole SDK and zod (our first view was 640 KB; a hand written view client is 4 KB plus the font). A tiny dependency free view runtime would help hosts on constrained devices like an Echo Show. A view that posts `ui/initialize` before the host listens loses it silently; the docs could recommend retrying or say who must be ready first.
- **Onboarding:** Medium. The type definitions are thorough; examples for a non React view are scarce.
- **Would I build with it again:** Yes. It is the right way to give a voice add-on a screen.

---

## Playwright 1.63

- **Used for:** End to end runs of the simulated Echo in a real Chromium (typed input, mocked speech output), including the MCP Apps cards inside sandboxed iframes, and screenshots for design review.
- **What worked well:** `frameLocator` reaches into the sandboxed MCP Apps iframes, which the app's own preview browser blocks. `webServer` builds and starts the app for each run.
- **What needs work:** Clicking an element scrolls its container, which made a full page capture look like a layout bug until measured.
- **Onboarding:** Smooth; browsers install to any folder with `PLAYWRIGHT_BROWSERS_PATH`.
- **Would I build with it again:** Yes.

---

## AWS CDK 2.272 (`aws-cdk-lib`, CLI 2.1144)

- **Used for:** The whole cloud stack in TypeScript: DynamoDB table with TTL and a secondary index, two arm64 Node.js 24 Lambda functions with Function URLs, a generated Secrets Manager secret, an SSM parameter and least privilege IAM for Bedrock, Polly and SES.
- **What worked well:** `cdk synth` now runs CloudFormation validation locally and named a circular dependency precisely (function role policy, SSM parameter, Function URL, function), with the resource path for each link. The `assertions` module made it easy to test promises in CI: no secret value in the template, Bedrock limited to one model, logs kept one week. `Runtime.NODEJS_24_X` and `TableV2` were there.
- **What needs work:** A common need, a function that knows its own Function URL, has no built in answer; the cycle forces an SSM parameter or a custom domain. A short pattern in the Lambda docs would save time. The first synth printed "83 feature flags are not configured" with no hint whether a new project should care.
- **Onboarding:** Good for someone who knows CloudFormation; validated before any account was available.
- **Would I build with it again:** Yes.

---

## AWS SDK for JavaScript v3 (DynamoDB document client, SES v2, Secrets Manager, SSM, Polly, Bedrock Runtime)

- **Used for:** The DynamoDB store and demo phone, real email through SES v2, the master secret at cold start, the web URL parameter, Polly neural speech, and Bedrock Converse with tool use. Written and unit tested; not yet run against a real account (FRICTION_LOG.md #5), this section will be updated after the first deploy.
- **What worked well:** Same command pattern in every client. `removeUndefinedValues` on the document client avoids a whole class of marshalling errors. `ReturnValues: "ALL_OLD"` on delete gives single use sign in links in one call.
- **What needs work:** Each client pulls many small packages; bundles are fine with esbuild (about 2 MB per function) but installs are slow. Testing without an account needs DynamoDB Local (Java or Docker); a pure JavaScript local table for tests would help.
- **Onboarding:** Smooth; the types document every input.
- **Would I build with it again:** Yes.

---

## GitHub Spec Kit (speckit skills, spec-kit 0.16.5.dev0)

- **Used for:** The whole method before code: constitution, specify, clarify, plan, tasks, analyze; then the task list as the build checklist (110 tasks).
- **What worked well:** `analyze` caught a real contradiction between the constitution and the plan before any code existed. The clarify step's one question at a time format fit a solo builder. Tasks with file paths made progress easy to track across sessions.
- **What needs work:** The generated plan template assumes a team; a solo, three week hackathon needed the schedule added by hand.
- **Onboarding:** Smooth; each step says what to run next.
- **Would I build with it again:** Yes.

---

## Hono 4.13 (with Hono JSX and `@hono/aws-lambda`)

- **Used for:** The web app and the MCP server's HTTP layer: server rendered pages with Hono JSX, secure headers with a strict CSP, signed cookies, and Lambda Function URL handlers.
- **What worked well:** `app.request()` lets contract tests drive the real app in process, including the MCP endpoint through the official client. The same app runs on Node locally and on Lambda unchanged.
- **What needs work:** The built in Lambda adapter is deprecated in favor of a separate package, which the guide does not say yet (FRICTION_LOG.md #4).
- **Onboarding:** Fast.
- **Would I build with it again:** Yes.

---

## axe-core with Playwright (`@axe-core/playwright` 4.13)

- **Used for:** WCAG 2.2 AA checks on every page in light and dark, including a family form with errors and the Echo after a turn.
- **What worked well:** It found two real problems on the first run: a heading whose id collided with an input, which left the family password field without a label, and a scrollable Echo screen that the keyboard could not reach.
- **What needs work:** Results name CSS selectors only; a short "why it matters" line per rule in the default output would help non specialists.
- **Onboarding:** Five lines of code.
- **Would I build with it again:** Yes.

---

## Vite 8 and Preact 10

- **Used for:** The simulated Echo Show client (speech in and out, light ring, MCP Apps host, demo phone) and the shared stylesheet, built to fixed names so server rendered pages can link them under a strict CSP.
- **What worked well:** Fast builds; Preact keeps the Echo client at about 69 KB gzipped including the MCP Apps bridge.
- **What needs work:** Nothing blocking.
- **Onboarding:** Smooth.
- **Would I build with it again:** Yes.


---

## Amazon Bedrock (Converse API, Claude Haiku 4.5) and AWS Lambda Function URLs

- **Used for:** The full mode of the simulated Alexa+: Converse with the MCP server's tools as Bedrock tools, and two Lambda functions behind Function URLs (web app and MCP server).
- **What worked well:** Converse's tool use maps one to one onto MCP tools, so the same JSON schemas serve both. Haiku 4.5 answers a plain turn in about 1.2 s from France, and follows "at most three sentences" and "ask the question word for word" most of the time. First deploy to a working stack took under 2 minutes with CDK.
- **What needs work:** A turn that needs a tool is two Converse calls, about 3 s together, which is the whole budget of a voice turn; streaming the first sentence or a lighter tool round would help voice products. The model often writes em dashes and a preamble before its tool call. Lambda Function URLs rename the `WWW-Authenticate` header to `x-amzn-Remapped-www-authenticate`, which MCP authorization discovery relies on (FRICTION_LOG.md #9).
- **Onboarding:** The Model access page is gone; the Anthropic use case banner in the Model catalog is easy to find once you know (FRICTION_LOG.md #7).
- **Would I build with it again:** Yes, with the rules answering what must be instant and the model answering what is open.
