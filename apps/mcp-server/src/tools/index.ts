import type { McpServer } from "@modelcontextprotocol/server";
import type { Caller, Deps } from "../deps";
import { registerUiResources } from "../ui/register";
import { registerAssessCall } from "./assess-call";
import { registerCloseCheck } from "./close-check";
import { registerFamilyPassword } from "./family-password";
import { registerGetGuidance } from "./get-guidance";
import { registerGetUpdates } from "./get-updates";
import { registerOutreach } from "./outreach";
import { registerPrepareReport } from "./prepare-report";

/** Every tool of the contract (contracts/mcp-tools.md). */
export function registerTools(server: McpServer, deps: Deps, caller: Caller): void {
  registerUiResources(server);
  registerAssessCall(server, deps, caller);
  registerOutreach(server, deps, caller);
  registerGetUpdates(server, deps, caller);
  registerFamilyPassword(server, deps, caller);
  registerGetGuidance(server);
  registerPrepareReport(server, deps, caller);
  registerCloseCheck(server, deps, caller);
}
