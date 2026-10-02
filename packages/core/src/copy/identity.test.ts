import { describe, expect, it } from "vitest";
import { claimedIdentityWords } from "./identity";

describe("claimedIdentityWords", () => {
  it("gives a relative the older adult's name", () => {
    expect(claimedIdentityWords("grandson", "Ruth")).toBe("Ruth's grandson");
  });

  it("keeps an organization as it is", () => {
    expect(claimedIdentityWords("the IRS", "Ruth")).toBe("the IRS");
    expect(claimedIdentityWords("a bank", "Ruth")).toBe("a bank");
  });
});
