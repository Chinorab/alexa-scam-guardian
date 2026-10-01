import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { VIEWS, type ViewKey } from "./views";

export const WARNING_SIGNS_URI = "ui://guardian/warning-signs";
export const CHECK_STATUS_URI = "ui://guardian/check-status";
export const REPORT_URI = "ui://guardian/report";

const REGISTERED: { name: string; uri: string; view: ViewKey }[] = [
  { name: "Warning signs", uri: WARNING_SIGNS_URI, view: "warningSigns" },
  { name: "Check status", uri: CHECK_STATUS_URI, view: "checkStatus" },
  { name: "Report summary", uri: REPORT_URI, view: "report" },
];

/** Registers the MCP Apps views (text/html;profile=mcp-app) shown on Echo Show screens. */
export function registerUiResources(server: McpServer) {
  for (const { name, uri, view } of REGISTERED) {
    registerAppResource(server, name, uri, { description: `${name} screen card` }, async () => ({
      contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: VIEWS[view]() }],
    }));
  }
}
