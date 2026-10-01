# Alexa+ Scam Guardian (working name) — progress

Last update: 2026-10-01

## Goal
Voice anti-scam guardian for US seniors on Alexa+ (grandparent / AI voice-clone scams).
Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track. Deadline 2026-10-23 12:00 PDT (21:00 Paris). Target submission: 2026-10-22 evening.

## Current step
Constitution v1.0.0 ratified. Next: speckit-specify (feature: voice scam guardian + family setup page + simulated Alexa+).

## Done
- [x] Step 1: Alexa+ MCP access check. Conclusion: MCP Toolkit / alexa-ai CLI = select partners only -> official "simulated Alexa+ experience" path.
- [x] speckit init: .specify/ installed (spec-kit 0.16.5.dev0)
- [x] Constitution v1.0.0 (8 principles) in .specify/memory/constitution.md; git init (branch main)

## To do
- [ ] speckit: specify, clarify, plan, tasks, analyze (no code before spec validated together)
- [ ] Planning Oct 1 -> 23 (Nebius hackathon in parallel, Oct 21-22 reserved for video + Devpost)

## Decisions
- User validated the path (2026-10-01) and kept the working name alexa-scam-guardian.
- Path: real self-hosted MCP server (spec 2025-11-25, Streamable HTTP) + web app simulating Alexa+ (voice in/out, Echo Show style) driving it through an MCP client. Keep server "Alexa+ ready" (alexa-ai addon.json shape, <500 ms tools, MCP Apps UI) for when access opens.
- Everything in English, US context only.

## Useful commands
- (none yet)

## Pitfalls
- Alexa+ quickstart page reads as open to all; only the docs home page states "select partners only". See FRICTION_LOG.md #1.
