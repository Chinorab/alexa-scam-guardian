# Scam Guardian for Alexa+ — progress

Last update: 2026-10-01

## Goal
Voice anti-scam guardian for US seniors on Alexa+ (grandparent / AI voice-clone scams).
Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track. Deadline 2026-10-23 12:00 PDT (21:00 Paris). Target submission: 2026-10-22 evening.

## Current step
2026-10-02, after the owner confirmed the name and said "continue, don't stop": safety hardening of the full mode (host passes the person's own words to confirm_outreach and refuses same turn confirms; claims of sent messages without a send are replaced; password checks capped at 10 per household per hour), privacy page covers AWS and the model, 200% zoom and reflow tests, scripted Bedrock tool_use tests, CLI free deploy (`pnpm token:cloud`), `pnpm smoke`, remote Playwright (`E2E_BASE_URL`), Echo no longer drops early or fast typed input, Playwright in CI, `pnpm demo:play` for the video. PR #1 merged into main. Later the same day: video cards (title, statistic, architecture, closing), Devpost cover, captions.srt (`pnpm video:cards`), Open Graph previews, DESIGN.md with finish review, credits. Then `pnpm aws:check` (account preflight) and `pnpm rehearse` (real Lambda bundles behind Function URL emulators with fake Secrets Manager/SSM/DynamoDB; smoke + full Playwright pass; in CI); it found the 20/h start limit (now 200/h + site cap 3,000 model turns/h) and the disabled Echo input before start. Then an audit of FR-001 to FR-036 found three gaps, all fixed: public demo family page (FR-026, reachable from the Echo, no email; also fixed a demo cookie creating a "real" device), simpler repeat (FR-023), heads up says what was asked (FR-015). Then acceptance scenario and edge case audits: quiet news card with Hear it (US6.4), unsaved relative explanation (US2.3), already paid offers the report and confirms nothing sent (FR-013), secrecy reassurance, hang up on callbacks, setup suggestion when nobody is saved. 558 tests, 27 Playwright scenarios, 3 CI jobs. README screenshots regenerated. Constitution audit: tool summaries now pass the approval check (Principle II), .env.example lists every variable (Principle VII). 561 tests. Audits done: FR-001 to FR-036, acceptance scenarios, edge cases, constitution I to VIII, SC-001 to SC-010 (human timed runs and cloud figures still open). Then generated and adversarial probes: redaction (336 sentences; fixed commas, and, dash, double oh), MCP Apps cards audited by axe inside their frames (titles added), multi turn red team (14 attacks; danger and caller on the line now outrank an open question, in both modes), confirmation vocabulary, scam recall (new FTC sourced business impersonation pattern), paid methods (money order step, cash into coin ATM). Dataset 1.2.0 released on Chinorab/us-scam-patterns. Then: output guard catches roundabout approvals (and no longer flags "not safe to pay"), family page names validated (any language, no markup), weekly dependency audit (clean), intent probes for repeat ("What?", "Huh?"), news ("any word from Michael?") and report ("should I call the police?"). Then MCP and web fuzzing (no exception, no server error), control characters stripped, household isolation tests, reply and stop pages audited by axe, Playwright retries once and reports flaky tests. 648 tests, 29 Playwright scenarios. Then: the caller's number now reaches the report (it was interrupted as a sensitive number and replaced before the tools), report summary facts and a plain text copy on the family page (FR-019), privacy wording exact about which numbers are removed. 652 tests. Then: voice path tested with a scripted microphone (main scenario, interruption, mic error); the "You said" line no longer shows a dictated number; Polly autoplay fallback; wording fixes found by printing every message variant ("Ruth's the IRS", "No answer from family yet" when nobody was asked, "this call" for a text). 656 tests, 32 Playwright scenarios. PR #11 merged. Then whole conversations read across 18 scam types found and fixed: after "hang up first" the check now goes on (it repeated the hang up line and never offered Michael); money moved mid check gets the paid steps, and no second heads up offer to someone already told; hello and "what can you do" get an invitation without a check; "what should I do" answers and asks again; "I called him and he is fine" gets thanks and the report; details with nothing new after a no do not repeat the offer; a saved relative asking for money is offered a check without warning signs. 685 tests, 32 Playwright scenarios.
NEXT (owner): run `pnpm aws:check` with AWS credentials + Bedrock Claude Haiku 4.5 access in us-east-1, then `pnpm --filter @asg/infra exec cdk bootstrap` and `pnpm deploy` (T080); SES sender/domain. Then `pnpm smoke`, `E2E_BASE_URL=... pnpm test:e2e` (T102), `pnpm test:redteam:live`, `pnpm measure`, timed runs with people (T103), video Oct 21 (`pnpm demo:play`), Devpost Oct 22 from docs/devpost.md.

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
