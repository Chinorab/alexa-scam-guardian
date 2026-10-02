# Measurements

Every number here was measured by a script or a test in this repository, with the date and
the target. Cloud figures are added after the first deploy (docs/deploy.md).

## 2026-10-02, local run (simplified mode, in memory store)

`pnpm measure http://localhost:8787 20` on the build machine (Windows 11, Node 24), web app
with the MCP server mounted at `/mcp`. Server time only: speech is not included.

| Measure | Median | p95 | Max |
|---|---|---|---|
| Answer time per turn (SC-004, goal under 3 s in 95% of turns) | 66 ms | 89 ms | 220 ms |
| First sentence to check message sent, server time (SC-002) | 203 ms | 249 ms | 441 ms |

20 runs, 0 failed. The check message went out after 2 turns in every run (SC-002 allows 3).

## Automated checks

| Check | Result | Where |
|---|---|---|
| WCAG 2.2 AA with axe, light and dark (SC-007) | 0 violations on every page | `tests/e2e/a11y.spec.ts` |
| MCP Apps cards inside their sandboxed frames: warning signs, check status, report (SC-007) | 0 violations once the signs have risen; each view now has a document title | `tests/e2e/a11y.spec.ts` |
| Redaction, generated: 336 sentences of card, Social Security, routing and account numbers, written and spoken (Principle III) | no six digit window survives; early interruption fires | `packages/core/src/redact/redact.generated.test.ts` |
| Reply and stop pages a relative opens, 390 px, light and dark (SC-007) | 0 violations | `tests/e2e/a11y.spec.ts` |
| Malformed input: 120 MCP tool calls, 20 web requests | no exception, no server error, nothing sent | `tests/contract/mcp-fuzz.test.ts`, `web-fuzz.test.ts` |
| Household isolation: another household's token, forged cookies | nothing read, nothing sent, sign in required | `tests/contract/isolation.test.ts` |
| Multi turn red team (Principles I, II, IV) | 14 of 14 attacks mid check handled | `tests/redteam/multiturn.test.ts` |
| Dependency audit | no known vulnerabilities (weekly in CI) | `.github/workflows/sources.yml` |
| 200% zoom and reflow, 640 px and 320 px wide (SC-007) | no sideways scrolling on any page, Echo after a turn included | `tests/e2e/a11y.spec.ts` |
| At most three sentences and one question per spoken turn (SC-003) | every turn of every scripted dialogue passes the output guard, which checks both | `tests/contract/dialogue-us2.test.ts` |
| Red team phrases, offline (SC-001), updated | 75 of 75 pass | `tests/redteam/offline.test.ts` |
| Family setup on a 390 px screen, scripted (SC-005) | under 5 minutes, guarded | `tests/e2e/family.spec.ts` |
| Contract tests on the DynamoDB store | 175 of 175 pass | `vitest` project `contract-dynamo` |

## 2026-10-02, cloud rehearsal (real Lambda bundles, emulated AWS)

`pnpm rehearse --keep`, then `E2E_BASE_URL=http://localhost:8892 pnpm test:e2e`, twice:
17 passed, 11 skipped (family page scenarios need on screen sign in links, local only), 0
failed. The bundles read the secret and the web URL once per cold start and used GetItem,
PutItem, Query and UpdateItem on the table. It found two real problems, both fixed: the 20
per hour demo start limit would have blocked a judging team behind one address, and the
Echo's text field stayed disabled until the device started, so early typing was lost.

Later the same day, with the public demo family (FR-026): 22 passed, 7 skipped, 0 failed
against the Lambda bundles; the family page accessibility checks now run there too. After the
probes and fuzzing: 24 passed, 7 skipped, 0 failed.

## Still to measure

- Cloud: answer time per turn in full mode (Bedrock), tool p95 from the MCP server logs.
- SC-002 and SC-009 with people: spoken time, and two first time visitors without instructions.
- SC-005 with a person on a phone.
