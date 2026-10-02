import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  mintHouseholdToken,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  verifyHouseholdToken,
} from "./household-token";

const SECRET = "test-secret-that-is-long-enough-1234567890";

describe("household tokens", () => {
  it("round trips the household claims", async () => {
    const token = await mintHouseholdToken({ householdId: "hh_1", kind: "demo" }, SECRET);
    await expect(verifyHouseholdToken(token, SECRET)).resolves.toMatchObject({
      householdId: "hh_1",
      kind: "demo",
    });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await mintHouseholdToken({ householdId: "hh_1", kind: "real" }, SECRET);
    await expect(verifyHouseholdToken(token, `${SECRET}x`)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT({ kind: "real" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("hh_1")
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifyHouseholdToken(token, SECRET)).rejects.toThrow();
  });

  it("rejects a token for another audience", async () => {
    const token = await new SignJWT({ kind: "real" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("hh_1")
      .setIssuer(TOKEN_ISSUER)
      .setAudience("someone-else")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifyHouseholdToken(token, SECRET)).rejects.toThrow();
  });

  it("refuses short secrets", async () => {
    await expect(
      mintHouseholdToken({ householdId: "hh_1", kind: "real" }, "short"),
    ).rejects.toThrow(/at least 32/);
  });
});
