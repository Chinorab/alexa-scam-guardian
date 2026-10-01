# Data Model: Voice Scam Guardian

Storage: one DynamoDB table (see research R8). Keys below use `PK` and `SK`. Every item that
belongs to a household lives under `PK = HH#<householdId>`, so "delete all household data"
is one query plus a batch delete. All text that comes from the older adult is redacted
(research R6) before it reaches any item.

## Household

| Field | Type | Rules |
|---|---|---|
| householdId | ULID | `PK = HH#id`, `SK = META` |
| kind | `real` or `demo` | demo items carry `expiresAt` (24 h TTL) |
| organizerEmail | string | real only; lowercased; unique (GSI `EMAIL#<email>`) |
| olderAdultFirstName | string | 1 to 40 chars; how Alexa addresses them |
| waitMinutes | int | 2 to 60, default 10 (FR-010) |
| createdAt, updatedAt | ISO time | |

## FamilyMember

Covers both roles from the glossary. One person can hold both.

| Field | Type | Rules |
|---|---|---|
| memberId | ULID | `SK = MEM#id` |
| name | string | 1 to 60 chars |
| relationship | enum + free text | grandson, granddaughter, son, daughter, nephew, niece, other |
| nicknames | string[] | up to 5; used to match "my grandson", "Mikey" |
| channel | `email` or `text` | text goes to the demo phone (FR-014) |
| email | string | required if channel is email; validated |
| phone | E.164 US | required if channel is text; `+1` only |
| canVerify | bool | role "relative to verify" |
| getsHeadsUp | bool | role "trusted contact" |
| optedOut | bool | set by the stop link in any message |

Validation: at least one role true. A member with `optedOut = true` is never messaged.

## FamilyPassword

| Field | Type | Rules |
|---|---|---|
| `SK = PWD` | | at most one per household |
| hash | string | scrypt of the normalized phrase (lowercase, letters and digits only, single spaces) |
| salt | bytes | per household |
| setAt | ISO time | |

Never returned by any API or tool. Comparison only (FR-011). Three wrong attempts per check
lock the comparison for that check.

## Scam pattern dataset (shared, not per household)

Lives in `packages/scam-patterns` as versioned JSON (`data/patterns.json`), validated against
`schema/pattern.schema.json` and by `src/check.ts` in CI. Loaded in memory.

- **sources**: map of id to `publisher` (FTC, FBI, IC3; DOJ for help resources only), `title`
  (official, verbatim), `label` (shown on screen), `url` (official domain only), `retrievedOn`.
- **warningSigns**: `id`, `label` (speakable after "the"), `explanation` (one sentence),
  `cues` (case insensitive regular expressions for the rule matcher), `sourceRefs`. Signs are
  shared across patterns.
- **patterns**: `id`, `name`, `description`, `signIds` (first one is the primary sign),
  `advice`, `sourceRefs`. At least 8.
- **ifPaid**: one entry per payment method with speakable `steps` and `sourceRefs` (FR-021).
- **resources**: ReportFraud.ftc.gov, ic3.gov, DOJ National Elder Fraud Hotline, with
  `whenToUse`, optional `phone` (spaces, no dashes) and `hours`.

## Check

| Field | Type | Rules |
|---|---|---|
| checkId | ULID | `SK = CHK#<checkId>`; TTL 30 days (FR-030) |
| state | enum | see transitions |
| description | string | redacted; appended per turn, max 4,000 chars |
| contactKind | `call`, `voicemail`, `text`, `email` | |
| claimedIdentity | string | e.g. "grandson", "Medicare" |
| matchedSigns | WarningSign id[] | with pattern ids |
| danger | bool | FR-005 |
| alreadyPaid | object | method, amount text; never numbers of accounts |
| callerNumber | string | optional, from caller context only; never a destination |
| passwordAttempts | int | max 3 |
| outcome | enum | `unknown`, `not_from_them`, `confirmed_by_them`, `no_answer`, `no_red_flags` |
| createdAt, closedAt | ISO time | |

State transitions:

```text
open ──assess──▶ assessed ──prepare_outreach──▶ awaiting_confirmation
awaiting_confirmation ──yes──▶ waiting_for_reply
awaiting_confirmation ──no / stop / unclear / 2 min timeout──▶ assessed
waiting_for_reply ──reply "it wasn't me"──▶ resolved (outcome not_from_them)
waiting_for_reply ──reply "it was me"──▶ resolved (outcome confirmed_by_them)
waiting_for_reply ──wait time passed──▶ no_answer (offer next contact)
any ──close_check or 30 min idle──▶ closed
```

`resolved` and `no_answer` never mean "safe"; they only change what Alexa reports.

## PendingAction

| Field | Type | Rules |
|---|---|---|
| pendingId | ULID | `SK = PEND#id`; TTL 2 minutes |
| checkId | ULID | |
| verifyMemberIds | ULID[] | at most 1 |
| headsUpMemberIds | ULID[] | |
| question | string | exact spoken question, names every recipient (FR-012) |

## VerificationRequest

| Field | Type | Rules |
|---|---|---|
| requestId | ULID | `SK = VER#<checkId>#<requestId>` |
| memberId | ULID | |
| channel | `email` or `text` | |
| sentAt | ISO time | |
| delivery | `sent`, `failed` | |
| reply | `none`, `it_was_me`, `it_wasnt_me` | one reply accepted |
| repliedAt | ISO time | |
| replyTokenHash | string | GSI `TOKEN#<hash>` for the reply page; token valid 24 h |

## HeadsUp

Same shape as VerificationRequest without `reply`; `SK = HUP#<checkId>#<id>`.

## ReportSummary

| Field | Type | Rules |
|---|---|---|
| reportId | ULID | `SK = REP#<checkId>` |
| facts | object | date and time told, contact kind, claimed identity, what was asked, payment method and amount if said, callerNumber if said, warning signs |
| links | Source[] | ReportFraud.ftc.gov, ic3.gov, DOJ hotline |
| submittedBySystem | literal `false` | always false (FR-020) |

## DeviceEvent (simulated Echo notifications)

`SK = EVT#<time>#<id>`, TTL 24 h. Fields: `kind` (`reply_received`, `delivery_failed`,
`no_answer`), `checkId`, `read` (bool). Drives the light ring and "What's new?" (FR-009).

## SignInLink

`PK = LOGIN#<tokenHash>`, TTL 15 minutes, single use, fields `email`, `createdAt`.

## RateCounter

`PK = RATE#<scope>#<window>`, TTL = window. Limits: 10 outreach messages per household per
hour, 5 sign in links per email per hour, 3 test messages per member per hour.
