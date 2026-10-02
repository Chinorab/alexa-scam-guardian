# US scam patterns from official sources

Phone and online scam patterns that target older adults in the United States, written only
from Federal Trade Commission (FTC) and FBI publications. Every pattern, warning sign and
first step after paying cites the official page it comes from, with the date it was read.

Made for voice assistants, help lines and family tools that need to say "this is a common
sign of a scam" without inventing anything. It powers
[Scam Guardian for Alexa+](https://github.com/Chinorab/alexa-scam-guardian).

## What is inside

| File | Content |
|---|---|
| [data/patterns.json](data/patterns.json) | The dataset |
| [schema/pattern.schema.json](schema/pattern.schema.json) | JSON Schema (draft 2020-12) |
| [src/check.ts](src/check.ts) | Checks: schema, every reference resolves, every source is an official host, every cue compiles |
| [src/types.ts](src/types.ts) | TypeScript types |

The dataset has five parts:

- `sources`: official pages (publisher FTC, FBI, IC3 or DOJ, title verbatim, short label,
  URL, date read).
- `warningSigns`: one sign each (for example `gift-cards`, `arrest-story`, `secrecy`), a short
  label to say out loud, a plain explanation, regular expression cues for matching a spoken
  description, and its sources.
- `patterns`: scam types (family emergency, government impersonation, fake bank call, fake
  company call about an order, tech support, cash or gold courier, romance, prize,
  cryptocurrency payment), the warning signs each one uses, official advice, and sources.
- `ifPaid`: the official first steps for each payment method (gift card, wire, money
  transfer app, cryptocurrency, cash by mail, cash courier, bank transfer, other).
- `resources`: where to report or get help: ReportFraud.ftc.gov, ic3.gov, and the DOJ
  National Elder Fraud Hotline.

```json
{
  "id": "gift-cards",
  "label": "gift cards",
  "explanation": "Only scammers tell you to buy gift cards and give them the numbers on the back.",
  "cues": ["\bgift ?cards?\b", "..."],
  "sourceRefs": ["ftc-gift-cards"]
}
```

## Rules the data follows

1. Only FTC, FBI and IC3 publications back a pattern or a warning sign. DOJ pages back help
   resources only.
2. No statistic without its official source; the dataset holds none today.
3. Plain language: short sentences a frightened person can follow, no blame.
4. Cues match what a person says after the call; they never need a recording.

## Use it

```bash
npm install
npm run check          # schema and references
npm run check:online   # also checks that every source URL still answers
```

From JavaScript or TypeScript, read `data/patterns.json` directly; it has no runtime
dependency.

## Contributing

Open an issue or a pull request with the official FTC, FBI or IC3 page that supports the
change. Pull requests run the same checks.

## License

Code and dataset: MIT, see [LICENSE](LICENSE). The cited FTC and FBI pages are works of the
United States government; titles are quoted verbatim for citation.
