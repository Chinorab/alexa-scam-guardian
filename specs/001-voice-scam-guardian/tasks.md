---

description: "Task list for the Voice Scam Guardian (revised after speckit-analyze 2026-10-01)"
---

# Tasks: Voice Scam Guardian

**Input**: Design documents from `/specs/001-voice-scam-guardian/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required. The constitution makes safety tests mandatory (Development Workflow) and
the spec defines automated success criteria (SC-001, SC-003, SC-007, SC-008, SC-010). Safety
tests are written first and must fail before the code they cover exists.

**Organization**: Tasks are grouped by user story. Story order follows priority, with the
simulated Echo (US6, P1) placed after US1 and US2 because its voice and screen layer wraps
their flows.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US6 from spec.md
- Paths follow the monorepo layout in plan.md

## Running logs (every phase)

FEEDBACK.md gets a section the first time a tool, SDK or API is used. FRICTION_LOG.md gets an
entry the moment a friction happens. PROGRESS.md is updated at the end of each task group.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, tooling, configuration

- [X] T001 Create pnpm workspace with `packages/scam-patterns`, `packages/core`, `apps/mcp-server`, `apps/web`, `infra`, `tests` in pnpm-workspace.yaml and root package.json (Node 24 engines, scripts dev, test, test:e2e, test:a11y, test:redteam:live, deploy, token:demo)
- [X] T002 [P] Add shared strict TypeScript config in tsconfig.base.json and per package tsconfig.json files
- [X] T003 [P] Configure ESLint and Prettier in eslint.config.js and .prettierrc
- [X] T004 [P] Configure Vitest projects (unit, contract) in vitest.config.ts
- [X] T005 [P] Create .env.example documenting every variable (AGENT_MODE, BEDROCK_MODEL_ID, AWS_REGION, TABLE_NAME, SES_FROM, HOUSEHOLD_TOKEN_SECRET, SESSION_SECRET, MCP_URL, WEB_URL, POLLY_VOICE) and .gitignore excluding .env, dist, cdk.out
- [X] T006 [P] Write copy lint script that fails on emojis, en or em dashes, spaced hyphens and the standalone word "AI" in user facing strings in scripts/lint-copy.ts
- [X] T007 [P] Add GitHub Actions workflow running lint, lint-copy, typecheck and pnpm test on every push and pull request in .github/workflows/ci.yml
- [X] T008 Add README skeleton (what it is, local run, architecture placeholder, links to spec) in README.md
- [X] T009 Create the public GitHub repository, add the MIT LICENSE, push, and protect main so the CI checks (lint, lint-copy, typecheck, test including red team) are required before merge, in LICENSE and repository settings

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Safety core, dataset, MCP server and web shells, agent loop. No story work
before this phase is done.

### Safety tests first

- [X] T010 [P] Write redaction tests (spoken digits, card, SSN, routing, account, dollar amounts kept, caller number context) in packages/core/src/redact/redact.test.ts
- [X] T011 [P] Write output guard tests (approval phrases, digit runs, password echo, "AI", dashes, over three sentences, two questions) in packages/core/src/guard/guard.test.ts
- [X] T012 [P] Write confirmation parser tests (yes variants, no, stop, cancel, silence, unclear, "just Michael" subset) in packages/core/src/confirm/confirm.test.ts

### Core and dataset

- [X] T013 [P] Define ports (Store, Mailer, TextChannel, Clock, IdGen) and shared domain types from data-model.md in packages/core/src/ports/index.ts
- [X] T014 [P] Implement in memory Store with TTL handling in packages/core/src/ports/memory-store.ts
- [X] T015 [P] Implement outbox Mailer and demo phone TextChannel (in memory) in packages/core/src/ports/outbox.ts
- [X] T016 [P] Implement a structured logger that only accepts typed, already redacted fields and rejects free text, with tests, in packages/core/src/log/logger.ts and packages/core/src/log/logger.test.ts
- [X] T017 Implement spoken digit normalization and redaction (research R6) in packages/core/src/redact/redact.ts
- [X] T018 Implement output guard with per state safe replacement lines in packages/core/src/guard/guard.ts
- [X] T019 Implement confirmation parser in packages/core/src/confirm/confirm.ts
- [X] T020 [P] Write the scam pattern JSON Schema (pattern, warning sign, source, resource) in packages/scam-patterns/schema/pattern.schema.json
- [X] T021 Research and write at least 8 patterns from FTC and FBI or IC3 pages (family emergency, government impersonation, tech support, bank impersonation, romance, prize, cash courier, crypto investment) with source URL and retrieval date, plus DOJ hotline resource, in packages/scam-patterns/data/patterns.json
- [X] T022 [P] Write source check script failing on missing source, non official publisher or unreachable URL in packages/scam-patterns/scripts/check-sources.ts
- [X] T023 Implement rule based warning sign matcher over the dataset in packages/core/src/match/match.ts with tests in packages/core/src/match/match.test.ts
- [X] T024 Define the fixed phrase catalog (every simplified mode line, three sentences max, no dashes) in packages/core/src/dialogue/phrases.ts

### MCP server shell

- [X] T025 Create MCP server factory with createMcpHandler (stateless, eras 2026-07-28 and 2025-11-25) and the shared assistantRules block in apps/mcp-server/src/server.ts
- [X] T026 [P] Implement household bearer token verification (iss, aud, sub, exp) and 401 with WWW-Authenticate in apps/mcp-server/src/auth/token.ts
- [X] T027 [P] Serve protected resource metadata at /.well-known/oauth-protected-resource in apps/mcp-server/src/auth/metadata.ts
- [X] T028 Add local Node entry on port 8788 using the Hono adapter in apps/mcp-server/src/local.ts
- [X] T029 Add token minting helper and `pnpm token:demo` script in apps/web/src/auth/household-token.ts

### Web and agent shell

- [X] T030 Load the design skills and set the design direction for the Echo Show and the family page (tokens, type scale, icon set, no pills, no gradients) before any page is built in apps/web/src/styles/tokens.css
- [X] T031 Create Hono app with strict CSP, base layout (20 px body, high contrast tokens, light and dark), skip link and footer privacy link in apps/web/src/app.tsx and apps/web/src/views/layout.tsx
- [X] T032 [P] Write the privacy page (what is stored, why, retention, deletion, browser speech note, no call audio) in apps/web/src/views/privacy.tsx
- [X] T033 [P] Add favicon (SVG shield icon and ICO fallback) in apps/web/public/favicon.svg and apps/web/public/favicon.ico
- [X] T034 Implement MCP client wrapper that lists tools and resources and calls them with the household token in apps/web/src/agent/mcp-client.ts
- [X] T035 Implement Bedrock Converse loop with MCP tools, max 3 tool rounds, system prompt from the Conversation Design rules in apps/web/src/agent/bedrock-agent.ts
- [X] T036 Implement simplified mode engine (state machine over check states, uses matcher and phrase catalog) in packages/core/src/dialogue/engine.ts
- [X] T037 Implement turn orchestrator: redact input, run full mode with 3 s deadline, fall back to simplified mode, pass every line through the guard in apps/web/src/agent/turn.ts
- [X] T038 Implement POST /api/device/start (demo household per visitor, 24 h TTL) and POST /api/converse in apps/web/src/routes/api.ts
- [X] T039 Create minimal Echo client (typed input, large captions, answer text) to exercise the API in apps/web/echo/src/main.tsx
- [X] T040 Add local web entry on port 8787 serving pages, API and built Echo assets in apps/web/src/local.ts

**Checkpoint**: typed turn goes browser, web, Bedrock or simplified mode, MCP server and back.

---

## Phase 3: User Story 1 - Describe a call and hear the warning signs (Priority: P1) MVP

**Goal**: Warning signs with official sources, never an approval, 911 on danger, interruption
on sensitive numbers.

**Independent Test**: Empty household, describe the grandparent scam call; warning signs are
spoken and shown with sources, no approval, at most one question.

### Tests for User Story 1

- [X] T041 [P] [US1] Contract test for assess_call (signs with sources, danger, interrupt, no signs case) in tests/contract/assess-call.test.ts
- [X] T042 [P] [US1] Red team utterances v1, 30 or more (approval pressure, "so can I pay", sensitive numbers, danger) with expected properties in tests/redteam/utterances.json
- [X] T043 [P] [US1] Red team runner against guard plus simplified mode in tests/redteam/offline.test.ts

### Implementation for User Story 1

- [X] T044 [US1] Implement assess_call tool (create or extend check, redaction flags, nextStep) in apps/mcp-server/src/tools/assess-call.ts
- [X] T045 [P] [US1] Build MCP Apps view ui://guardian/warning-signs (icons with labels, sources, 32 px text) in apps/mcp-server/src/ui/warning-signs.html
- [X] T046 [US1] Register the warning signs resource and link it via _meta.ui.resourceUri in apps/mcp-server/src/ui/register.ts
- [X] T047 [US1] Implement close_check tool and closing after 30 minutes idle in apps/mcp-server/src/tools/close-check.ts
- [X] T048 [US1] Add simplified mode states for assessment, no signs found, danger first, payment question and sensitive interrupt in packages/core/src/dialogue/engine.ts
- [X] T049 [US1] Implement POST /api/interim (interrupt on sensitive number start) in apps/web/src/routes/api.ts
- [X] T050 [US1] Tune the agent system prompt and tool descriptions for US1 phrasing (thanks first, signs, wait) in apps/web/src/agent/prompt.ts
- [X] T051 [US1] Render uiResources returned by /api/converse in a sandboxed iframe (MCP Apps host bridge) in apps/web/echo/src/mcp-apps-host.tsx

**Checkpoint**: V1, V8, V9 from quickstart pass by text.

---

## Phase 4: User Story 2 - Check with the real relative (Priority: P1)

**Goal**: Verification through saved family members only, explicit yes, one tap reply,
outcome reporting, family password comparison.

**Independent Test**: One relative saved; describe a call from "my grandson", say yes, reply
"It wasn't me" on the demo phone; Alexa reports it without blame.

### Tests for User Story 2

- [X] T052 [P] [US2] Contract tests for prepare_outreach and confirm_outreach (no destination param, nothing sent on no or unclear, expiry, opted out member) in tests/contract/outreach.test.ts
- [X] T053 [P] [US2] Contract tests for get_updates and check_family_password (no hint, lock after 3) in tests/contract/updates-password.test.ts
- [X] T054 [P] [US2] Add 20 or more red team utterances (call back the caller, use this number, say the password, "he confirmed so I can pay") to tests/redteam/utterances.json

### Implementation for User Story 2

- [X] T055 [P] [US2] Implement demo household seed (older adult first name, Michael grandson text channel, Sarah trusted contact) in packages/core/src/demo/seed.ts
- [X] T056 [US2] Implement family member matching (relationship, name, nicknames, ambiguity) in packages/core/src/match/members.ts
- [X] T057 [US2] Implement prepare_outreach and confirm_outreach (verify role) with rate limit in apps/mcp-server/src/tools/outreach.ts
- [X] T058 [P] [US2] Write check message templates (email and text, reply link, stop link, "call them on the number you know") in apps/mcp-server/src/messages/check-message.ts
- [X] T059 [US2] Implement get_updates with device events and nextMemberToTry after wait time in apps/mcp-server/src/tools/get-updates.ts
- [X] T060 [P] [US2] Implement check_family_password (scrypt compare, 3 attempt lock) in apps/mcp-server/src/tools/family-password.ts
- [X] T061 [P] [US2] Implement get_guidance for caller_on_line, no_answer, confirmed_real, danger, general in apps/mcp-server/src/tools/get-guidance.ts
- [X] T062 [P] [US2] Build MCP Apps view ui://guardian/check-status in apps/mcp-server/src/ui/check-status.html
- [X] T063 [US2] Implement reply page GET and POST /r/:token and GET /stop/:token in apps/web/src/routes/reply.tsx
- [X] T064 [US2] Implement GET /api/device/:id/events and GET /api/device/:id/demo-phone in apps/web/src/routes/api.ts
- [X] T065 [US2] Add simplified mode states for pick member, offer verify, waiting, it wasn't me, it was me, no answer, call back refusal, password checks in packages/core/src/dialogue/engine.ts
- [X] T066 [US2] Keep an open check across off topic turns (resume state in the simplified mode, rule in the agent prompt, test) in packages/core/src/dialogue/engine.ts and tests/contract/off-topic.test.ts

**Checkpoint**: V2, V3, V5, V7, V10, V11 pass by text.

---

## Phase 5: User Story 6 - Simulated Echo experience (Priority: P1)

**Goal**: Echo Show look and feel: voice in and out, captions, light ring, chime, cards,
demo phone, repeat, demo reset.

**Independent Test**: Demo household, run the grandparent scenario by voice end to end and
watch the relative's reply arrive.

### Tests for User Story 6

- [X] T067 [P] [US6] Playwright scenarios V1 to V4 using typed input and a mocked speech layer in tests/e2e/echo.spec.ts

### Implementation for User Story 6

- [X] T068 [US6] Build the Echo Show frame layout (screen, captions, cards area, talk control, typed fallback) in apps/web/echo/src/EchoShow.tsx
- [X] T069 [P] [US6] Implement speech recognition with interim results feeding /api/interim in apps/web/echo/src/speech-in.ts
- [X] T070 [P] [US6] Implement POST /api/tts with Polly (normal and slow rate) in apps/web/src/routes/tts.ts and client playback with browser speech fallback in apps/web/echo/src/speech-out.ts
- [X] T071 [P] [US6] Implement light ring states and chime in apps/web/echo/src/LightRing.tsx
- [X] T072 [US6] Implement event polling, quiet notification and "What's new?" handling in apps/web/echo/src/notifications.ts
- [X] T073 [P] [US6] Build the on screen demo phone (messages, It was me and It wasn't me buttons) in apps/web/echo/src/DemoPhone.tsx
- [X] T074 [US6] Implement "repeat" (slow rate, simpler wording through the guard) in apps/web/src/agent/turn.ts
- [X] T075 [US6] Implement POST /api/demo/reset and a reset control in apps/web/src/routes/api.ts and apps/web/echo/src/EchoShow.tsx

**Checkpoint**: V1 to V4 pass by voice in Chrome; typed input works in any browser.

---

## Phase 6: Cloud foundation (AWS Builder)

**Purpose**: Real storage, email and public URLs so the MCP server is reachable.

- [X] T076 [P] Implement DynamoDB Store adapter with TTL in apps/mcp-server/src/adapters/dynamo-store.ts
- [X] T077 [P] Implement SES v2 Mailer adapter in apps/mcp-server/src/adapters/ses-mailer.ts
- [X] T078 Add Lambda handlers in apps/mcp-server/src/lambda.ts and apps/web/src/lambda.ts
- [X] T079 Write CDK stack (table with TTL, two arm64 nodejs24.x functions with Function URLs, IAM for Bedrock, SES, Polly, DynamoDB, Secrets Manager master secret, SSM web URL parameter) in infra/src/stack.ts and infra/src/app.ts
- [ ] T080 Deploy, record MCP and web URLs, measure tool p95 latency and first answer time in docs/measurements.md (local figures recorded 2026-10-02; deploy waits for the AWS account, see docs/deploy.md)

**Checkpoint**: public MCP URL answers the inspector; V1 and V2 pass on the web URL.

---

## Phase 7: User Story 3 - Let a trusted contact know (Priority: P2)

**Goal**: Heads up messages with explicit yes, combined question naming everyone, subset
answers honored.

**Independent Test**: One trusted contact saved; finish a check, say yes to the heads up; the
message arrives with no sensitive numbers.

### Tests for User Story 3

- [X] T081 [P] [US3] Contract tests for combined question, "just Michael" subset and heads up content without digits in tests/contract/heads-up.test.ts

### Implementation for User Story 3

- [X] T082 [US3] Extend prepare_outreach and confirm_outreach with headsUpMemberIds and combined question wording in apps/mcp-server/src/tools/outreach.ts
- [X] T083 [P] [US3] Write heads up templates (time, claimed identity, what was asked, signs, advice, report link) in apps/mcp-server/src/messages/heads-up.ts
- [X] T084 [US3] Add simplified mode states for offer heads up and combined offer in packages/core/src/dialogue/engine.ts

**Checkpoint**: main dialogue from spec runs word for word in intent.

---

## Phase 8: User Story 4 - Family organizer sets up the household (Priority: P2)

**Goal**: Sign in by email link, members, password, settings, test messages, activity,
delete all.

**Independent Test**: On a phone sized screen, add one relative, one trusted contact and a
password, then send a test message to each, in under 5 minutes.

### Tests for User Story 4

- [X] T085 [P] [US4] Integration tests for sign in links (single use, expiry, rate limit) and session cookie in tests/contract/family-auth.test.ts
- [X] T086 [P] [US4] Playwright scenarios V13 and V14 at 390 px width in tests/e2e/family.spec.ts

### Implementation for User Story 4

- [X] T087 [US4] Implement sign in routes and session cookie in apps/web/src/routes/family-auth.tsx
- [X] T088 [US4] Build household overview and member forms (add, edit, remove, roles, channel) in apps/web/src/routes/family.tsx and apps/web/src/views/family/*.tsx
- [X] T089 [P] [US4] Implement family password set, replace, remove (never displayed) in apps/web/src/routes/family-password.tsx
- [X] T090 [P] [US4] Implement settings (first name, wait time) and test message with rate limit in apps/web/src/routes/family-settings.tsx
- [X] T091 [US4] Implement activity view (checks, signs, messages, outcomes, reports) in apps/web/src/views/family/activity.tsx
- [X] T092 [US4] Implement delete all with typed first name confirmation in apps/web/src/routes/family.tsx
- [X] T093 [US4] Bind the Echo to the signed in household when an organizer opens /echo in apps/web/src/routes/api.ts

**Checkpoint**: V13 and V14 pass.

---

## Phase 9: User Story 5 - Prepare a report (Priority: P3)

**Goal**: Report summary with official links, never submitted; already paid guidance.

**Independent Test**: After a confirmed scam check, ask for the report; summary on screen and
on the family page with both links and no submission.

### Tests for User Story 5

- [X] T094 [P] [US5] Contract tests for prepare_report (facts redacted, submittedBySystem false, three links) and get_guidance already_paid per method in tests/contract/report.test.ts

### Implementation for User Story 5

- [X] T095 [US5] Implement prepare_report tool in apps/mcp-server/src/tools/prepare-report.ts
- [X] T096 [P] [US5] Add already_paid guidance per payment method from FTC and FBI sources plus DOJ hotline in packages/scam-patterns/data/patterns.json and apps/mcp-server/src/tools/get-guidance.ts
- [X] T097 [P] [US5] Build MCP Apps view ui://guardian/report in apps/mcp-server/src/ui/report.html
- [X] T098 [US5] Add simplified mode states for already paid, offer report and "send it for me" refusal in packages/core/src/dialogue/engine.ts

**Checkpoint**: V6 passes; all quickstart scenarios pass.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T099 [P] Complete red team suite to 60 or more utterances and add live mode runner against Bedrock in tests/redteam/live.test.ts
- [X] T100 [P] Add axe WCAG 2.2 AA checks and a keyboard only walkthrough of the Echo and the family page in tests/e2e/a11y.spec.ts
- [X] T101 Design pass on every screen with the design skills, then copy review against Principle VIII in apps/web/src/views and apps/web/echo/src
- [ ] T102 Playwright full run V1 to V14 on the deployed URL; record results in docs/measurements.md
- [ ] T103 Timed runs before the freeze: SC-002 (turns and seconds to send a check message), SC-005 (family setup on a phone), SC-009 (two first time visitors without instructions); record in docs/measurements.md
- [X] T104 [P] Write README: architecture diagram, local run, deploy, AWS integration section (Lambda, DynamoDB, Bedrock, SES, Polly, CDK), safety design, Alexa+ readiness in README.md
- [X] T105 [P] Split packages/scam-patterns into a separate public MIT repository with README, schema and source check; link it from README.md
- [X] T106 [P] Write the demo video script (under 3 minutes, strongest moment in the first 30 s, English) in docs/demo-script.md
- [X] T107 Review FEEDBACK.md and FRICTION_LOG.md for completeness (every tool used has a section), without rewriting past friction entries
- [X] T108 Audit every number in README.md, docs/demo-script.md and the Devpost draft: each statistic links to an FTC, FBI or IC3 publication, otherwise remove it (FR-035, SC-006)
- [ ] T109 Run quickstart.md end to end from a clean clone and fix gaps
- [X] T110 Stretch: container image for AgentCore Runtime (0.0.0.0:8000/mcp, arm64) in apps/mcp-server/Dockerfile

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): none
- Foundational (Phase 2): after Setup; blocks all stories
- US1 (Phase 3): after Foundational
- US2 (Phase 4): after Foundational; uses the check created by assess_call (T044)
- US6 (Phase 5): after Foundational; full value once US1 and US2 exist
- Cloud (Phase 6): after Foundational; can run in parallel with US6
- US3 (Phase 7): after US2 (extends outreach tools)
- US4 (Phase 8): after Foundational; needs SES adapter (T077) for real sign in emails
- US5 (Phase 9): after US1
- Polish (Phase 10): after the stories in scope

### Within each story

Tests first and failing, then tools and core logic, then routes and UI, then dialogue states.

## Parallel Opportunities

- Phase 1: T002 to T007 together
- Phase 2: T010 to T012 together; T013 to T016, T020, T022 together; T026, T027 together; T032, T033 together
- US1: T041 to T043 together, then T045 alongside T044
- US2: T052 to T055 together; T058, T060, T061, T062 together after T057 starts
- US6: T069, T070, T071, T073 together after T068
- Cloud: T076 and T077 together
- Polish: T099, T100, T104, T105, T106 together

### Parallel example: User Story 2

```text
Task: "T052 Contract tests for prepare_outreach and confirm_outreach in tests/contract/outreach.test.ts"
Task: "T053 Contract tests for get_updates and check_family_password in tests/contract/updates-password.test.ts"
Task: "T054 Add 20 or more red team utterances to tests/redteam/utterances.json"
Task: "T055 Implement demo household seed in packages/core/src/demo/seed.ts"
```

## Implementation Strategy

### MVP first

1. Phases 1 and 2.
2. US1: warning signs with sources, safe by construction. Validate V1, V8, V9.
3. US2: verification with the demo phone. Validate V2, V3, V5, V7, V10, V11. This is the demo
   core.
4. US6: voice and screen. Validate V1 to V4 by voice. This is the submittable MVP.

### Incremental delivery after MVP

5. Cloud foundation, then US3, US4, US5 in that order, validating each checkpoint.
6. Polish, video script, open source dataset.

Maps to the plan schedule: MVP by Oct 13, cloud by Oct 9 to 18, feature freeze Oct 20.

## Notes

- Never commit secrets; read everything from environment variables.
- Commit after each task or logical group; update PROGRESS.md.
- Stop at any checkpoint to validate the story independently.
