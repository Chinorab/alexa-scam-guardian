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
| Red team utterances, offline (SC-001) | 59 of 59 pass | `tests/redteam/offline.test.ts` |
| WCAG 2.2 AA with axe, light and dark (SC-007) | 0 violations on every page | `tests/e2e/a11y.spec.ts` |
| Family setup on a 390 px screen, scripted (SC-005) | under 5 minutes, guarded | `tests/e2e/family.spec.ts` |
| Contract tests on the DynamoDB store | 175 of 175 pass | `vitest` project `contract-dynamo` |

## Still to measure

- Cloud: answer time per turn in full mode (Bedrock), tool p95 from the MCP server logs.
- SC-002 and SC-009 with people: spoken time, and two first time visitors without instructions.
- SC-005 with a person on a phone.
