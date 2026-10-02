import { describe, expect, it } from "vitest";
import { hashFamilyPassword, matchesFamilyPassword, normalizePhrase } from "./family-password";

describe("family password", () => {
  it("normalizes spoken variations", () => {
    expect(normalizePhrase("  Blue, RIVER! ")).toBe("blue river");
  });

  it("matches only the right phrase, whatever the case and punctuation", async () => {
    const stored = await hashFamilyPassword("Blue River");
    await expect(matchesFamilyPassword("blue river", stored)).resolves.toBe(true);
    await expect(matchesFamilyPassword("Blue river.", stored)).resolves.toBe(true);
    await expect(matchesFamilyPassword("green lake", stored)).resolves.toBe(false);
  });

  it("never stores the phrase itself", async () => {
    const stored = await hashFamilyPassword("blue river");
    expect(JSON.stringify(stored)).not.toMatch(/blue|river/i);
  });

  it("uses a different salt every time", async () => {
    const a = await hashFamilyPassword("blue river");
    const b = await hashFamilyPassword("blue river");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("refuses phrases that are too short", async () => {
    await expect(hashFamilyPassword("a")).rejects.toThrow(/at least 3/);
  });
});
