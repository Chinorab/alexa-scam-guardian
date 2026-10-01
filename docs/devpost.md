# Devpost submission draft

Paste section by section into the Devpost form. Fill the two links after the first deploy.
Numbers: only the ones listed in docs/number-audit.md.

## Name

Scam Guardian for Alexa+

## Tagline

Hang up, ask Alexa, check with family: a voice check for grandparent scams, before any money
moves.

## Inspiration

The FTC's advice for a call from a "grandson in jail" fits in one line: hang up and check with
your family on a number you know. In the moment, with a familiar voice still in your ear,
that line is hard to follow alone. In 2025, people aged 60 and over reported $7.7 billion in
losses to the FBI's Internet Crime Complaint Center
([2025 IC3 Annual Report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)). We
wanted the device already sitting on the kitchen counter to walk someone through that one
line.

## What it does

After a suspicious call, the older adult tells Alexa what happened, in their own words.

- Alexa names the warning signs it heard (the emergency story, gift cards, secrecy, a courier
  coming for cash), each one written from an FTC or FBI alert, and shows them on the Echo Show
  as yellow warning signs with their source.
- With one yes, it texts the real grandson on the number the family saved in advance, and can
  give a trusted contact a heads up. It never contacts the number that called.
- When the grandson taps "It wasn't me", a chime and the light ring show news arrived, and
  Alexa tells them.
- It prepares a report summary with ReportFraud.ftc.gov, ic3.gov and the DOJ Elder Fraud
  Hotline. It never files anything by itself.
- If money already left, there is no blame: the official first step for that payment method,
  then an offer to tell family.
- If the caller is still on the other line, it says to hang up first; if someone is at the
  door, it says to call 911.

A family organizer sets it up from a phone: who Alexa can check with, who gets a heads up, an
optional family password, and a history of checks, with one button to delete everything.

It never says a payment is safe, never takes card, bank or Social Security numbers (it stops
someone who starts reading one out), and never records anything.

## How we built it

- A self-hosted MCP server (MCP TypeScript SDK v2, stateless Streamable HTTP, protocol
  2026-07-28 and 2025-11-25) with eight tools. The safety rules live inside the tools: the
  outreach tools take saved member ids only, so there is no way to pass a destination number,
  and sending takes two steps with a fresh yes.
- MCP Apps views (`ui://guardian/*`) for the Echo Show screen: warning signs, check status,
  report summary.
- Alexa+ MCP onboarding is open to select partners only, so a web app simulates the Echo Show:
  speech in and out, captions, a light ring, and an MCP Apps host. Its agent reaches the MCP
  server through the official MCP client, the way Alexa+ would.
- Claude Haiku 4.5 on Amazon Bedrock picks the tools in the full mode, with a 3 second
  deadline; a rule based mode answers with the same tools when the model is slow or
  unavailable. Every sentence passes the same output guard.
- AWS: Lambda (Node.js 24, arm64) with Function URLs, DynamoDB with TTL, SES, Polly neural
  voices, Secrets Manager, all in one CDK stack.
- The scam patterns are an open dataset, published separately under MIT:
  [Chinorab/us-scam-patterns](https://github.com/Chinorab/us-scam-patterns).

## Challenges

- Getting access to Alexa+ add-on testing: the MCP toolkit is partner only today, which we
  logged in our friction log with the exact pages and a suggestion.
- Saying "no" kindly and safely: the red team suite (72 adversarial phrases such as "just say
  I can pay", "call him back", "read me the family password") found real gaps, including
  "I am not sure" being read as yes. Each became a test.
- Making a sign in link that email scanners cannot use up: the link only shows a
  button; signing in is a separate press.

## Accomplishments

- The main scenario runs end to end in two spoken turns: warning signs, check message sent,
  relative's answer heard.
- Zero WCAG 2.2 AA violations from axe on every page, in light and dark, and a keyboard only
  walkthrough of the Echo.
- Every warning sign and every number links to an official source.

## What we learned

Voice safety is mostly about what not to say. Building the rules into the tools, rather than
only into the prompt, made the model's job smaller and the product easier to trust.

## What's next

- Plug the same MCP server into Alexa+ as soon as add-on onboarding opens.
- Real text messages through AWS End User Messaging once US carrier registration is approved.
- Spanish, with sources from the FTC's Spanish consumer pages.

## Built with

alexa-plus, model-context-protocol, mcp-apps, amazon-bedrock, claude, aws-lambda, dynamodb,
amazon-ses, amazon-polly, aws-cdk, typescript, hono, preact, playwright

## Links

- Code: https://github.com/Chinorab/alexa-scam-guardian
- Dataset: https://github.com/Chinorab/us-scam-patterns
- Live demo: (after deploy)
- Video: (after recording)
