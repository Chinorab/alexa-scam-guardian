/**
 * Prints a 15 minute demo household token for MCP Inspector. Usage: pnpm token:demo [householdId]
 * Local: HOUSEHOLD_TOKEN_SECRET. Deployed stack: APP_SECRET, the master secret from Secrets
 * Manager, from which the token secret is derived the same way the functions do.
 */
import { deriveSecret } from "@asg/mcp-server/adapters/cloud-config";
import { mintHouseholdToken } from "../src/auth/household-token";

const secret = process.env.APP_SECRET
  ? deriveSecret(process.env.APP_SECRET, "household-token")
  : process.env.HOUSEHOLD_TOKEN_SECRET;
if (!secret) {
  console.error("Set HOUSEHOLD_TOKEN_SECRET (local) or APP_SECRET (deployed stack).");
  process.exit(1);
}
const householdId = process.argv[2] ?? "hh_local";
console.log(await mintHouseholdToken({ householdId, kind: "demo" }, secret));
