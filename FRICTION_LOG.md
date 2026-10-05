# Friction Log

Each entry is written at the moment the friction happens, never reconstructed afterwards.

---

## #1: Unclear access status of the Alexa+ MCP Toolkit

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

## #2: MCP TypeScript SDK v2 release status hard to confirm from the docs

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

## #3: TypeScript `latest` (7.0) is not supported by typescript-eslint

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

## #4: Hono's built in Lambda adapter is deprecated, but only the type file says so

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

## #5: No AWS account in this environment yet; cloud work proceeds without deploying

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
- **Outcome:** Resolved the same day: the owner created the account and the stack was deployed and measured that evening (entries #7 to #9 cover what the first deploy found).

---

## #6: `pnpm dev` never started the web server on Windows

- **Date:** 2026-10-02
- **Task attempted:** Run the quickstart from a clean clone (T109).
- **Steps:**
  1. `pnpm dev` ran the web app's script `vite build --watch & tsx watch src/local.ts`.
  2. On Windows, pnpm runs scripts with cmd, where `&` runs the two commands one after the other; `vite build --watch` never exits, so the server never started.
  3. Splitting the script into `dev:assets` and `dev:server` run by `pnpm run --parallel "/^dev:/"` started both, but `tsx watch` started from a non interactive shell still did not open the port.
  4. `node --watch --import tsx src/local.ts` worked everywhere.
- **Expected:** One dev script that behaves the same on Windows, macOS and Linux.
- **Actual:** About 30 minutes to find two separate Windows only causes; the clean clone run was the only thing that caught it, since the tests start the server another way.
- **Severity:** Medium for a judge or contributor on Windows (the documented first command did nothing visible).
- **Workaround:** pnpm's parallel regex scripts and Node's built in watch mode with the tsx loader.
- **Suggestion:** pnpm could warn when a script uses `&` and the shell is cmd; tsx could document `node --watch --import tsx` as the portable form.

---

## #7: Bedrock "Model access" page gone; the access key flow leaves the user with no permissions

- **Date:** 2026-10-02
- **Task attempted:** First AWS setup by the owner, following `docs/deploy.md` (T080 prerequisites).
- **Steps:**
  1. `docs/deploy.md` (written from the Bedrock docs we had) said to open Model access and enable Claude Haiku 4.5. The owner could not find the page: AWS retired it, models are now enabled on first use, and Anthropic models show a "Submit use case details" banner in the Model catalog instead.
  2. The owner created an IAM user and an access key. The console flow let the user be created with no policy attached, and nothing on the access key screens said so.
  3. `pnpm aws:check` then failed Bedrock, Polly and SES with AccessDeniedException. Our own message for Bedrock pointed at the use case form, which was the wrong cause.
- **Expected:** Setup docs that match the console, and a clear sign that a new IAM user has no permissions before its key is used.
- **Actual:** About 20 minutes of the owner searching the console, then a misleading first error from our script.
- **Severity:** Medium (blocks the first deploy; easy once understood).
- **Workaround:** `docs/deploy.md` now describes the use case banner; `pnpm aws:check` recognizes "not authorized to perform" and says to attach a policy to the IAM user.
- **Suggestion:** The IAM create user flow could warn when no permission is attached; the Bedrock getting started page could say first in bold that the Model access page no longer exists.

---

## #8: `pnpm deploy` runs pnpm's own deploy command, not the project script

- **Date:** 2026-10-02
- **Task attempted:** First real deploy (T080) with the command from `docs/deploy.md`.
- **Steps:**
  1. Before running it, checked `pnpm deploy --help`: it prints pnpm's experimental workspace deploy command ("Deploy a package from a workspace"), which takes a target directory.
  2. The root script was `"deploy": "pnpm --filter @asg/infra deploy"`, which hits the same built in command one level down.
- **Expected:** `pnpm <script>` runs a script when one exists, as it does for `test` or `check`.
- **Actual:** Built in commands win over scripts with the same name. The documented command would have failed or done something else, and the rehearsal never caught it because it deploys through its own path.
- **Severity:** Medium (the one documented deploy command was wrong).
- **Workaround:** `pnpm run deploy` everywhere (README, docs, quickstart, preflight hint) and `pnpm --filter @asg/infra run deploy` in the root script.
- **Suggestion:** pnpm could warn when a package.json script shadows a built in command name.

---

## #9: Lambda Function URLs rename `WWW-Authenticate`

- **Date:** 2026-10-02
- **Task attempted:** `pnpm smoke` against the first real deploy (T080).
- **Steps:**
  1. The MCP server answers 401 with `WWW-Authenticate: Bearer resource_metadata="..."`, as MCP authorization asks, and the local server and the rehearsal both showed it.
  2. Through the Function URL, the 401 arrived with `x-amzn-Remapped-www-authenticate` instead, so the smoke check failed.
- **Expected:** Headers set by the function reach the client as set, or the documentation of Function URLs says which ones are renamed.
- **Actual:** An MCP client that looks only at `WWW-Authenticate` cannot find the protected resource metadata from the 401. Our emulator could not have caught it.
- **Severity:** Low for this project (MCP clients also try `/.well-known/oauth-protected-resource`, which works), higher for any service that relies on the header.
- **Workaround:** The smoke check accepts the renamed header and checks the well known address separately.
- **Suggestion:** Document the renamed headers on the Function URL page, or let `WWW-Authenticate` through on 401 responses.

---

## #10: The Echo dropped words while Alexa spoke (only visible with real Polly audio)

- **Date:** 2026-10-02
- **Task attempted:** The Playwright suite against the deployed site (T102).
- **Steps:**
  1. Locally, speech ends at once in a headless browser; in the cloud the Echo plays Polly audio, about 10 s per line.
  2. Several scenarios failed remotely: a "Yes" typed while Alexa was still speaking, or while her answer was on its way, was ignored without a word.
- **Expected:** Talking over Alexa stops her and is heard, as on a real Echo.
- **Actual:** A real product bug that only real audio and real network time could show. The person would have had to repeat themselves, or think the device was broken.
- **Severity:** High for the people this is for: answering before the end of a question is common.
- **Workaround:** New words now stop the speech and go through; words sent while an answer is on its way are sent right after it. A Playwright scenario keeps Alexa talking forever and checks that a typed "Yes" is answered; remote runs now stub audio the same way locally and in the cloud.
- **Suggestion:** For our own process: run the suite against the deployed stack early, not only the emulator.
