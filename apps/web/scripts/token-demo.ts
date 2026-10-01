/** Prints a 15 minute demo household token for MCP Inspector. Usage: pnpm token:demo [householdId] */
import { mintHouseholdToken } from "../src/auth/household-token";

const secret = process.env.HOUSEHOLD_TOKEN_SECRET;
if (!secret) {
  console.error("Set HOUSEHOLD_TOKEN_SECRET (see .env.example) to the value the MCP server uses.");
  process.exit(1);
}
const householdId = process.argv[2] ?? "hh_local";
console.log(await mintHouseholdToken({ householdId, kind: "demo" }, secret));
