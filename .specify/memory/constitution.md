<!--
Sync Impact Report
==================
Version change: (template, unversioned) -> 1.0.0
Modified principles: none (initial ratification)
Added principles:
  I. The Caller Is Never Trusted
  II. Warn and Verify, Never Approve
  III. No Sensitive Data, No Recording
  IV. The Person Decides, the System Prepares
  V. Official Sources Only
  VI. Senior First Voice Design
  VII. Real MCP on the Alexa+ Contract
  VIII. Calm, Accessible, Honest Interface
Added sections: Hackathon and Platform Constraints, Development Workflow, Governance
Removed sections: none
Templates checked:
  .specify/templates/plan-template.md      OK (generic "Constitution Check" gate reads this file)
  .specify/templates/spec-template.md      OK (no principle specific slots)
  .specify/templates/tasks-template.md     OK (safety test tasks derive from Principles I to IV)
Deferred items: none
-->

# Alexa+ Scam Guardian Constitution

## Core Principles

### I. The Caller Is Never Trusted

- The system MUST NEVER call, text, email or otherwise contact the number, address or account
  that reached the user. No tool accepts the suspect's contact details as a destination.
- Identity verification MUST go only through contacts the family registered in advance on the
  family setup page.
- An optional family password MAY be stored and checked. It MUST never be spoken back, shown in
  full, or revealed to anyone who fails to provide it.
- Rationale: scammers control the inbound channel, including cloned voices and spoofed caller
  ID. Only a channel set up before the call can be trusted.

### II. Warn and Verify, Never Approve

- The system MUST NEVER say or imply that a payment is safe, approved or OK to make.
- Outputs are limited to: warning signs found, verification outcome, recommended next step.
  When verification confirms the call was real, the system says the person was reached and
  still recommends waiting and talking to them before sending money.
- When in doubt, the recommendation MUST be to wait and verify.
- Any sign of immediate danger (threat to safety, medical emergency, someone at the door)
  MUST lead first to "call 911".
- These rules MUST be enforced in code (deterministic checks on every spoken response and
  tool result), not only in model prompts, and MUST be covered by automated tests.
- Rationale: a tool that can be talked into "it's fine, pay" becomes a scam amplifier.

### III. No Sensitive Data, No Recording

- The system MUST NEVER ask for, store, log, transmit or repeat a card number, bank account or
  routing number, Social Security number, or online banking credential.
- If the user starts dictating one, the system MUST interrupt politely and steer back. Input
  that matches such patterns MUST be redacted before any logging, storage or model call.
- No call audio is recorded or processed. The system only works on what the user describes.
- Family setup data is limited to what verification and alerts need (names, relationship,
  phone or email, optional family password). It is never sold, shared or used for anything
  else, and the privacy page states this plainly.
- Rationale: seniors under stress overshare. The product must be safe even when they do.

### IV. The Person Decides, the System Prepares

- Every outbound action (verification message, family alert) MUST be confirmed by the user
  with an explicit yes immediately before it is sent.
- Fraud reports are NEVER submitted automatically. The system prepares a summary and guides
  the user or family to ReportFraud.ftc.gov and ic3.gov; a human submits.
- The tone MUST never blame or shame. The person did the right thing by asking.
- Rationale: autonomy and dignity of older adults; no surprise messages to family.

### V. Official Sources Only

- The scam pattern knowledge base MUST be built only from official FTC and FBI (including IC3)
  alerts and publications. Every pattern carries its source URL and retrieval date.
- No statistic, percentage or dollar figure may appear anywhere (code, UI, spoken responses,
  README, video, Devpost page) unless it comes from an official FBI IC3 or FTC publication and
  is shown with its link. No invented, rounded up or paraphrased numbers.
- Rationale: credibility with judges and families, and no misinformation on a safety topic.

### VI. Senior First Voice Design

- Short sentences. One question at a time. Plain words.
- Every action is confirmed before it happens. The user can say "repeat" at any point and get
  the last message again, slower and simpler.
- Calm, reassuring tone. No alarmist wording, no jargon.
- The dialogue design MUST cover the hard cases: the user already paid, the scammer is still on
  the line, the relative does not answer, verification shows the call was real.
- Rationale: the target user is often stressed, sometimes hard of hearing, and under pressure
  from someone actively manipulating them.

### VII. Real MCP on the Alexa+ Contract

- The core is a self-hosted MCP server implementing spec 2025-11-25 or later over Streamable
  HTTP.
- The simulated Alexa+ web app MUST call that server at runtime through a real MCP client.
  No mocked tool layer in the demo path.
- The server follows the published Alexa+ add-on contract so it can be onboarded when access
  opens: tool latency target under 500 ms, MCP Apps visuals for screen devices, OAuth 2.1 with
  PKCE ready.
- No key, token or credential is ever hardcoded. Configuration comes from environment
  variables and secret stores; a `.env.example` documents every variable.
- Rationale: hackathon eligibility and a credible path to the real platform.

### VIII. Calm, Accessible, Honest Interface

Applies to the family setup page and the simulated Alexa+ web app.

- Large text (body at least 20 px on the family page), strong contrast meeting WCAG 2.2 AA at
  minimum, generous touch targets, full keyboard support.
- No purple gradients, no pill shaped buttons, no emojis (icons only), no dashes in UI copy.
- Copy is concise and specific. No generic marketing copy, and no mention of AI in any user
  facing text.
- A privacy page and a favicon are mandatory before submission.
- Rationale: the audience is older adults and their families; trust depends on looking calm,
  clear and deliberate.

## Hackathon and Platform Constraints

- Event: Amazon Developer Hackathon "Build, Ship, Shape", Alexa+ track. Deadline 2026-10-23
  12:00 PDT. Target submission 2026-10-22 evening. 2026-10-21 and 2026-10-22 are reserved for
  the demo video and the Devpost page.
- Path: the Alexa+ MCP Toolkit is partner only, so the submission is a real MCP server plus a
  simulated Alexa+ experience, as the official rules allow.
- Everything in English (code, UI, spoken output, docs, commits). United States context only
  (US agencies, US phone formats, 911).
- Mini challenges (AWS Builder: AgentCore Runtime or Lambda plus Bedrock; Open Source: scam
  pattern dataset as a separate MIT repo) are pursued only if they do not put the main track
  at risk. The main track demo path always comes first.
- Scope is cut to protect the deadline: a smaller, polished, safe product beats a broad one.

## Development Workflow

- Spec first: the full speckit flow (constitution, specify, clarify, plan, tasks, analyze)
  runs before any code, and the spec is validated with the project owner before implementation.
- Safety tests are mandatory: every rule in Principles I to IV has automated tests, including
  adversarial utterances (pressure to approve a payment, dictated card or SSN numbers, requests
  to call the suspect back). These tests gate every merge to `main`.
- FEEDBACK.md is updated whenever a tool, SDK or API is used: usage, what works, what needs
  work, onboarding quality, would reuse.
- FRICTION_LOG.md is written at the moment a friction happens (task, steps, expected vs actual,
  severity, workaround, suggestion). It is never reconstructed afterwards.
- PROGRESS.md is updated after each significant step so work resumes where it stopped.

## Governance

- This constitution supersedes any other practice in the repository. Plans, specs and tasks
  MUST pass a Constitution Check against Principles I to VIII before implementation.
- Amendments require: the proposed change, the reason, owner approval, and an updated Sync
  Impact Report at the top of this file.
- Versioning: MAJOR for removing or redefining a principle, MINOR for a new principle or
  materially expanded guidance, PATCH for wording fixes.
- Any conflict between a feature request and Principles I to V is resolved in favor of the
  principles; the feature is changed or dropped.

**Version**: 1.0.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01
