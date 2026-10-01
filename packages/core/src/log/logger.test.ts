import { describe, expect, it } from "vitest";
import { createLogger, isSafeLogString, UnsafeLogValueError, type LogEvent } from "./logger";

function capture(strict = false) {
  const lines: string[] = [];
  const logger = createLogger({ strict, sink: (line) => lines.push(line) });
  return { logger, lines };
}

describe("isSafeLogString", () => {
  it("accepts ids, enums and routes", () => {
    expect(isSafeLogString("chk_01J9ZK3M8Q4R7T2V6X1Y5Z0A9B")).toBe(true);
    expect(isSafeLogString("chk_01J9Z123456789")).toBe(false);
    expect(isSafeLogString("assess_call")).toBe(true);
    expect(isSafeLogString("/api/converse")).toBe(true);
    expect(isSafeLogString("chk_01J9ZK")).toBe(true);
  });

  it("rejects free text and numbers", () => {
    expect(isSafeLogString("my grandson called")).toBe(false);
    expect(isSafeLogString("4122334455")).toBe(false);
  });
});

describe("createLogger", () => {
  it("writes typed events as JSON lines", () => {
    const { logger, lines } = capture();
    logger.log({ event: "tool_call", tool: "assess_call", ok: true, durationMs: 42 });
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      event: "tool_call",
      tool: "assess_call",
      durationMs: 42,
    });
  });

  it("drops unsafe strings and flags the record", () => {
    const { logger, lines } = capture();
    const event = { event: "error", where: "converse", code: "my card is 4122334455" };
    logger.log(event as LogEvent);
    const record = JSON.parse(lines[0] ?? "");
    expect(record.code).toBe("[dropped]");
    expect(record.dropped).toBe(true);
    expect(lines[0]).not.toContain("4122334455");
  });

  it("drops unsafe strings inside arrays", () => {
    const { logger, lines } = capture();
    logger.log({
      event: "turn",
      mode: "full",
      durationMs: 900,
      fellBack: false,
      guardViolations: ["approval", "he said pay now"],
    });
    expect(JSON.parse(lines[0] ?? "").guardViolations).toEqual(["approval", "[dropped]"]);
  });

  it("throws in strict mode", () => {
    const { logger } = capture(true);
    expect(() =>
      logger.log({ event: "error", where: "x", code: "free text here" } as LogEvent),
    ).toThrow(UnsafeLogValueError);
  });

  it("rejects nested objects", () => {
    const { logger, lines } = capture();
    logger.log({ event: "error", where: "x", code: { text: "secret" } } as unknown as LogEvent);
    expect(lines[0]).not.toContain("secret");
  });
});
