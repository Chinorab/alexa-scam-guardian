/**
 * MCP client used by the simulated Alexa+ (constitution Principle VII): the demo path talks
 * to the real MCP server over Streamable HTTP, with a household token, never to a mock.
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { mintHouseholdToken, type HouseholdClaims } from "../auth/household-token";

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  uiResourceUri?: string;
}

export interface ToolCallOutcome {
  isError: boolean;
  text: string;
  structured?: Record<string, unknown>;
  uiResourceUri?: string;
}

export interface UiResource {
  uri: string;
  html: string;
}

export interface McpSession {
  tools: ToolInfo[];
  call(name: string, args: Record<string, unknown>): Promise<ToolCallOutcome>;
  readUiResource(uri: string): Promise<UiResource | undefined>;
  close(): Promise<void>;
}

export interface McpClientOptions {
  url: string;
  tokenSecret: string;
  /** Injected in tests to reach an in process server. */
  fetch?: typeof fetch;
}

function uiUriOf(meta: unknown): string | undefined {
  const ui = (meta as { ui?: { resourceUri?: unknown } } | undefined)?.ui;
  return typeof ui?.resourceUri === "string" ? ui.resourceUri : undefined;
}

/** Opens one MCP session for one household. Sessions are short lived: one per turn. */
export async function openMcpSession(
  household: HouseholdClaims,
  options: McpClientOptions,
): Promise<McpSession> {
  const token = await mintHouseholdToken(household, options.tokenSecret);
  const transport = new StreamableHTTPClientTransport(new URL(options.url), {
    ...(options.fetch ? { fetch: options.fetch } : {}),
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: "scam-guardian-echo", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const toolInfos: ToolInfo[] = tools.map((tool) => {
    const info: ToolInfo = {
      name: tool.name,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    };
    if (tool.description) info.description = tool.description;
    const uri = uiUriOf(tool._meta);
    if (uri) info.uiResourceUri = uri;
    return info;
  });
  const uiByTool = new Map(toolInfos.map((tool) => [tool.name, tool.uiResourceUri]));

  return {
    tools: toolInfos,

    async call(name, args) {
      const result = await client.callTool({ name, arguments: args });
      const content = Array.isArray(result.content) ? result.content : [];
      const text = content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      const outcome: ToolCallOutcome = { isError: result.isError === true, text };
      if (result.structuredContent && typeof result.structuredContent === "object") {
        outcome.structured = result.structuredContent as Record<string, unknown>;
      }
      const uri = uiByTool.get(name);
      if (uri && !outcome.isError) outcome.uiResourceUri = uri;
      return outcome;
    },

    async readUiResource(uri) {
      const { contents } = await client.readResource({ uri });
      const first = contents[0];
      if (!first || !("text" in first) || typeof first.text !== "string") return undefined;
      return { uri, html: first.text };
    },

    close: () => client.close(),
  };
}
