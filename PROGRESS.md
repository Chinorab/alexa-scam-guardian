# Alexa+ Scam Guardian (working name) — progress

Last update: 2026-10-01

## Goal
Voice anti-scam guardian for US seniors on Alexa+ (grandparent / AI voice-clone scams).
Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track. Deadline 2026-10-23 12:00 PDT (21:00 Paris). Target submission: 2026-10-22 evening.

## Current step
speckit tasks + analyze done; analyze fixes applied (110 tasks, constitution v1.1.1). Next: user go for speckit-implement starting Phase 1 (T001-T009). Owner actions pending: AWS account + Bedrock, domain for SES, SES production request Oct 2.

## Done
- [x] Step 1: Alexa+ MCP access check. Conclusion: MCP Toolkit / alexa-ai CLI = select partners only -> official "simulated Alexa+ experience" path.
- [x] speckit init: .specify/ installed (spec-kit 0.16.5.dev0)
- [x] Constitution v1.0.0 (8 principles) in .specify/memory/constitution.md; git init (branch main)
- [x] spec.md v1 draft: 6 user stories, 35 FR, 9 SC, reference dialogues + hard cases
- [x] speckit-clarify: 3 answers integrated (FR-009, FR-019, FR-021, FR-035, FR-036, SC-010)
- [x] speckit-plan: TS monorepo, MCP SDK v2 (2026-07-28 + 2025-11-25), Lambda + DynamoDB + SES + Polly + Bedrock Haiku 4.5, CDK; schedule Oct 1-22 in plan.md
- [x] speckit-tasks (110 tasks after fixes) + speckit-analyze (1 critical C1 fixed by constitution v1.1.1 PATCH; GitHub repo+branch protection, logger, close_check, off-topic, timed runs, number audit added; design direction moved to Phase 2)

## To do
- [ ] speckit: specify, clarify, plan, tasks, analyze (no code before spec validated together)
- [ ] Planning Oct 1 -> 23 (Nebius hackathon in parallel, Oct 21-22 reserved for video + Devpost)

## Decisions
- User validated the path (2026-10-01) and kept the working name alexa-scam-guardian.
- Path: real self-hosted MCP server (spec 2025-11-25, Streamable HTTP) + web app simulating Alexa+ (voice in/out, Echo Show style) driving it through an MCP client. Keep server "Alexa+ ready" (alexa-ai addon.json shape, <500 ms tools, MCP Apps UI) for when access opens.
- Everything in English, US context only.
- Messages: real email, SMS on on-screen demo phone (SMS adapter switchable later). Family page: magic link sign in + public resettable demo household. (user accepted recommended options 2026-10-01)

## Useful commands
- (none yet)

## Pitfalls
- Alexa+ quickstart page reads as open to all; only the docs home page states "select partners only". See FRICTION_LOG.md #1.
