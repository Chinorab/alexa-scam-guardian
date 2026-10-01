# Alexa+ Scam Guardian

A voice guardian that helps older adults in the United States check a suspicious call before
they pay. They hang up, tell Alexa what happened, and Alexa names the warning signs, checks
with the real family member on a number the family saved in advance, and helps them report
it. It never says a payment is safe, never contacts the caller, and never asks for card, bank
or Social Security numbers.

Built for the Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track.

> Status: in development. This README grows with the code.

## How it works

- **MCP server** (`apps/mcp-server`): self-hosted, Streamable HTTP, protocol 2026-07-28 and
  2025-11-25. Eight tools: warning sign check, two step family outreach, reply tracking,
  family password check, official guidance, report preparation. Safety rules are enforced
  inside the tools.
- **Simulated Echo Show** (`apps/web`): Alexa+ MCP onboarding is open to select partners only,
  so a web app plays the Echo: speech in and out, captions, MCP Apps cards, and an agent that
  calls the real MCP server through an MCP client.
- **Family page** (`apps/web`): relatives to verify, trusted contacts, family password.
- **Scam patterns** (`packages/scam-patterns`): built only from FTC and FBI alerts, each with
  its source.

Architecture diagram: coming with the first deploy.

## Run locally

Requirements: Node.js 24, pnpm 9.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

No AWS account is needed for a local run: the guardian uses its rule based mode and an on
screen outbox. See [.env.example](.env.example) for every setting.

## Checks

```bash
pnpm lint          # ESLint
pnpm lint:copy     # user facing copy rules (no emojis, no dashes, no "AI")
pnpm typecheck
pnpm test          # unit, contract and red team suites
pnpm check         # all of the above, the gate before every commit
pnpm test:e2e      # Playwright scenarios in a real Chromium (simulated Echo)
```

## Project documents

- Specification: [specs/001-voice-scam-guardian/spec.md](specs/001-voice-scam-guardian/spec.md)
- Plan: [specs/001-voice-scam-guardian/plan.md](specs/001-voice-scam-guardian/plan.md)
- Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md)
- Product feedback: [FEEDBACK.md](FEEDBACK.md)
- Friction log: [FRICTION_LOG.md](FRICTION_LOG.md)

## License

MIT
