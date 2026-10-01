/**
 * Full mode: Amazon Bedrock Converse with the MCP server's tools (research R4).
 * The model plans and phrases; the MCP tools hold every safety rule; the output guard
 * checks every line afterwards (turn.ts).
 */
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime";
import type { McpSession, ToolCallOutcome } from "./mcp-client";

export type ConverseFn = (
  input: ConverseCommandInput,
  signal: AbortSignal,
) => Promise<ConverseCommandOutput>;

export function bedrockConverse(region: string): ConverseFn {
  const client = new BedrockRuntimeClient({ region });
  return (input, signal) => client.send(new ConverseCommand(input), { abortSignal: signal });
}

export interface AgentTurnInput {
  modelId: string;
  system: string;
  /** Earlier messages of this conversation, already redacted. */
  history: Message[];
  userText: string;
  session: McpSession;
  converse: ConverseFn;
  signal: AbortSignal;
  maxToolRounds?: number;
}

export interface AgentTurnResult {
  say: string;
  toolCalls: { name: string; outcome: ToolCallOutcome }[];
  /** Messages to append to the history (user turn, tool exchanges, final answer). */
  newMessages: Message[];
}

function toolSpecs(session: McpSession): Tool[] {
  return session.tools.map((tool) => ({
    toolSpec: {
      name: tool.name,
      description: tool.description ?? tool.name,
      inputSchema: { json: tool.inputSchema as never },
    },
  }));
}

const textOf = (content: ContentBlock[] | undefined) =>
  (content ?? [])
    .map((block) => ("text" in block && typeof block.text === "string" ? block.text : ""))
    .join(" ")
    .trim();

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const maxRounds = input.maxToolRounds ?? 3;
  const tools = toolSpecs(input.session);
  const newMessages: Message[] = [{ role: "user", content: [{ text: input.userText }] }];
  const toolCalls: AgentTurnResult["toolCalls"] = [];

  for (let round = 0; round <= maxRounds; round++) {
    const request: ConverseCommandInput = {
      modelId: input.modelId,
      system: [{ text: input.system }],
      messages: [...input.history, ...newMessages],
      inferenceConfig: { maxTokens: 300, temperature: 0.2 },
    };
    if (tools.length > 0) request.toolConfig = { tools };
    const output = await input.converse(request, input.signal);
    const message = output.output?.message;
    if (!message) throw new Error("Bedrock returned no message.");
    newMessages.push(message);

    const uses = (message.content ?? []).flatMap((block) => (block.toolUse ? [block.toolUse] : []));
    if (output.stopReason !== "tool_use" || uses.length === 0) {
      return { say: textOf(message.content), toolCalls, newMessages };
    }
    if (round === maxRounds) break;

    const results: ContentBlock[] = [];
    for (const use of uses) {
      const name = use.name ?? "";
      const args = (use.input ?? {}) as Record<string, unknown>;
      const outcome = await input.session.call(name, args);
      toolCalls.push({ name, outcome });
      results.push({
        toolResult: {
          toolUseId: use.toolUseId,
          status: outcome.isError ? "error" : "success",
          content: outcome.structured
            ? [{ json: outcome.structured as never }]
            : [{ text: outcome.text }],
        },
      });
    }
    newMessages.push({ role: "user", content: results });
  }
  throw new Error("Too many tool rounds in one turn.");
}
