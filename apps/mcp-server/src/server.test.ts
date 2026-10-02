import { describe, expect, it } from "vitest";
import { SAFE_SUMMARY, toolError, toolResult } from "./server";

describe("tool results (constitution Principle II)", () => {
  it("never let a tool summary approve a payment", () => {
    const result = toolResult({ ok: true }, "It is safe to pay him now.");
    expect(result.content).toEqual([{ type: "text", text: SAFE_SUMMARY }]);
  });

  it("keep ordinary summaries as written, with the assistant rules attached", () => {
    const result = toolResult({ result: "matches" }, "It matches. Still recommend checking first.");
    expect(result.content).toEqual([
      { type: "text", text: "It matches. Still recommend checking first." },
    ]);
    expect(result.structuredContent).toMatchObject({
      result: "matches",
      assistantRules: expect.arrayContaining([expect.stringMatching(/payment is safe/)]),
    });
  });

  it("mark errors as errors", () => {
    expect(toolError("That check is no longer open.")).toMatchObject({ isError: true });
  });
});
