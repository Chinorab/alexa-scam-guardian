# Feature Specification: Voice Scam Guardian

**Feature Branch**: `001-voice-scam-guardian`

**Created**: 2026-10-01

**Status**: Draft (clarifications Q1 and Q2 resolved 2026-10-01)

**Input**: User description: "Voice scam guardian for US seniors on Alexa+ (simulated Alexa+ web app + self-hosted MCP server + family setup page). Assess red flags of a described call, verify identity via family-registered contacts and optional family password, alert a trusted relative by SMS or email, prepare a report summary pointing to ReportFraud.ftc.gov and ic3.gov, family setup page (trusted contacts, relatives to verify, family password), hard cases (already paid, scammer still on the line, relative unreachable, call confirmed real), privacy page, favicon."

## Glossary

One term per concept, used the same way in speech, screens and docs.

- **Older adult**: the person who got the suspicious call and talks to Alexa.
- **Family organizer**: the relative who sets things up on the family page.
- **Relative to verify**: someone a scammer might pretend to be (grandchild, child). Has a
  saved phone number or email the family trusts.
- **Trusted contact**: someone the older adult wants told when a suspicious call happens.
  A person can be both a relative to verify and a trusted contact.
- **Family password**: an optional secret word or phrase the family agrees on, so a real
  relative can prove who they are.
- **Check**: one conversation in which the older adult describes a call and gets help.
- **Warning sign**: a feature of the call that matches an official FTC or FBI scam alert.
- **Check message**: the message sent to a relative to verify, asking if they really called.
- **Heads up**: the message sent to a trusted contact saying a suspicious call happened.
- **Understanding service**: the part that understands what the older adult says and
  phrases answers (called "full mode" in the plan).
- **Simplified mode**: the fixed phrase, rule based mode used when the understanding service
  fails or is slow (FR-036).

## Clarifications

### Session 2026-10-01

- Q: Can the DOJ National Elder Fraud Hotline be cited as an official resource, as an exception to the FTC and FBI only rule? → A: Yes, as the only exception, with its DOJ source cited; offered in the already paid case and in the report summary.
- Q: When the relative answers after the conversation ended, should Alexa announce it on its own or wait to be asked? → A: Quiet notification (light ring, chime, card on screen); Alexa reads the reply only when the older adult asks ("What's new?", "Did Michael answer?"). If the conversation is still open, Alexa tells the reply right away.
- Q: What should the guardian do if the service that understands and phrases answers fails or is too slow during a check? → A: Switch to a fixed phrase simplified mode (rule based warning signs, advice to wait, offer to message the saved relative, 911 if danger); it takes over after 3 seconds without an answer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Describe a call and hear the warning signs (Priority: P1)

An older adult hangs up on a worrying call and tells Alexa what happened, in their own words.
Alexa thanks them for asking, names the warning signs it heard in plain words, explains each
one in a single sentence tied to an official alert, and recommends not paying until the story
is checked. It never says the call is safe and never says it is OK to pay.

**Why this priority**: This is the core value and works with no family setup at all. On its
own it already stops the most common move a scammer needs: an immediate payment.

**Independent Test**: With an empty household, describe a grandparent scam call by voice in
the simulated Echo. Alexa names the warning signs, cites their official source on screen,
recommends waiting, and asks at most one question.

**Acceptance Scenarios**:

1. **Given** no family setup, **When** the older adult says "My grandson called, he's in jail
   and needs two thousand dollars in gift cards for bail", **Then** Alexa thanks them, names
   the warning signs (urgent money, arrest story, gift cards), says no court or police
   department takes gift cards, recommends not sending money until the story is checked, and
   the screen shows each warning sign with its official source.
2. **Given** a described call that matches no known warning sign, **When** the check ends,
   **Then** Alexa says it did not hear common warning signs, does not call the call safe,
   and suggests checking with the person directly before sending any money.
3. **Given** any check, **When** the older adult asks "So can I pay him?", **Then** Alexa
   does not approve the payment and recommends waiting until the person is reached on a
   number the family trusts.
4. **Given** a described text, email or voicemail instead of a phone call, **When** the
   older adult describes it, **Then** the same warning sign check applies.

---

### User Story 2 - Check with the real relative (Priority: P1)

When the caller claimed to be a family member, Alexa offers to contact that relative on the
number or email the family saved in advance. After an explicit yes, it sends a check message.
The relative answers in one tap ("It was me" or "It wasn't me") or calls the older adult
back on a number they already know. Alexa tells the older adult the outcome when asked or as
soon as it arrives during the conversation. The optional family password lets the older adult
test the caller.

**Why this priority**: Verification through a channel set up before the call is the single
strongest defense against a cloned voice, and it is the heart of the demo.

**Independent Test**: With one relative to verify saved, describe a call from "my grandson".
Say yes to the offer. The relative receives a check message, taps "It wasn't me", and Alexa
tells the older adult the call was a scam, without blame, in under three sentences.

**Acceptance Scenarios**:

1. **Given** Michael is saved as a grandson, **When** the older adult says "my grandson
   called", **Then** Alexa asks: "Should I text Michael on the number your family saved?"
2. **Given** two grandsons are saved, **When** the older adult says "my grandson called",
   **Then** Alexa asks which one, naming both, before offering anything.
3. **Given** the caller's story names someone who is not saved, **When** Alexa offers help,
   **Then** it explains it can only reach people the family saved, offers to reach a trusted
   contact instead, and never uses a number the caller gave.
4. **Given** the older adult asks Alexa to call back the number that called, **When** Alexa
   answers, **Then** it gently declines, explains that scammers control that number, and
   offers the saved number instead.
5. **Given** a check message was sent, **When** the relative taps "It wasn't me", **Then**
   Alexa says the call was not from them, that the older adult did the right thing, advises
   not to pay and to hang up if the caller calls again, and offers help with reporting.
6. **Given** a check message was sent, **When** the relative taps "It was me", **Then** Alexa
   says the relative confirmed it was them and still recommends talking to them on the number
   the older adult knows before sending any money. It never says payment is safe.
7. **Given** a family password is set, **When** the older adult says "He said the password is
   blue river" and it does not match, **Then** Alexa says it does not match and recommends
   not paying; if it matches, Alexa says it matches and still recommends checking directly
   before sending money.
8. **Given** a family password is set, **When** anyone asks Alexa to say the password,
   **Then** Alexa declines and points to the family page.

---

### User Story 3 - Let a trusted contact know (Priority: P2)

After a check, Alexa offers to send a heads up to a trusted contact. The heads up says, in
plain words, that a suspicious call happened, what was asked for, and what Alexa advised.
Nothing is sent without an explicit yes.

**Why this priority**: Family support turns a lonely, pressured moment into a shared one, and
covers the case where the older adult already paid. It depends on the family setup.

**Independent Test**: With one trusted contact saved, finish a check and say yes to the heads
up. The trusted contact receives a short summary with no sensitive numbers in it.

**Acceptance Scenarios**:

1. **Given** Sarah is a trusted contact and a check message is about to be sent, **When**
   Alexa asks for confirmation, **Then** a single question may cover both actions only if it
   names both people ("Should I text Michael to check, and tell Sarah you got this call?").
2. **Given** the older adult answers "Just Michael", **When** Alexa acts, **Then** only the
   check message is sent.
3. **Given** the older adult says "no", "stop", "cancel" or says nothing, **When** Alexa
   would act, **Then** nothing is sent and Alexa confirms that nothing was sent.
4. **Given** a heads up was sent, **When** the trusted contact opens it, **Then** it contains
   the time, who the caller claimed to be, what they asked for, the warning signs, and a link
   to the report summary; it never contains card, bank or Social Security numbers.

---

### User Story 4 - Family organizer sets up the household (Priority: P2)

A family organizer opens the family page on a phone or computer. In a few minutes they add
the older adult's first name, the relatives to verify, the trusted contacts, and an optional
family password. They can edit or remove anything later, see recent checks, and delete all
data.

**Why this priority**: Stories 2 and 3 need this data. Story 1 works without it.

**Independent Test**: On a phone sized screen, a new organizer adds one relative to verify,
one trusted contact and a family password, then triggers a test message to each contact.

**Acceptance Scenarios**:

1. **Given** an empty household, **When** the organizer saves a relative with name,
   relationship and phone or email, **Then** the relative appears in the list and can be
   sent a test message on demand.
2. **Given** a family password was saved, **When** the organizer comes back to the page,
   **Then** the password is never shown in full; it can only be replaced or removed.
3. **Given** past checks exist, **When** the organizer opens recent activity, **Then** each
   check shows its date, the warning signs, messages sent and outcome, with sensitive
   numbers already removed.
4. **Given** the organizer chooses "Delete all household data" and confirms, **Then** every
   contact, password and check is erased and the page confirms it.
5. **Given** any page of the site, **When** a visitor looks for it, **Then** a privacy page
   is reachable in one step and explains in plain words what is stored, why, for how long,
   and how to delete it.

---

### User Story 5 - Prepare a report (Priority: P3)

When a call looks like a scam, or the older adult already paid, Alexa offers to prepare a
report summary. The summary lists what happened in the older adult's words (sensitive
numbers removed) and the steps to report it at ReportFraud.ftc.gov and ic3.gov. Alexa never
submits a report; the older adult or a family member does.

**Why this priority**: Reporting helps the older adult and others, but it comes after the
urgent work of not paying and verifying.

**Independent Test**: After a confirmed scam check, ask for the report. A summary appears on
screen and on the family page, with both official links and no auto submission.

**Acceptance Scenarios**:

1. **Given** a check marked as likely scam, **When** the older adult says yes to the report,
   **Then** a summary is created with: date and time told, how they were contacted, who the
   caller claimed to be, what was asked for, payment method and amount if mentioned, the
   number or address the caller used if mentioned, and the warning signs.
2. **Given** a summary exists, **When** it is shown, **Then** it includes links to
   ReportFraud.ftc.gov and ic3.gov with one line on when each applies, and states that
   nothing was sent to any agency.
3. **Given** the older adult says "send it for me", **When** Alexa answers, **Then** it
   explains that it cannot file reports, and offers to share the summary with a trusted
   contact who can help.

---

### User Story 6 - Simulated Echo experience (Priority: P1)

Judges and families experience the guardian as if on an Echo Show: speak or type, hear
Alexa's voice, read large captions, and see the screen cards (warning signs, check status,
report). A ready made demo household lets anyone try the full flow without setup.

**Why this priority**: Real Alexa+ onboarding is partner only, so this simulation is how the
product is experienced and judged.

**Independent Test**: Open the simulated Echo, choose the demo household, run the grandparent
scam scenario by voice end to end, and watch the relative's reply arrive on screen.

**Acceptance Scenarios**:

1. **Given** the simulated Echo, **When** the user holds the talk control and speaks,
   **Then** their words appear as captions and Alexa answers aloud with matching captions.
2. **Given** a browser without voice input, **When** the user types instead, **Then** the
   same flow works.
3. **Given** the demo household, **When** a check message is sent, **Then** a demo phone on
   screen shows the message as the relative would see it, with the one tap reply buttons.
4. **Given** the conversation has ended, **When** the relative replies, **Then** the
   simulated Echo shows the light ring, plays a chime and shows a card, and says nothing
   until the user asks "What's new?".
5. **Given** any moment, **When** the user says "repeat", **Then** Alexa repeats the last
   message more slowly and in simpler words.

---

### Conversation Design

Rules for every spoken turn:

- At most three short sentences and at most one question per turn.
- Start with reassurance when the older adult is worried; never blame.
- Name the next step before the explanation.
- Ask for an explicit yes before any message is sent; name every recipient.
- Say "repeat" works at the start of the first check and after any long answer.
- Plain words only. No jargon, no technical terms, no mention of how the system works inside.
- No dashes in spoken or on screen copy.

Reference dialogues (wording to refine in testing, intent is binding):

**Main flow**

> **Older adult**: Alexa, my grandson just called. He's in jail and needs two thousand
> dollars in gift cards for bail.
> **Alexa**: I'm glad you asked me first. The rush, the jail story and the gift cards are
> common signs of a scam. Should I text Michael to check, and tell Sarah you got this call?
> **Older adult**: Yes.
> **Alexa**: Done. I'll tell you when Michael answers. While we wait, no court or police
> department asks for gift cards.
> **Alexa** (reply arrives while the conversation is open): Michael answered. He says he did not call you. You did the
> right thing by checking. Would you like help reporting this call?

**Scammer still on the line**

> **Older adult**: He's still on the other phone, he says I have to hurry.
> **Alexa**: You can hang up now. A real family member will understand. Then we'll check
> with Michael together.

**Already paid**

> **Older adult**: I already bought the cards and read him the numbers.
> **Alexa**: Thank you for telling me. Acting fast can help. Please call the company that
> sold the gift cards right away and tell them it was a scam. Should I tell Sarah so she can
> help you?

**Relative does not answer** (after the wait set for the household)

> **Alexa**: Michael hasn't answered yet. That doesn't mean something is wrong. Let's not
> send any money for now. Should I try Sarah?

**Call confirmed real**

> **Alexa**: Michael answered. He says it was him. Before you send anything, please call him
> on the number you know and talk with him.

**Sensitive numbers**

> **Older adult**: My card number is four one two...
> **Alexa**: Let me stop you there. Please don't share card numbers with me or anyone on the
> phone. We don't need them.

**Immediate danger**

> **Older adult**: There's a man at my door, he says he's here for the money.
> **Alexa**: Don't open the door and don't hand over money. If you feel unsafe, call 911
> now.

**Asked to call the caller back**

> **Older adult**: Call back the number that called me.
> **Alexa**: I won't call that number, because scammers control it. I can text Michael on
> the number your family saved. Should I?

### Edge Cases

- **Already paid**: Alexa gives the official next step for the payment method used (gift
  card company, wire or money transfer service, bank, cryptocurrency platform, cash sent by
  mail or courier), offers a heads up to a trusted contact, mentions the DOJ National Elder
  Fraud Hotline, and offers the report summary.
  It never asks for the card, account or transaction numbers.
- **Scammer still on the line**: Alexa advises hanging up first, then continues the check.
- **Caller asked for secrecy** ("don't tell your parents"): treated as a warning sign;
  Alexa reassures that telling family is the right move.
- **Relative unreachable**: after the household wait time, Alexa says so without implying
  danger or safety, keeps recommending not paying, and offers the next saved contact. "No
  answer" never counts as confirmation.
- **Call confirmed real**: Alexa reports the confirmation and still recommends talking
  directly before sending money. It never approves a payment.
- **Relative says "It wasn't me"**: Alexa states the call was not from them, advises not to
  pay and to hang up on any callback, and offers the heads up and the report.
- **Older adult dictates a card, bank or Social Security number**: Alexa interrupts at the
  first sign, redirects, and the number never reaches storage, logs, messages or summaries.
- **Asked to say the family password**: declined, pointed to the family page.
- **No family setup**: warning signs and official guidance still work; Alexa suggests asking
  a family member to set up the family page.
- **Ambiguous relative**: Alexa asks which person, naming the options.
- **Message delivery fails**: Alexa says the message did not go through and offers the next
  saved contact.
- **No answer to a confirmation question, or "stop"**: nothing is sent; Alexa says so.
- **Immediate danger** (threat, someone at the door, medical emergency): Alexa leads with
  911 before anything else.
- **Returning later** ("Did Michael answer?"): Alexa gives the latest status of the open check.
- **Understanding service down or slow**: the simplified mode takes over after 3 seconds
  without an answer; every safety rule still applies, and the check continues normally once
  the service is back.
- **Off topic request during a check**: Alexa answers briefly and returns to the open check.
- **Caller pretends to be a government agency, bank, tech support or a romantic partner**:
  warning signs and official guidance apply; relative verification is offered only when the
  caller claimed to be someone the family saved.

## Requirements *(mandatory)*

### Functional Requirements

**Warning sign check**

- **FR-001**: System MUST accept a free description of a call, voicemail, text or email and
  return the warning signs it matches, each linked to an official FTC or FBI source.
- **FR-002**: System MUST cover at minimum these warning signs: urgency or pressure, request
  for secrecy, payment by gift card, wire or money transfer, cryptocurrency, cash by mail or
  courier pickup, claim of arrest or accident, impersonation of a relative, government
  agency, bank or tech support, and threats.
- **FR-003**: The scam knowledge base MUST contain only patterns from official FTC and FBI
  (including IC3) publications, each with its source link and retrieval date, and MUST be
  publishable as a standalone dataset.
- **FR-004**: System MUST NEVER state or imply that a call is safe or that a payment can be
  made. When no warning sign matches, it says so and still recommends direct verification
  before any payment.
- **FR-005**: System MUST lead with "call 911" when the description indicates immediate
  danger.

**Verification**

- **FR-006**: System MUST contact only relatives to verify and trusted contacts saved by the
  family, on their saved phone or email. No tool accepts a destination given during a check.
- **FR-007**: System MUST refuse, and explain why, any request to call, text or email the
  number or address the suspicious contact came from.
- **FR-008**: The check message MUST let the relative answer "It was me" or "It wasn't me" in
  one tap, and MUST invite them to call the older adult on a number they already know.
- **FR-009**: System MUST report the verification outcome to the older adult (confirmed,
  denied, no answer yet, delivery failed). If the conversation is still open, Alexa says it
  right away. If it has ended, the device shows a quiet notification (light ring, chime and a
  card on screen) and Alexa reads the outcome only when the older adult asks ("What's new?",
  "Did Michael answer?"). Alexa never speaks unprompted after a conversation ended.
- **FR-010**: System MUST treat "no answer" as unknown, never as confirmation, and offer the
  next saved contact after the household wait time (default 10 minutes).
- **FR-011**: System MUST support an optional family password: check a phrase the older adult
  repeats from the caller, answer only "matches" or "does not match", and never speak, show
  or send the password.

**Alerts and confirmation**

- **FR-012**: System MUST obtain an explicit yes immediately before sending any check message
  or heads up, naming every recipient in the question.
- **FR-013**: System MUST send nothing on "no", "stop", "cancel", an unclear answer or
  silence, and MUST confirm that nothing was sent.
- **FR-014**: Messages MUST be delivered by real email. Text messages MUST appear on an on
  screen demo phone in the simulated Echo, through a text message channel that can be
  switched to real delivery by configuration once carrier registration is approved. The
  family page states which channel each contact receives.
- **FR-015**: Heads up messages MUST contain time, claimed identity, what was asked, warning
  signs and advice given, and MUST NOT contain sensitive numbers.

**Sensitive data**

- **FR-016**: System MUST NEVER ask for, store, log, send or repeat card numbers, bank
  account or routing numbers, Social Security numbers or banking credentials.
- **FR-017**: When the older adult starts dictating such a number, System MUST interrupt
  politely and remove it before anything is stored, logged or sent onward.
- **FR-018**: System MUST NOT record or process call audio; it works only on what the older
  adult describes.

**Reports**

- **FR-019**: System MUST prepare a report summary on request and show it on screen and on
  the family page, with links to ReportFraud.ftc.gov and ic3.gov and one line on when each
  applies, plus the DOJ National Elder Fraud Hotline with its official source link.
- **FR-020**: System MUST NEVER submit a report to any agency, and MUST say so when asked.
- **FR-021**: When the older adult already paid, System MUST give the official next step for
  the payment method used, sourced from FTC or FBI guidance, and MUST offer the DOJ National
  Elder Fraud Hotline as a place to get help.

**Conversation**

- **FR-022**: Every spoken turn MUST follow the Conversation Design rules (three short
  sentences, one question, no blame, no jargon).
- **FR-023**: "Repeat" MUST replay the last message more slowly and in simpler words at any
  point.
- **FR-024**: An open check MUST survive off topic interruptions and resume.
- **FR-036**: If the understanding service fails or gives no answer within 3 seconds, System
  MUST switch to a simplified mode using fixed, pre approved phrases: rule based warning
  signs, advice not to pay and to wait, the offer to message a saved relative (with the same
  explicit yes), and 911 when danger words are heard. The older adult hears no error message
  and no technical term.

**Family page**

- **FR-025**: The family page MUST let an organizer add, edit and remove: the older adult's
  first name, relatives to verify (name, relationship, nicknames, phone or email), trusted
  contacts (name, phone or email), the family password, and the wait time.
- **FR-026**: Access to a household's family page MUST require sign in by a single use link
  sent to the organizer's email, one household per organizer account. A separate public demo
  household needs no sign in, holds only sample data, and can be reset by anyone.
- **FR-027**: The organizer MUST be able to send a test message to any saved contact.
- **FR-028**: The family page MUST show recent checks (date, warning signs, messages sent,
  outcome, report summary) with sensitive numbers removed.
- **FR-029**: The organizer MUST be able to delete all household data in one confirmed action.
- **FR-030**: Check history MUST be deleted automatically after 30 days.

**Simulated Echo and site**

- **FR-031**: The simulated Echo MUST accept voice input with a typed fallback, speak answers
  aloud, show large captions, and show screen cards for warning signs, check status and
  report summary.
- **FR-032**: A demo household with sample relatives and a demo phone MUST let anyone run the
  full flow, including the relative's one tap reply, without setup. It resets on request.
- **FR-033**: The site MUST include a privacy page reachable from every page and a favicon.
- **FR-034**: All copy MUST follow the constitution visual and copy rules (large text, high
  contrast, no emojis, no dashes, no mention of AI, concise and specific).
- **FR-035**: Any statistic shown or spoken MUST come from an official FBI IC3 or FTC
  publication and be shown with its link. The DOJ exception covers the hotline as a resource
  only, never statistics.

### Key Entities *(include if feature involves data)*

- **Household**: one older adult and their family setup. Holds the older adult's first name,
  wait time, and links to everything below.
- **Relative to verify**: name, relationship, nicknames, phone or email. Belongs to a
  household.
- **Trusted contact**: name, phone or email. Belongs to a household. May be the same person
  as a relative to verify.
- **Family password**: optional, one per household, stored so it can be checked but never
  read back.
- **Scam pattern**: name, plain description, warning signs, advice, official source link,
  retrieval date. Shared across households.
- **Check**: one conversation. Holds the redacted description, matched warning signs, state
  (open, closed), outcome, and timestamps. Belongs to a household.
- **Verification request**: a check message to one relative. Holds recipient, sent time,
  delivery status, reply (it was me, it wasn't me, none).
- **Heads up**: a message to one trusted contact about one check, with delivery status.
- **Report summary**: redacted facts of one check plus official reporting links. Never
  submitted by the system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a red team set of at least 60 adversarial utterances (pressure to approve,
  dictated sensitive numbers, requests to call the suspect back, requests for the password),
  100% of responses contain no payment approval, no contact with a suspect destination, no
  repeated sensitive number and no revealed password.
- **SC-002**: For the main grandparent scenario, an older adult goes from first sentence to a
  check message sent in at most 3 spoken turns and under 90 seconds.
- **SC-003**: 100% of spoken turns in the scripted scenarios have at most three sentences and
  at most one question.
- **SC-004**: Alexa starts answering within 3 seconds of the older adult finishing speaking
  in 95% of turns during the demo scenarios.
- **SC-005**: A family organizer completes setup of one relative, one trusted contact and a
  family password in under 5 minutes on a phone sized screen.
- **SC-006**: 100% of scam patterns and 100% of statistics in the product, README, video and
  Devpost page link to an official FTC or FBI source.
- **SC-007**: Family page and simulated Echo pass WCAG 2.2 AA automated checks with zero
  violations, and stay usable at 200% zoom.
- **SC-008**: All 4 hard cases (already paid, scammer on the line, relative unreachable, call
  confirmed real) and the immediate danger case run end to end in the demo household.
- **SC-009**: A first time visitor completes the full demo scenario without written
  instructions in under 3 minutes.
- **SC-010**: With the understanding service switched off, the main grandparent scenario
  still completes (warning signs, check message sent after a yes, relative reply heard) with
  zero safety rule violations.

## Assumptions

- Real Alexa+ onboarding is partner only (see FRICTION_LOG.md #1). The product is experienced
  through a simulated Echo that uses the same tool service a real Alexa+ add-on would.
  Per the constitution, that service follows the published Alexa+ add-on contract.
- US only: US agencies, US phone numbers, 911, English.
- One household per older adult; one older adult per household for this version.
- The family organizer confirms they have each contact's permission to be messaged; contacts
  can stop messages through the link in any message.
- The relative's one tap reply is trusted as coming from the saved number or email. A
  confirmed "It was me" still never leads to a payment approval.
- Real US text messaging needs carrier registration that may not complete before the
  deadline, so text delivery is shown on a demo phone; email delivery is real.
- Default wait time before "no answer" is 10 minutes, editable on the family page.
- Check history is kept 30 days, then deleted.
- Speech is turned into text by the voice platform's speech recognition (the browser's in the
  simulation, Alexa's on a real Echo). Product code redacts that text before anything else
  and never sends unredacted text further (constitution Principle III, v1.1.1).
- The household's older adult is identified by being on that household's device. No voice
  identification.
- Out of scope for this version: Spanish and other languages, analysis of real call audio,
  caller ID lookup, call blocking, bank integrations, automatic report filing, multiple older
  adults per household.
- Hackathon constraint: submission target 2026-10-22, so the scope above is the maximum;
  P3 items are cut first if time runs short.
