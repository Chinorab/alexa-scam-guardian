# Alexa+ Scam Guardian (working name) — progress

Last update: 2026-10-01

## Goal
Voice anti-scam guardian for US seniors on Alexa+ (grandparent / AI voice-clone scams).
Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track. Deadline 2026-10-23 12:00 PDT (21:00 Paris). Target submission: 2026-10-22 evening.

## Current step
Phases 3, 4, 5 DONE (US1, US2, US6): MVP complete. 344 unit/contract tests + 8 Playwright scenarios (V1 to V4, repeat, start over) in real Chromium. Echo Show UI: device frame, captions, MCP Apps cards, light bar, Talk (browser speech), Polly TTS route with browser fallback, demo phone, quiet notifications with chime, auto announce in open conversation. Playwright browsers in D:/Anas/playwright-browsers (tests/e2e/run.mjs). NEXT: Phase 6 Cloud foundation (needs AWS answers) or Phase 7 US3 / Phase 8 US4 family page / Phase 9 US5 report. Owner answers pending: AWS+Bedrock, SES domain, UI product name.

## Done
- [x] Step 1: Alexa+ MCP access check. Conclusion: MCP Toolkit / alexa-ai CLI = select partners only -> official "simulated Alexa+ experience" path.
- [x] speckit init: .specify/ installed (spec-kit 0.16.5.dev0)
- [x] Constitution v1.0.0 (8 principles) in .specify/memory/constitution.md; git init (branch main)
- [x] spec.md v1 draft: 6 user stories, 35 FR, 9 SC, reference dialogues + hard cases
- [x] speckit-clarify: 3 answers integrated (FR-009, FR-019, FR-021, FR-035, FR-036, SC-010)
- [x] speckit-plan: TS monorepo, MCP SDK v2 (2026-07-28 + 2025-11-25), Lambda + DynamoDB + SES + Polly + Bedrock Haiku 4.5, CDK; schedule Oct 1-22 in plan.md
- [x] speckit-tasks (110 tasks after fixes) + speckit-analyze (1 critical C1 fixed by constitution v1.1.1 PATCH; GitHub repo+branch protection, logger, close_check, off-topic, timed runs, number audit added; design direction moved to Phase 2)
- [x] Phase 1 T001-T008: pnpm workspace (packages/core, packages/scam-patterns, apps/mcp-server, apps/web, infra, tests), TS 6.0.3 pinned, ESLint 10, Prettier, Vitest 5 projects, scripts/lint-copy.ts (9 tests), CI, README, LICENSE

## To do
- [ ] speckit: specify, clarify, plan, tasks, analyze (no code before spec validated together)
- [ ] Planning Oct 1 -> 23 (Nebius hackathon in parallel, Oct 21-22 reserved for video + Devpost)

## Decisions
- User validated the path (2026-10-01) and kept the working name alexa-scam-guardian.
- Path: real self-hosted MCP server (spec 2025-11-25, Streamable HTTP) + web app simulating Alexa+ (voice in/out, Echo Show style) driving it through an MCP client. Keep server "Alexa+ ready" (alexa-ai addon.json shape, <500 ms tools, MCP Apps UI) for when access opens.
- Everything in English, US context only.
- Messages: real email, SMS on on-screen demo phone (SMS adapter switchable later). Family page: magic link sign in + public resettable demo household. (user accepted recommended options 2026-10-01)

## Useful commands
- Install: `pnpm install` | Checks: `pnpm lint && pnpm lint:copy && pnpm typecheck && pnpm test`

## Pitfalls
- Python string replacements turned  into backspace characters in regexes. Use raw strings (r'''...''') or the Edit tool for regex edits.
- The red team caught a real safety bug: "I am not sure" was read as yes (word "sure"). Hesitation now always parses as unclear.
- CI broke twice because checks ran without gating the commit. Always: `pnpm check && git commit ...`.
- Alexa+ quickstart page reads as open to all; only the docs home page states "select partners only". See FRICTION_LOG.md #1.
