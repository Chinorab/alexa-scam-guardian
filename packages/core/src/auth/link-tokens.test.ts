import { describe, expect, it } from "vitest";
import { hashToken, newReplyToken, readStopToken, stopToken } from "./link-tokens";

const SECRET = "link-token-test-secret-0123456789abcdef";

describe("link tokens", () => {
  it("stores reply tokens only as a hash", () => {
    const { token, hash } = newReplyToken();
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it("round trips a stop token and rejects tampering", () => {
    const token = stopToken("hh_1", "mem_1", SECRET);
    expect(readStopToken(token, SECRET)).toEqual({ householdId: "hh_1", memberId: "mem_1" });
    const forged = stopToken("hh_1", "mem_2", "another-secret-0123456789abcdefghij");
    expect(readStopToken(forged, SECRET)).toBeUndefined();
    expect(readStopToken("garbage", SECRET)).toBeUndefined();
  });
});
