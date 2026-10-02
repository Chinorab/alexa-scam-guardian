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

## Shape, space, depth

- Signs: 10 px corners with an inset border (`--radius-sign`, `--sign-border-inset`).
- Controls: rectangles with 8 px corners, never pills; 56 px tall touch targets.
- 4 px spacing scale (`--space-1` to `--space-9`), reading measure 66 characters.
- One shadow for signs (raised off the ground), one for raised panels.

## Motion

Signs rise into place once (`--duration-sign`, 420 ms, ease out), one after another. The Echo
light ring shows listening, thinking, speaking and news. Everything respects
`prefers-reduced-motion`: no rise, no ring sweep.

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

No stock photos, no generated pictures. Every sign on screen is drawn in CSS from the tokens.

| File | Made by |
|---|---|
| `apps/web/public/favicon.svg` | Hand written SVG: a yellow diamond with a phone |
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
