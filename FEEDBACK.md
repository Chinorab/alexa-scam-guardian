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
