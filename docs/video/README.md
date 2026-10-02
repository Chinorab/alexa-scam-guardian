# Video assets

Everything the edit needs besides the screen recordings, made from the product's own fonts
and colors. Timings follow [../demo-script.md](../demo-script.md).

| File | Use |
|---|---|
| `01-cold-open.png` | 0:00, black card before the Echo appears |
| `02-title.png` | 0:30, title |
| `03-why.png` | 0:35, the one statistic, with its source on screen ([../number-audit.md](../number-audit.md)) |
| `04-architecture.png` | 2:25, how it is built |
| `05-closing.png` | 2:48, last card; swap in the hosted URL after deploy |
| `devpost-cover.png` | Devpost gallery and thumbnail (3:2) |
| `captions.srt` | Burned in captions for every spoken line, Ruth, Alexa and narrator |

Regenerate the cards after a design change: `pnpm video:cards` (needs the Playwright browser).
Record the Echo beats hands free with `pnpm demo:play`.
