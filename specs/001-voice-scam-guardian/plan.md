# Implementation Plan: Voice Scam Guardian

**Branch**: `001-voice-scam-guardian` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-voice-scam-guardian/spec.md`

## Summary

A voice guardian that helps US older adults check a suspicious call before paying. A
self-hosted MCP server (Streamable HTTP, protocol 2026-07-28 and 2025-11-25) exposes eight
tools: warning sign check against an FTC and FBI pattern dataset, two step outreach to family
members saved in advance, reply tracking, family password comparison, official guidance and
report preparation. Safety rules are enforced in the tools themselves, so they hold even on a
real Alexa+ where the add-on cannot filter speech. Because Alexa+ MCP onboarding is partner
only, a web app simulates an Echo Show: browser speech in, Polly speech out, MCP Apps cards on
screen, a Bedrock agent that calls the real MCP server through an MCP client, an output guard
and a rule based simplified mode. A server rendered family page handles setup, with email
sign in links. Everything runs on AWS Lambda and DynamoDB, defined with CDK.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 (Lambda `nodejs24.x`, arm64)

**Primary Dependencies**: `@modelcontextprotocol/server`, `@modelcontextprotocol/client` and
`@modelcontextprotocol/hono` (v2), `@modelcontextprotocol/ext-apps`, Hono, Preact and Vite
(simulator client), zod, AWS SDK v3 (Bedrock Runtime, DynamoDB, SES v2, Polly), aws-cdk-lib

**Storage**: DynamoDB single table with TTL; in memory store for local runs and tests

**Testing**: Vitest (unit, contract, red team), Playwright (end to end), axe (WCAG 2.2 AA)

**Target Platform**: AWS Lambda behind Function URLs; evergreen desktop and mobile browsers
(voice input in Chrome and Edge, typed input everywhere)

**Project Type**: Web service (MCP server) plus web application, pnpm monorepo

**Performance Goals**: MCP tools p95 under 500 ms; spoken answer starts within 3 s of end of
speech in 95% of turns (SC-004)

**Constraints**: no secrets in code; English and US only; no call audio; redaction before
any storage, log or model call; demo must run with no AWS account (simplified mode, outbox)

**Scale/Scope**: hackathon demo scale (tens of households, one judge session each); 8 MCP
tools, 3 UI resources, about 10 pages; at least 8 scam patterns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the design complies | Status |
|---|---|---|
| I. Caller never trusted | No tool takes a destination; recipients are `memberId` only; `callerNumber` is stored for reports but no code path sends to it | Pass |
| II. Warn, never approve | Output guard blocks approval phrases; outcomes `confirmed_by_them` and `no_answer` map to fixed "still talk before paying" lines; 911 first on `danger` | Pass |
| III. No sensitive data, no recording | Redaction (R6) at every entry point, including interim speech; no audio processed except the older adult's own speech to the assistant; password stored as scrypt hash, never returned | Pass |
| IV. Person decides | Two step `prepare_outreach` and `confirm_outreach` with verbatim reply parsing; `prepare_report` has `submittedBySystem: false` and no submit path | Pass |
| V. Official sources only | Dataset entries require FTC, FBI or IC3 sources; DOJ only as resource; CI check fails on a pattern without source | Pass |
| VI. Senior first voice | Guard enforces three sentences and one question; "repeat" route; hard cases have scripted states in the simplified mode | Pass |
| VII. Real MCP on Alexa+ contract | Real MCP client in the demo path; stateless Streamable HTTP; MCP Apps cards; 500 ms budget; protected resource metadata; `.env.example` | Pass |
| VIII. Calm, accessible interface | Server rendered forms, 20 px minimum body text, axe in CI, privacy page, favicon, copy lint for dashes, emojis and "AI" | Pass |
| Workflow: safety tests gate merges | Red team suite in `pnpm test`, required before merging to `main` | Pass |

Post design re-check (after Phase 1): unchanged, all Pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-voice-scam-guardian/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mcp-tools.md
│   └── web-api.md
└── tasks.md              # next step, created by /speckit-tasks
```

### Source Code (repository root)

```text
packages/
├── scam-patterns/          # MIT dataset: patterns JSON, JSON Schema, source check script
│   ├── data/patterns.json
│   ├── schema/
│   └── scripts/check-sources.ts
└── core/                   # shared, pure logic, no AWS imports
    ├── src/redact/         # digit normalization, sensitive number detection (R6)
    ├── src/guard/          # output guard: approval phrases, digits, password, length, copy rules
    ├── src/match/          # rule based warning sign matcher over the dataset
    ├── src/confirm/        # yes, no, subset parser for confirm_outreach
    ├── src/dialogue/       # simplified mode state machine and fixed phrases
    └── src/ports/          # Store, Mailer, TextChannel, Clock interfaces + in memory impls

apps/
├── mcp-server/             # MCP tools and ui:// resources
│   ├── src/tools/
│   ├── src/ui/             # MCP Apps HTML views
│   ├── src/auth/           # household token check, protected resource metadata
│   ├── src/adapters/       # DynamoDB store, SES mailer, demo phone channel
│   ├── src/local.ts        # local Node server on 8788
│   └── src/lambda.ts       # Lambda handler
└── web/
    ├── src/routes/         # family, reply, privacy, auth, api
    ├── src/agent/          # Bedrock Converse loop, MCP client, 3 s deadline, fallback
    ├── src/views/          # Hono JSX pages
    ├── echo/               # Vite + Preact simulated Echo Show client
    ├── src/local.ts
    └── src/lambda.ts

infra/                      # CDK app: table, two functions, URLs, SES identity, IAM
tests/
├── redteam/                # utterances.json (60+) and runners
├── contract/               # MCP client against the in process server
└── e2e/                    # Playwright scenarios V1 to V14
```

**Structure Decision**: pnpm monorepo with two deployable apps and two shared packages.
`packages/core` keeps every safety rule pure and testable without AWS; `packages/scam-patterns`
is ready to be split into the separate MIT repository for the Open Source mini challenge.

## Delivery Schedule (2026-10-01 to 2026-10-22)

Solo developer, Nebius hackathon in parallel. Days marked "light" leave room for Nebius.

| Date | Focus | Exit check |
|---|---|---|
| Oct 1 (Wed) | Spec, clarify, plan | Plan validated |
| Oct 2 (Thu) | Tasks, analyze; AWS setup: Bedrock access, SES domain and production request | SES request sent |
| Oct 3 to 4 | Scam pattern dataset from FTC and FBI sources; `core` redact, guard, match, confirm | Unit tests green, every pattern sourced |
| Oct 5 to 6 | Simplified mode dialogue engine; red team suite v1 (60 utterances) | SC-001 and SC-003 green offline |
| Oct 7 to 8 | MCP server: 8 tools, auth, in memory store, contract tests | Inspector lists tools; p95 under 500 ms locally |
| Oct 9 (light) | DynamoDB and SES adapters; CDK deploy of MCP server | Public MCP URL answers |
| Oct 10 to 11 | Web agent: Bedrock loop via MCP client, 3 s fallback, output guard; `/api/converse` | V1 and V2 by text |
| Oct 12 to 13 | Simulated Echo client: voice, captions, light ring, MCP Apps cards, demo phone | V1 to V4 by voice |
| Oct 14 (light) | Reply page, events, "What's new?", hard cases V5 to V11 | All scenarios pass by hand |
| Oct 15 to 16 | Family page: sign in links, members, password, activity, delete all; privacy page; favicon | V13, V14 |
| Oct 17 | Design pass on all screens (design skills), copy lint, axe | SC-007 green |
| Oct 18 (light) | Full cloud deploy, Playwright e2e, latency measurements | SC-004, SC-008 measured |
| Oct 19 | Open source dataset repo; README with AWS integration section | Repo public |
| Oct 20 | Buffer and bug fixes; feature freeze at end of day | Freeze |
| Oct 21 | Demo video (under 3 minutes, best content first 30 s) | Video uploaded |
| Oct 22 | Devpost page, final FEEDBACK and FRICTION_LOG review, submit in the evening | Submitted |
| Oct 23 | Reserve only (deadline 12:00 PDT, 21:00 Paris) | |

Cut order if late: Polly (browser voice only), AgentCore stretch, `prepare_report` UI card,
activity view, test messages. Never cut: safety tests, verification flow, simplified mode,
privacy page.

## Complexity Tracking

No constitution violations. Nothing to justify.
