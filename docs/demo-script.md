# Demo video script (2:50, English)

Goal: the judge understands the product, sees it work, and trusts its safety in the first
30 seconds; the rest proves depth. Every Alexa line below is what the product says today in
the demo household (checked with `pnpm measure` and the Playwright scenarios). Record with the
hosted URL once deployed, Polly voice on; until then the local run.

Hands free take: `pnpm demo:play` (or `E2E_BASE_URL=https://... pnpm demo:play` on the hosted
site) opens a visible Chromium and plays every Echo beat below at a human pace, typing,
answering on the demo phone and waiting for each spoken answer. Record the window with any
screen recorder, then cut the takes to the timings. The family page and the build section are
recorded by hand.

Recording setup: Chrome, 1440 x 900 window, system light theme for the family page, Echo page
full screen. Phone shots: Chrome device mode at 390 x 844. No background music under speech.
Captions burned in for every spoken line.

## 0:00 to 0:30 The check (cold open, no title)

| Time | Screen | Audio |
|---|---|---|
| 0:00 | Black. White text: "Ruth just hung up. The caller said he was her grandson." | Silence, then a phone handset being put down. |
| 0:04 | Echo page, idle, light ring off. | Ruth (typed and spoken): "Alexa, my grandson just called. He's in jail and needs two thousand dollars in gift cards for bail." |
| 0:10 | Caption fills the screen; two yellow diamonds rise: EMERGENCY STORY, GIFT CARDS, each with "Source: FTC consumer advice". | Alexa: "I'm glad you asked me first. The emergency story and the gift cards are common signs of a scam. Should I text Michael to check, and tell Sarah you got this call?" |
| 0:19 | Ruth taps Talk. | Ruth: "Yes." Alexa: "Done. I'll tell you when Michael answers." |
| 0:23 | Demo phone: Michael's text arrives. Cursor taps "It wasn't me". | Text message sound. |
| 0:26 | Chime, light ring, check status card turns yellow: "Michael says it was not them". | Alexa: "Michael says he did not call you, so you did the right thing by checking. Please don't send any money, and hang up if they call back. Would you like help reporting this call?" |

## 0:30 to 0:45 Why it matters

| Time | Screen | Audio (narrator) |
|---|---|---|
| 0:30 | Title card: "Scam Guardian for Alexa+". | "Scam Guardian is an Alexa+ add-on for the moment right after a scary call." |
| 0:35 | One line, with the source under it: "2025: people 60 and over reported $7.7 billion in losses to the FBI. Source: 2025 IC3 Annual Report." | "The FTC's advice is simple: hang up and check with your family on a number you know. Scam Guardian turns that advice into a conversation." |

## 0:45 to 1:30 The rules it never breaks

Each beat: the utterance typed live, the answer on screen. Cut between beats, no narration
over Alexa.

| Time | Ruth says | Alexa answers |
|---|---|---|
| 0:45 | "So can I pay him?" | "Let's not send any money yet. First, call your family on a number you know." |
| 0:55 | "He's still on the other phone, he says I have to hurry." | "You can hang up now. A real family member will understand." |
| 1:05 | "My card number is four one two two..." | Interrupts while she is still speaking: "Let me stop you there. Please don't share numbers like that with me or anyone on the phone. We don't need them." |
| 1:15 | "Call back the number that called me." | "I won't call that number, because scammers control it. Please call your family on a number you know." |
| 1:22 | "There's a man at my door, he says he's here for the money." | "Don't open the door and don't hand over money. If you feel unsafe, call 911 now." |

Narrator over the last beat: "It never says a payment is safe. It never contacts the caller.
It never takes card numbers. And it never records the call."

## 1:30 to 2:00 After the call

| Time | Screen | Audio |
|---|---|---|
| 1:30 | "Help me report it." Report card: what happened, warning signs, links to ReportFraud.ftc.gov, ic3.gov, DOJ Elder Fraud Hotline with hours. | Alexa: "I put a summary on the screen with where to report it. Nothing was sent to any agency." |
| 1:42 | Start over, then: "I already bought the cards and read him the numbers." | Alexa: "Thank you for telling me. Call the company that sold the gift card right away. Should I tell Sarah you got this call, so she can help?" Ruth: "Yes." Alexa gives the DOJ Elder Fraud Hotline. |
| 1:55 | Demo phone shows Sarah's heads up email. | Narrator: "No blame, one first step, and the family knows." |

## 2:00 to 2:25 The family sets it up

| Time | Screen (phone size) | Audio (narrator) |
|---|---|---|
| 2:00 | Home page, then Family page sign in with an email link (or, on the Echo, "Open Ruth's family page"). | "A grandchild sets it up from their phone in a few minutes." |
| 2:08 | Add Michael (text, confirm calls), add Sarah (email, heads up). | "Who Alexa can check with, and who gets a heads up." |
| 2:16 | Family password saved, never shown again. Activity page with the check from the cold open. | "An optional family password, and a history of every check. One button deletes it all." |

## 2:25 to 2:50 How it is built

| Time | Screen | Audio (narrator) |
|---|---|---|
| 2:25 | Architecture diagram from the README. | "Under the hood is a real MCP server with eight tools, running on AWS Lambda. The safety rules live inside the tools: there is no way to pass a destination number." |
| 2:33 | MCP Inspector listing the tools against the hosted `/mcp`. | "Claude Haiku on Amazon Bedrock picks the tools, a rule based mode takes over if it is slow, and every sentence passes the same guard." |
| 2:41 | Terminal: red team suite passing, 72 utterances. Then the open dataset repository. | "Seventy five adversarial phrases run on every push. The scam patterns come only from FTC and FBI alerts, and they are open source." |
| 2:48 | Home page closing sign: TRY THE ECHO DEMO, with the URL. | "Hang up. Ask Alexa. Check with family." |

## Checklist before recording

- [ ] Hosted URL works from a clean browser profile; Polly voice on.
- [ ] Demo household reset (Start over) before each take.
- [ ] The only statistic is the IC3 figure, shown with its source (docs/number-audit.md).
- [ ] No word "AI" in captions or titles; no emojis; no dashes in on screen text.
- [ ] Total length under 3:00 on the export.
