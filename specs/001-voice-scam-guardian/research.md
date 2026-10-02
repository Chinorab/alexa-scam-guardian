# Research: Voice Scam Guardian

Phase 0 output. Each decision resolves an unknown from the plan's Technical Context.
Checked 2026-10-01.

## R1. MCP protocol version and SDK

- **Decision**: TypeScript MCP SDK v2 (`@modelcontextprotocol/server` 2.2.0,
  `@modelcontextprotocol/client` 2.2.0, `@modelcontextprotocol/hono` 2.0.1), served through
  `createMcpHandler` in stateless mode. One endpoint answers protocol 2026-07-28 (current
  stable) and 2025-11-25 (the version Alexa+ for Builders documents).
- **Rationale**: The hackathon requires 2025-11-25 or later. Serving both eras from one
  endpoint covers the hackathon rule, the Alexa+ add-on contract and the newest clients.
  Stateless HTTP fits Lambda and AgentCore Runtime with no session affinity.
- **Alternatives**: SDK v1.31 (stable, 2025-11-25 only, would need a later migration);
  Python SDK (would split the stack in two languages).
- **Sources**: https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions ,
  https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ ,
  https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html

## R2. Screen cards on Echo Show

- **Decision**: MCP Apps extension (`@modelcontextprotocol/ext-apps` 2.0.3). Tools that have
  a visual result declare `_meta.ui.resourceUri` pointing to `ui://guardian/...` resources
  served as `text/html;profile=mcp-app`. The simulated Echo acts as an MCP Apps host and
  renders them in a sandboxed iframe.
- **Rationale**: The Alexa+ QuickStart asks for visuals that follow the MCP Apps standard. The
  same cards then work on a real Echo Show later, and the demo shows real MCP Apps hosting.
- **Alternatives**: Cards built only in the simulator (not portable to Alexa+).
- **Sources**: https://modelcontextprotocol.io/extensions/apps/overview ,
  https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html

## R3. Hosting (AWS Builder mini challenge)

- **Decision**: AWS Lambda (`nodejs24.x`, arm64) for both the MCP server and the web app,
  each behind a Function URL, defined with AWS CDK (`aws-cdk-lib` 2.272). AgentCore Runtime is
  a stretch goal: the MCP server is already stateless on `/mcp`, so only a container image on
  port 8000 is missing.
- **Rationale**: Lambda qualifies for the mini challenge, has the shortest path to a public
  URL, and keeps tool latency low with a small bundle. AgentCore Runtime requires an ARM64
  container and inbound auth setup, which costs days we need for the product.
- **Alternatives**: AgentCore Runtime first (more setup); App Runner or EC2 (always on cost,
  no mini challenge advantage).
- **Sources**: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-mcp-protocol-contract.html ,
  https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html

## R4. Reasoning model for the simulated Alexa+

- **Decision**: Amazon Bedrock Converse API with tool use. Default model
  `us.anthropic.claude-haiku-4-5-20251001-v1:0` (inference profile), set by environment
  variable so Amazon Nova or another model can be compared with the same red team suite.
- **Rationale**: Fast model for a 3 second turn budget, good tool use, available on Bedrock
  through a US inference profile (the bare model id is not accepted on demand).
- **Risk**: Published wall latency figures for long outputs exceed our budget; turns are kept
  short (three sentences) and the simplified mode (FR-036) takes over at 3 seconds.
- **Alternatives**: Larger models (slower); Amazon Nova Lite (to be measured on the red team
  suite before any switch).
- **Sources**: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html

## R5. Safety enforcement architecture (Principles I to IV)

- **Decision**: Three layers.
  1. **Tool layer (MCP server)**: no tool accepts a destination; outreach is two step
     (`prepare_outreach` returns the exact question, `confirm_outreach` sends only if the
     user's own reply parses as an explicit yes); inputs are redacted before storage; the
     family password is only compared, never returned.
  2. **Output guard (core package)**: every spoken line is checked before speech for payment
     approval phrases, digit runs, the family password, the word "AI", dashes, length and
     question count. A failing line is replaced by the pre approved phrase for that state.
  3. **Simplified mode**: a rule based dialogue engine with fixed phrases, used when the model
     fails or is slow, and used in tests as the reference behavior.
- **Rationale**: On a real Alexa+, the add-on cannot filter what Alexa says, so the tools
  themselves must make unsafe actions impossible. In the simulation we also control speech,
  so the guard adds a second net. Both are deterministic and testable.
- **Alternatives**: Prompt only safety (rejected by the constitution).

## R6. Sensitive number detection and interruption

- **Decision**: Normalize spoken digits ("four one two", "oh") to digits, then redact any run
  of 6 or more digits (spaces, dashes and dots allowed between them). Money amounts written
  with "$" or followed by "dollars" are kept. A phone number is kept only when introduced by
  caller context ("called from", "caller ID", "his number was") and is stored as
  `caller_number`, which no tool can use as a destination. Interruption triggers on interim
  speech results as soon as 4 digits follow a card, account, routing or Social Security
  keyword, or 6 digits appear in a row.
- **Rationale**: Catches cards, accounts, routing and Social Security numbers without blocking
  dollar amounts, and stops the older adult early instead of after the full number.
- **Alternatives**: Luhn only card detection (misses SSN and accounts).

## R7. Voice in the simulated Echo

- **Decision**: Speech to text with the browser speech recognition API (Chrome, Edge), interim
  results enabled, typed input as fallback. Text to speech with Amazon Polly (neural en-US
  voice, configurable), slower rate on "repeat"; browser speech synthesis as fallback.
- **Rationale**: Fastest path to a working voice loop; Polly gives a natural voice and counts
  as a documented AWS integration. Amazon Transcribe streaming is a stretch goal.
- **Privacy note**: browser speech recognition may be processed by the browser vendor; the
  privacy page says so and typed input is always available. Constitution v1.1.1 treats this
  layer as the platform recognizer; product code redacts its output before any other use.
- **Alternatives**: Amazon Transcribe streaming from the browser (more setup: temporary
  credentials and audio streaming).

## R8. Data storage

- **Decision**: Amazon DynamoDB, one table, on demand capacity, TTL attribute for automatic
  deletion (checks 30 days, sign in links 15 minutes, demo households 24 hours). An in memory
  store implements the same interface for local runs and tests.
- **Rationale**: Serverless, no connection pooling issues on Lambda, TTL covers FR-030.
- **Alternatives**: SQLite (not shared across Lambda instances), Aurora (cost, setup).

## R9. Email and text messages

- **Decision**: Amazon SES v2 for real email (sign in links, check messages, heads up). Text
  messages go to the on screen demo phone through a `TextChannel` interface; a real channel
  (AWS End User Messaging SMS) can be plugged in later by configuration.
- **Constraint**: SES starts in sandbox mode: only verified recipients, 200 messages per day.
  Production access is usually granted in 1 to 2 business days and needs a verified domain.
  Request it on day 1. Until then, demo recipients are verified addresses.
- **Sources**: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html

## R10. Family page access and Alexa+ account linking

- **Decision**: Email sign in link (single use, 15 minutes, hashed in storage) and a signed,
  HttpOnly session cookie. The web app mints short lived household tokens (signed JWT, issuer
  and audience checked) that the MCP server requires as a bearer token. The MCP server
  publishes OAuth protected resource metadata, so an OAuth 2.1 authorization server with
  PKCE (for example Amazon Cognito) can issue the same claims when Alexa+ account linking
  opens.
- **Demo household**: each visitor gets a private demo household seeded on demand (24 hour
  TTL) so judges trying it at the same time never see each other's data. "Reset" reseeds it.
- **Rationale**: Matches the spec (FR-026) with the least moving parts, while staying on the
  Alexa+ contract path.
- **Alternatives**: Cognito now (passwordless email codes instead of links, more setup).

## R11. Web stack

- **Decision**: Hono on Lambda for server routes; server rendered pages (Hono JSX) for the
  family page, reply page and privacy page so forms work without JavaScript; Vite and Preact
  for the simulated Echo client. TypeScript everywhere, pnpm workspaces, zod for schemas.
- **Rationale**: One language, small bundles (fast cold starts), accessible server rendered
  forms for families on any phone.
- **Alternatives**: Next.js (heavier on Lambda), plain React SPA for the family page (needs
  JavaScript for basic forms).

## R12. Testing

- **Decision**: Vitest for unit and contract tests (MCP client against the in process server);
  a red team suite of at least 60 utterances run against the guard, the simplified mode and,
  in an optional live mode, the Bedrock agent; Playwright for end to end runs of the demo
  scenarios; axe for WCAG 2.2 AA checks.
- **Rationale**: Covers SC-001, SC-003, SC-007, SC-008 and SC-010 automatically.

## R13. Scam pattern sources

- **Decision**: Patterns written from FTC consumer alerts and guidance (consumer.ftc.gov) and
  FBI and IC3 public service announcements (fbi.gov, ic3.gov). Each entry stores title, URL,
  publisher and retrieval date. The DOJ National Elder Fraud Hotline (833-FRAUD-11,
  833-372-8311, weekdays 10 a.m. to 6 p.m. Eastern) is stored as a resource, not a pattern.
- **Sources**: https://ovc.ojp.gov/program/elder-fraud-abuse/national-elder-fraud-hotline
- **Open**: The exact pattern list and each source URL are collected during implementation
  and reviewed before the dataset is published.

## Owner actions needed (not code)

1. AWS account with Bedrock model access to the chosen model in `us-east-1`.
2. A domain to verify in SES (needed for production access and reliable delivery).
3. SES production access request, ideally on 2026-10-02.
