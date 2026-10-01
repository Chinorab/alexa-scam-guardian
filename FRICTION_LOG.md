# Friction Log

Each entry is written at the moment the friction happens, never reconstructed afterwards.

---

## #1 — Unclear access status of the Alexa+ MCP Toolkit

- **Date:** 2026-10-01
- **Task attempted:** Find out whether a solo external developer can connect a self-hosted MCP server to a real Alexa+ device for the hackathon.
- **Steps:**
  1. Opened the hackathon Resources page. It links only to generic MCP docs (Agent Skills, Streamable HTTP spec). No Alexa+ toolkit, CLI or simulator link.
  2. Searched developer.amazon.com and found the Alexa+ MCP Toolkit Overview and QuickStart.
  3. QuickStart lists prerequisites (Alexa developer account, remote URL, `alexa-ai configure`) with no mention of an allowlist.
  4. Only the Alexa+ docs home page says: "At this time, Category SDK and MCP Toolkit are available to select partners only." The Alexa+ for Builders landing page confirms: "currently available to select partners working directly with our team."
  5. The hackathon Rules then confirm a simulated Alexa+ experience is an accepted submission path.
- **Expected:** One clear statement, on the hackathon Resources page and on the QuickStart, telling participants whether they can deploy to real Alexa+ and how.
- **Actual:** The QuickStart reads as self-serve; the partner restriction is only on a different page. About 30 minutes of cross-checking across 6 pages to reach a confident answer.
- **Severity:** Medium (no hard blocker, but a developer following the QuickStart alone would hit a wall later, after building around the CLI).
- **Workaround:** Took the official simulated path: real MCP server + web app that simulates Alexa+ and calls the server through an MCP client.
- **Suggestion:** Add an availability banner at the top of every MCP Toolkit page ("Partner preview, not self-serve") and a short "Hackathon participants: here is your path" box on the Devpost Resources page. Publishing a public web simulator or the Local Inspector for everyone would let builders test against the real Alexa+ add-on contract.

### Sources
- https://developer.amazon.com/docs/alexaplus/add-ons/home.html
- https://developer.amazon.com/alexaplus/
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
- https://amazonappdev2026.devpost.com/resources
- https://amazonappdev2026.devpost.com/rules
