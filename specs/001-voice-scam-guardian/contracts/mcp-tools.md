# Contract: MCP Server "scam-guardian"

Transport: Streamable HTTP, stateless, `POST /mcp`. Protocol eras: 2026-07-28 and 2025-11-25.
Auth: `Authorization: Bearer <household token>` (signed JWT, `iss`, `aud = scam-guardian-mcp`,
`sub = householdId`, `exp` at most 15 minutes). Unauthenticated calls get HTTP 401 with a
`WWW-Authenticate` header pointing to `/.well-known/oauth-protected-resource`.

Latency budget: every tool answers in under 500 ms at p95 (Alexa+ add-on contract).

## Rules shared by all tools

- No tool has a parameter for a phone number, email or address to contact. Recipients are
  always `memberId` values from the household.
- Every free text input is redacted (research R6) before use. If redaction removed something,
  the result carries `sensitiveDataRemoved: true` and `interrupt: true`.
- Every result carries `assistantRules`, a short fixed list the voice assistant must follow:
  never approve a payment, never contact the caller, ask one question at a time, never repeat
  numbers. It is the same text on every call.
- Results return both `structuredContent` (typed, below) and a short `content` text summary.
- Errors use MCP tool errors (`isError: true`) with a plain sentence the assistant can say.

## Tools

### `assess_call`

Describe or add to a suspicious call, text, email or voicemail. Creates a check if `checkId`
is absent.

- **Input**: `description` (string, 1 to 2,000 chars), `checkId?` (string)
- **Output**: `checkId`, `matchedSigns[]` (`id`, `label`, `explanation`, `source{publisher,
  title, url}`), `danger` (bool), `claimedIdentity?`, `familyMatches[]` (`memberId`, `name`,
  `relationship`) when a family role was claimed, `alreadyPaid?` (`method`), `nextStep`
  (`call_911`, `hang_up_first`, `pick_member`, `offer_verify`, `offer_heads_up`,
  `paid_guidance`, `no_signs_found`), `sensitiveDataRemoved`, `interrupt`
- **UI**: `_meta.ui.resourceUri = ui://guardian/warning-signs`

### `prepare_outreach`

Build the confirmation question. Sends nothing.

- **Input**: `checkId`, `verifyMemberId?`, `headsUpMemberIds?[]` (at least one of the two)
- **Output**: `pendingId`, `question` (exact text to ask, names every recipient), `expiresAt`
- **Errors**: member opted out, member not allowed for that role, rate limit reached

### `confirm_outreach`

Send what was prepared, only if the older adult's own reply is an explicit yes.

- **Input**: `pendingId`, `userReply` (the older adult's words, verbatim)
- **Behavior**: parses `userReply` deterministically: yes words send all; a reply naming a
  subset ("just Michael") sends only those; no, stop, cancel or unclear sends nothing.
- **Output**: `sent[]` (`memberId`, `name`, `kind` = verify or heads_up, `delivery`),
  `nothingSent` (bool), `reason?` (`declined`, `unclear`, `expired`)
- **UI**: `_meta.ui.resourceUri = ui://guardian/check-status`

### `get_updates`

Latest news for a check, or unread news for the household ("What's new?").

- **Input**: `checkId?`
- **Output**: `updates[]` (`checkId`, `memberName`, `kind` = it_was_me, it_wasnt_me,
  no_answer, delivery_failed, `at`), `waitingOn[]` (`memberName`, `minutesWaiting`),
  `nextMemberToTry?`
- **Side effect**: marks returned device events as read
- **UI**: `_meta.ui.resourceUri = ui://guardian/check-status`

### `check_family_password`

- **Input**: `checkId`, `phraseHeard` (what the caller said)
- **Output**: `result` = `matches`, `does_not_match`, `not_set`, `locked`
- Never returns or hints at the stored phrase.

### `get_guidance`

Official guidance for a situation.

- **Input**: `topic` = `already_paid`, `caller_on_line`, `danger`, `no_answer`,
  `confirmed_real`, `general`; `paymentMethod?` = `gift_card`, `wire`, `money_transfer_app`,
  `crypto`, `cash_mail`, `cash_courier`, `bank_transfer`, `other`
- **Output**: `steps[]` (short speakable lines), `sources[]`, `helpResources[]` (DOJ hotline
  for `already_paid`)

### `prepare_report`

Prepare a report summary. Never submits anything.

- **Input**: `checkId`, `extraDetails?` (string, redacted)
- **Output**: `reportId`, `facts` (see data model), `links[]` (ReportFraud.ftc.gov, ic3.gov,
  DOJ hotline, each with one line on when to use it), `submittedBySystem: false`
- **UI**: `_meta.ui.resourceUri = ui://guardian/report`

### `close_check`

- **Input**: `checkId`
- **Output**: `closed: true`

## UI resources (MCP Apps, `text/html;profile=mcp-app`)

| URI | Shows |
|---|---|
| `ui://guardian/warning-signs` | Each warning sign as a large line with an icon and its source |
| `ui://guardian/check-status` | Who was messaged, delivery, reply or waiting time |
| `ui://guardian/report` | Report facts and the official links, with "Nothing was sent to any agency" |

Cards follow Principle VIII: at least 32 px text on the Echo Show layout, no emojis, no
dashes, icons with text labels.

## Protected resource metadata

`GET /.well-known/oauth-protected-resource` returns `resource`, `authorization_servers`,
`bearer_methods_supported: ["header"]`, `scopes_supported: ["household"]`.
