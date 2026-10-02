# Scam Guardian for Alexa+ — progress

Last update: 2026-10-01

## Goal
Voice anti-scam guardian for US seniors on Alexa+ (grandparent / AI voice-clone scams).
Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track. Deadline 2026-10-23 12:00 PDT (21:00 Paris). Target submission: 2026-10-22 evening.

## Current step
2026-10-02, after the owner confirmed the name and said "continue, don't stop": safety hardening of the full mode (host passes the person's own words to confirm_outreach and refuses same turn confirms; claims of sent messages without a send are replaced; password checks capped at 10 per household per hour), privacy page covers AWS and the model, 200% zoom and reflow tests, scripted Bedrock tool_use tests, CLI free deploy (`pnpm token:cloud`), `pnpm smoke`, remote Playwright (`E2E_BASE_URL`), Echo no longer drops early or fast typed input, Playwright in CI, `pnpm demo:play` for the video. PR #1 (feature branch into main) opened so the default branch shows the product. 542 tests, 26 Playwright scenarios.
NEXT (owner): AWS credentials + Bedrock Claude Haiku 4.5 access in us-east-1, then `pnpm --filter @asg/infra exec cdk bootstrap` and `pnpm deploy` (T080); SES sender/domain. Then `pnpm smoke`, `E2E_BASE_URL=... pnpm test:e2e` (T102), `pnpm test:redteam:live`, `pnpm measure`, timed runs with people (T103), video Oct 21 (`pnpm demo:play`), Devpost Oct 22 from docs/devpost.md.

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
- PR #1 merges the feature branch into main for judges (2026-10-02).
- Product name confirmed by the owner (2026-10-02): "Scam Guardian" (Devpost: "Scam Guardian for Alexa+").
- Path: real self-hosted MCP server (spec 2025-11-25, Streamable HTTP) + web app simulating Alexa+ (voice in/out, Echo Show style) driving it through an MCP client. Keep server "Alexa+ ready" (alexa-ai addon.json shape, <500 ms tools, MCP Apps UI) for when access opens.
- Everything in English, US context only.
- Messages: real email, SMS on on-screen demo phone (SMS adapter switchable later). Family page: magic link sign in + public resettable demo household. (user accepted recommended options 2026-10-01)

## Useful commands
- Install: `pnpm install` | Checks: `pnpm lint && pnpm lint:copy && pnpm typecheck && pnpm test`

## Pitfalls
- `pkill` does not exist in this Git Bash; stop dev servers with PowerShell (Get-CimInstance Win32_Process, Stop-Process).
- `tsx watch` and `a & b` in npm scripts hang on Windows when started from tools; use `node --watch --import tsx` and pnpm's parallel `/^dev:/` scripts.
- axe color contrast must run after animations settle (a11y.spec waits for document.getAnimations()).
- Python string replacements turned  into backspace characters in regexes. Use raw strings (r'''...''') or the Edit tool for regex edits.
- The red team caught a real safety bug: "I am not sure" was read as yes (word "sure"). Hesitation now always parses as unclear.
- CI broke twice because checks ran without gating the commit. Always: `pnpm check && git commit ...`.
- Alexa+ quickstart page reads as open to all; only the docs home page states "select partners only". See FRICTION_LOG.md #1.
