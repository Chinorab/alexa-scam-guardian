# Design: Scam Guardian

The finished design system, documented from the shipped code. The direction it came from is
[docs/design/direction.md](docs/design/direction.md); the source of truth is
[apps/web/src/styles/tokens.css](apps/web/src/styles/tokens.css).

## Idea

The guardian speaks the language every American driver already reads under stress: road
signs (MUTCD vernacular). Someone who just hung up a frightening call should see that what
they felt has a name, see one next step, and do it.

| Sign | Meaning in the product | Where |
|---|---|---|
| Yellow diamond, black legend, inset border | A warning sign Alexa heard | Echo cards, family activity, home page, pattern list |
| Green guide sign, white legend and border | The next step | Primary buttons, check status, the home page call to action |
| Blue services sign | Help: reporting, hotlines | Report card, ReportFraud.ftc.gov and ic3.gov links |
| White regulatory sign, black border | A rule the product never breaks | Home page rules |
| Red octagon | 911 only | Danger line, footer |

Red is never decoration and never used for errors.

## Color

| Token | Value | Use |
|---|---|---|
| `--sign-warning` | `#ffcd1c` | Warning diamonds, text selection |
| `--sign-warning-ink` | `#111417` | Legends on yellow |
| `--sign-guide` | `#00703c` | Next step, primary actions |
| `--sign-services` | `#1f4fa3` | Help, links in daylight |
| `--sign-stop` | `#b3261e` | 911 only |
| `--ground` / `--ink` | `#ffffff` / `#15191c` daylight; `#1f2326` / `#f4f5f2` asphalt | Page and text |

Two themes. Daylight for the family page and the home page (an adult child on a phone,
outdoors). Asphalt for the Echo always (a kitchen counter at any hour, read from a distance),
and for every page when the system asks for dark. Every text pair is at least 6.2:1; control
borders at least 4.7:1. axe WCAG 2.2 AA runs on every page in both themes in CI.

## Type

- **Overpass** (highway lettering lineage) for sign legends and headings: uppercase on signs,
  weight 750 to 800.
- **Atkinson Hyperlegible Next** for sentences: designed for low vision readers.
- Body text never below 20 px (`--text-base: 1.25rem`); secondary lines 18 px. The Echo
  caption is the largest text on its screen.
- Numbers use tabular figures.

## Composition (redesign 2026-10-05)

The home page is a **roadside**. The hero is the shoulder: the promise on the left, the sign
assembly standing at the edge of the road on the right, its post meeting the dark band below.
That band **is the road**: asphalt with a fine aggregate, a white edge line and a dashed yellow
center line, and the kitchen dialogue on it (Ruth plain, Alexa on a small Echo screen with its
light ring, Michael as a phone notification). The rules are five white regulatory signs in one
row, the 911 line a red octagon. Setup steps are numbered with US route markers (white shield
on black, never red or blue: those mean other things here), beside the real family page on a
phone. The page ends on the next step hung over the road on a gantry.

### Reference system: Wise (redesign 2, 2026-10-05)

The owner asked for a second pass with the taste, web design guidelines, awesome design (DESIGN.md
library), image to code and Playwright CLI skills. Image generation was unavailable, so the
reference images were screenshots of wise.com taken with Playwright CLI and read before coding.
Taken from Wise: display headings in the heaviest weight, uppercase, set tight (Overpass 900,
`--display-*` tokens); a sage surface (`#e8ebe6`, `--ground-raised`) for the hero band and every
card, with elevation by surface contrast and no border in daylight (`--card-edge`, a hairline
only at night); 24 px card corners (`--radius-card`); centered heading over a row of cards;
a split section with the visual in a sage panel and a hairline ruled list beside it. Kept from
us: the road sign world, one green accent, 12 px control corners (never pills), sentence case
in the source (uppercase is CSS only), Atkinson Hyperlegible for reading text. The hero headline
holds to three lines on a laptop and its subtext to under 20 words.

| Surface | Container |
|---|---|
| Home | `.page-home`, 76 rem; header and footer line up with it |
| Echo | `.page-wide`, 80 rem: visible title, the device on a band of speaker fabric, a console under it (voice controls, then the keyboard), the demo phone and the family page link beside it; an empty screen offers the example line in one tap |
| Family page | `.page`, 60 rem: people as raised plates with roles as small guide signs, then the tasks as plates two side by side (password, settings, activity, delete) |

## Shape, space, depth

- Signs: 10 px corners with an inset border (`--radius-sign`, `--sign-border-inset`).
- Controls: rectangles with 12 px corners, never pills; 56 px tall touch targets.
- Cards: 24 px corners on the sage surface, no border in daylight.
- 4 px spacing scale (`--space-1` to `--space-9`), reading measure 66 characters.
- One shadow for signs (raised off the ground), one for raised panels.

## Motion

One authored moment, taken from the world: **headlights crossing retroreflective sheeting**.
Real road signs flare when a car's lights pass over them; here a single soft beam
(`--glint`, `@keyframes headlights`, about 1.1 s) crosses a sign once, after it lands, and never
loops.

| Where | What moves | Why |
|---|---|---|
| Home hero | The post rises from the ground (520 ms), the three signs drop onto it top to bottom, then the beam crosses them in order | The focal sequence: the product's promise assembled |
| Home "Try the Echo demo" sign | The beam crosses it on hover or keyboard focus | The sign you are about to take catches the light |
| Echo screen cards | Warning diamonds rise one by one (420 ms) and each catches the beam as it lands; a yellow "it was not them" row or "money already sent" panel does too | A sign Alexa names becomes a sign on the screen |
| Echo caption | Each new line settles in from just below (280 ms) | A new turn, without a show |
| Demo phone | A new message slides in at the top (360 ms) | A notification arriving |
| Buttons | Settle 1 px when pressed (120 ms) | The tap is felt before the answer comes |
| Echo light ring | Listening, thinking, speaking, news | Device state |

Ease is always `cubic-bezier(0.16, 1, 0.3, 1)`; nothing bounces. With
`prefers-reduced-motion`, nothing moves and no beam passes; new lines and messages only fade in
(160 ms) so the change is still seen (tested in `tests/e2e/a11y.spec.ts`). The video cards use the
same vocabulary (`tests/e2e/video-cards-content.ts`).

## Voice and copy

Short sentences, one question at a time, no blame, the next step before the explanation.
No emojis, no dashes, never the word "AI" in product copy: `pnpm lint:copy` enforces it at
build time and the output guard at run time for everything Alexa says.

## Components

| Component | Code |
|---|---|
| Sign assembly on a post (home) | `.signpost` in [home.css](apps/web/src/styles/home.css) |
| Warning sign marker | `.sign-diamond` in [base.css](apps/web/src/styles/base.css) |
| Buttons: guide green, secondary, danger | `.button`, `.button-secondary`, `.button-danger` |
| Forms with error summary and inline messages | `.form`, `.field`, `.error-summary` |
| People list and activity history | `.people`, `.person`, `.activity` |
| Echo device, caption, light ring, demo phone | [echo.css](apps/web/echo/src/echo.css) |
| Echo screen cards (MCP Apps views) | [apps/mcp-server/ui-src/view.css](apps/mcp-server/ui-src/view.css) |

## Images and their provenance

No stock photos, no generated pictures. Every sign on screen is drawn in CSS from the tokens;
interface icons come from Lucide.

| File | Made by |
|---|---|
| `apps/web/public/favicon.svg` | Hand written SVG: a yellow diamond around the Lucide phone icon (ISC) |
| `favicon.ico`, `apple-touch-icon.png` | `pnpm --filter @asg/web favicons` from the SVG |
| `docs/images/*.png` | Playwright screenshots of the running product (`tests/e2e/capture*.spec.ts`) |
| `docs/video/*.png` | `pnpm video:cards`, the product's own CSS rendered in Chromium |

## Finish review (2026-10-02)

- Checked: home, Echo, family pages and privacy at 1440 px and 390 px, light and dark; 200%
  zoom and 320 px reflow; keyboard only on the Echo.
- Fixed in the review: the diamond legend hidden behind its rotated square, a heading id that
  took the family password field's label, a scrollable Echo screen the keyboard could not
  reach, typed words lost in the Echo's first second, a stale "You said" line on news.
- Verdict: ships. Open item for later: a Spanish version needs its own sign legends.
