# Friction Log

Each entry is written at the moment the friction happens, never reconstructed afterwards.

---

## #1 — Unclear access status of the Alexa+ MCP Toolkit

- **Date:** 2026-10-01
- **Task attempted:** Find out whether a solo external developer can connect a self-hosted MCP server to a real Alexa+ device for the hackathon.
- **Steps:**
  1. Opened the hackathon Resources page. It links only to generic MCP docs (Agent Skills, Streamable HTTP spec). No Alexa+ toolkit, CLI or simulator link.
  2. Searched developer.amazon.com and found the Alexa+ MCP Toolkit Overview and QuickStart.
  3. QuickStart lists prerequisites (Alexa developer account, remote URL, `alexa-ai configure`) with no mention of an allowlist.
  4. Only the Alexa+ docs home page says: "At this time, Category SDK and MCP Toolkit are available to select partners only." The Alexa+ for Builders landing page confirms: "currently available to select partners working directly with our team."
  5. The hackathon Rules then confirm a simulated Alexa+ experience is an accepted submission path.
- **Expected:** One clear statement, on the hackathon Resources page and on the QuickStart, telling participants whether they can deploy to real Alexa+ and how.
- **Actual:** The QuickStart reads as self-serve; the partner restriction is only on a different page. About 30 minutes of cross-checking across 6 pages to reach a confident answer.
- **Severity:** Medium (no hard blocker, but a developer following the QuickStart alone would hit a wall later, after building around the CLI).
- **Workaround:** Took the official simulated path: real MCP server + web app that simulates Alexa+ and calls the server through an MCP client.
- **Suggestion:** Add an availability banner at the top of every MCP Toolkit page ("Partner preview, not self-serve") and a short "Hackathon participants: here is your path" box on the Devpost Resources page. Publishing a public web simulator or the Local Inspector for everyone would let builders test against the real Alexa+ add-on contract.

### Sources
- https://developer.amazon.com/docs/alexaplus/add-ons/home.html
- https://developer.amazon.com/alexaplus/
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
- https://amazonappdev2026.devpost.com/resources
- https://amazonappdev2026.devpost.com/rules

---

## #2 — MCP TypeScript SDK v2 release status hard to confirm from the docs

- **Date:** 2026-10-01
- **Task attempted:** Choose between MCP TypeScript SDK v1 and v2 for a server that must speak protocol 2025-11-25 (Alexa+) and ideally 2026-07-28.
- **Steps:**
  1. Read the v2 "Protocol versions" docs page: it explains eras and `createMcpHandler`, but does not say whether v2 is stable.
  2. Read the SDK betas blog post: it says v2 has "no stable release yet" and recommends stable releases for critical workloads.
  3. Checked npm: `@modelcontextprotocol/server` latest tag is 2.2.0, so v2 is in fact released.
- **Expected:** The v2 docs home states the current release status and the latest version.
- **Actual:** The most visible official post is outdated; the answer only came from the npm registry.
- **Severity:** Low (about 10 minutes, no blocker).
- **Workaround:** Trusted the npm `latest` dist tag and chose v2.
- **Suggestion:** Add a release status badge and "latest stable" line to the top of the v2 docs, and an update note on the beta blog post pointing to the GA release.

---

## #3 — TypeScript `latest` (7.0) is not supported by typescript-eslint

- **Date:** 2026-10-01
- **Task attempted:** Install the TypeScript toolchain for the monorepo (task T001 to T003).
- **Steps:**
  1. `npm view typescript version` returned 7.0.2 (the `latest` tag).
  2. `npm view typescript-eslint peerDependencies` showed `typescript >=4.8.4 <6.1.0`.
- **Expected:** The `latest` compiler works with the most used TypeScript lint stack.
- **Actual:** Installing `latest` would break linting with a peer dependency conflict.
- **Severity:** Low (caught before install, about 5 minutes).
- **Workaround:** Pinned `typescript@6.0.3`, the newest version inside the supported range.
- **Suggestion:** typescript-eslint could print the supported range and the reason in its install warning; TypeScript release notes could link the lint compatibility status.

---

## #4 — Hono's built in Lambda adapter is deprecated, but only the type file says so

- **Date:** 2026-10-02
- **Task attempted:** Run the MCP server and the web app on AWS Lambda behind Function URLs (task T078).
- **Steps:**
  1. Followed the Hono AWS Lambda guide, which imports `handle` from `hono/aws-lambda`.
  2. Opened the type definitions to check Function URL support: every export carries `@deprecated`, "will be removed in v5. Install `@hono/aws-lambda`".
  3. Installed `@hono/aws-lambda@1.0.0`; same API, peer dependency `hono >=4.13.9`.
- **Expected:** The guide uses the package that will keep working.
- **Actual:** The guide and the code disagree; the editor shows the warning only on hover.
- **Severity:** Low (about 5 minutes).
- **Workaround:** Used `@hono/aws-lambda` from the start.
- **Suggestion:** Update the AWS Lambda guide to the new package and print a one time runtime warning from the old import.

---

## #5 — No AWS account in this environment yet; cloud work proceeds without deploying

- **Date:** 2026-10-02
- **Task attempted:** Phase 6 (T076 to T080): DynamoDB, SES, Lambda, CDK, deploy and measure.
- **Steps:**
  1. `aws --version`: the AWS CLI is not installed on the build machine, and no account or Bedrock access is configured yet.
  2. Searched for a way to test the DynamoDB key design without an account: DynamoDB Local needs Java or Docker, neither installed.
- **Expected:** A hackathon path to try Lambda, DynamoDB and Bedrock before an account is ready (credits or a sandbox).
- **Actual:** Nothing can be deployed or measured in the cloud until the owner sets up an account and Bedrock model access.
- **Severity:** Medium (blocks T080 and the cloud measurements; does not block code).
- **Workaround:** Put the table behind a narrow interface, ran all 175 contract tests on the DynamoDB store through an in memory table with DynamoDB ordering rules, validated the stack with `cdk synth` and CDK assertions, and wrote `docs/deploy.md` for a one command deploy.
- **Suggestion:** Hackathon resources could list the AWS credit or sandbox path for the AWS Builder challenge on the main Devpost page.
