# Product Feedback

One section per tool, SDK or API used. Updated as the project goes.

---

## Alexa+ MCP Toolkit documentation (developer.amazon.com/docs/alexaplus)

- **Used for:** Checking whether the MCP server could be onboarded to real Alexa+, and shaping the server so it matches the add-on contract (MCP 2025-11-25, Streamable HTTP, sub 500 ms tool latency, MCP Apps visuals, OAuth 2.1 + PKCE).
- **What worked well:** The technical requirements are concrete and short. Adopting standard MCP (instead of a proprietary skill model) means the same server can serve Alexa+ and any other MCP client.
- **What needs work:** Access status (partner only) is stated on one page and missing from the QuickStart. See FRICTION_LOG.md #1.
- **Onboarding:** Could not go past reading the docs: the toolkit is partner gated.
- **Would I build with it again:** Yes, once the toolkit opens to independent developers.

---

## Vitest 5

- **Used for:** Unit, contract and red team suites, one root config with `projects`.
- **What worked well:** Zero config TypeScript, fast first run, clear output.
- **What needs work:** Nothing so far.
- **Onboarding:** Smooth.
- **Would I build with it again:** Yes.

---

## TypeScript 6.0 and typescript-eslint 8

- **Used for:** Strict typing across the monorepo, ESLint flat config, and the compiler API in the copy lint script.
- **What worked well:** The compiler API makes it easy to pull user facing strings and JSX text out of source files.
- **What needs work:** typescript-eslint does not support TypeScript 7 yet, so `latest` cannot be used (FRICTION_LOG.md #3).
- **Onboarding:** Smooth once the version was pinned.
- **Would I build with it again:** Yes.

---

## MCP TypeScript SDK v2 (`@modelcontextprotocol/server` and `client` 2.2.0)

- **Used for:** The self-hosted MCP server (stateless Streamable HTTP, protocol 2026-07-28 and 2025-11-25 from one endpoint) and the MCP client in the simulated Echo and the contract tests.
- **What worked well:** `createMcpHandler` exposes a web standard `fetch(Request) => Response` face, so it drops into Hono, Lambda or tests with no adapter. `authInfo` passes straight through to the per request server factory, which makes multi tenant servers simple. The official client connected to our server on the first try in an in process test.
- **What needs work:** The docs do not state the release status of v2 (see FRICTION_LOG.md #2). No guidance for serverless runtimes such as AWS Lambda, although the stateless design fits them well. The large generated type bundle is hard to browse; a short API page for `McpServer.registerTool` with zod v4 would help.
- **Onboarding:** Good once past the version question; reading the `.d.mts` types was faster than finding the right docs page.
- **Would I build with it again:** Yes.

---

## MCP Apps extension (`@modelcontextprotocol/ext-apps` 2.0.3)

- **Used for:** Echo Show screen cards. The MCP server registers `ui://guardian/*` views (`text/html;profile=mcp-app`) linked from tools through `_meta.ui.resourceUri`; the simulated Echo is an MCP Apps host using `AppBridge` and `PostMessageTransport`, rendering each view in a sandboxed iframe with an opaque origin.
- **What worked well:** `registerAppTool` and `registerAppResource` make the server side a two line change. `AppBridge` handles the host handshake. The protocol itself (JSON-RPC over postMessage) is small and clear, which let us write the view side by hand.
- **What needs work:** Bundling the `App` class into a view pulls in the whole SDK and zod (our first view was 640 KB; a hand written view client is 4 KB plus the font). A tiny dependency free view runtime would help hosts on constrained devices like an Echo Show. A view that posts `ui/initialize` before the host listens loses it silently; the docs could recommend retrying or say who must be ready first.
- **Onboarding:** Medium. The type definitions are thorough; examples for a non React view are scarce.
- **Would I build with it again:** Yes. It is the right way to give a voice add-on a screen.

---

## Playwright 1.63

- **Used for:** End to end runs of the simulated Echo in a real Chromium (typed input, mocked speech output), including the MCP Apps cards inside sandboxed iframes, and screenshots for design review.
- **What worked well:** `frameLocator` reaches into the sandboxed MCP Apps iframes, which the app's own preview browser blocks. `webServer` builds and starts the app for each run.
- **What needs work:** Clicking an element scrolls its container, which made a full page capture look like a layout bug until measured.
- **Onboarding:** Smooth; browsers install to any folder with `PLAYWRIGHT_BROWSERS_PATH`.
- **Would I build with it again:** Yes.
