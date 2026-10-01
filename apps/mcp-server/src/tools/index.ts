import type { McpServer } from "@modelcontextprotocol/server";
import type { Caller, Deps } from "../deps";
import { registerUiResources } from "../ui/register";
import { registerAssessCall } from "./assess-call";

/** Each user story phase adds its tools here. */
export function registerTools(server: McpServer, deps: Deps, caller: Caller): void {
  registerUiResources(server);
  registerAssessCall(server, deps, caller);
}
