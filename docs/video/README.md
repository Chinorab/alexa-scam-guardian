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

## The whole video, built from the deployed site

```bash
pnpm video:voices                                   # Ruth and narrator lines, Polly neural
E2E_BASE_URL=https://<web url> pnpm video:record     # the Echo beats and the family page, with a timeline
pnpm video:compose                                  # cut, voices, held frames, captions, loudness
```

Output: `video-out/scam-guardian-demo.mp4` (1920 x 1080, 30 fps, AAC, loudness -16 LUFS,
captions burned in) and `video-out/captions.srt`; `video-out/` is not committed. Alexa speaks
with the product's own Polly voice (Joanna), Ruth with the Polly voice Ruth, the narrator with
Matthew. Every Alexa line and every screen is the deployed product at recording time; each
Alexa line is placed where its caption appeared, and only whole sentences are dropped to fit
("While we wait" after "I'll tell you when Michael answers"). The first build on 2026-10-02
ran 2 min 54 s; it leaves out the "call back the number" beat to stay under 3 minutes (the
narration still says it never contacts the caller).
