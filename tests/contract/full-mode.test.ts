/**
 * Full mode with a scripted stand in for Bedrock that answers with real Converse tool_use
 * blocks: the agent loop, the MCP tools behind it, and the host's outreach rules
 * (constitution Principle IV): the model never answers for the person.
 */
import type {
  ContentBlock,
  ConverseCommandInput,
  ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import type { ConverseFn } from "../../apps/web/src/agent/bedrock-agent";
import { claimsUnsentMessage } from "../../apps/web/src/agent/turn";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { makeDeps, SESSION } from "./helpers";

type Results = Record<string, unknown>[];
/** One model round: sees the JSON results of the tools it called last round. */
type Round = (results: Results) => ConverseCommandOutput;

const text = (say: string): ConverseCommandOutput =>
  ({
    output: { message: { role: "assistant", content: [{ text: say }] } },
    stopReason: "end_turn",
    $metadata: {},
  }) as ConverseCommandOutput;

let useCounter = 0;
const tools = (...calls: [string, Record<string, unknown>][]): ConverseCommandOutput =>
  ({
    output: {
      message: {
        role: "assistant",
        content: calls.map(([name, input]) => ({
          toolUse: { toolUseId: `use-${++useCounter}`, name, input },
        })),
      },
    },
    stopReason: "tool_use",
    $metadata: {},
  }) as ConverseCommandOutput;

function lastResults(input: ConverseCommandInput): Results {
  const last = input.messages?.at(-1);
  return (last?.content ?? []).flatMap((block: ContentBlock) =>
    block.toolResult
      ? (block.toolResult.content ?? []).flatMap((c) =>
          "json" in c && c.json ? [c.json as Record<string, unknown>] : [],
        )
      : [],
  );
}

function scripted(rounds: Round[]) {
  const seen: ConverseCommandInput[] = [];
  const converse: ConverseFn = async (input) => {
    seen.push(input);
    const round = rounds.shift();
    if (!round) throw new Error("The script ran out of rounds");
    return round(lastResults(input));
  };
  return { converse, seen };
}

function setUp(converse: ConverseFn) {
  const { deps } = makeDeps();
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps,
    sessions: new MemoryDeviceSessions(),
    agent: { mode: "full", modelId: "test-model", converse, deadlineMs: 5000 },
    mcpUrl: "http://web.test/mcp",
    mcpFetch,
    mountMcp: true,
    session: SESSION,
  });
  let deviceId = "";
  const post = (path: string, body: unknown) =>
    app.request(`http://web.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    async start() {
      const started = (await (await post("/api/device/start", {})).json()) as { deviceId: string };
      deviceId = started.deviceId;
    },
    async say(text: string) {
      const response = await post("/api/converse", { deviceId, text });
      expect(response.status).toBe(200);
      return (await response.json()) as { say: string; mode: string; cards: { tool: string }[] };
    },
    async sent() {
      const response = await app.request(`http://web.test/api/device/${deviceId}/demo-phone`);
      return ((await response.json()) as { messages: { to: string }[] }).messages.map((m) => m.to);
    },
  };
}

const OPENING = "My grandson just called. He's in jail and needs gift cards for bail.";
const QUESTION = "Should I text Michael to check?";

/** Turn one as a well behaved model plays it: assess, prepare, ask. */
function turnOne(ids: { checkId?: string; pendingId?: string }): Round[] {
  return [
    () => tools(["assess_call", { description: OPENING }]),
    ([assessed]) => {
      ids.checkId = String(assessed?.checkId);
      const michael = (assessed?.familyMatches as { memberId: string; name: string }[]).find(
        (m) => m.name === "Michael",
      );
      return tools([
        "prepare_outreach",
        { checkId: ids.checkId, verifyMemberId: michael?.memberId },
      ]);
    },
    ([prepared]) => {
      ids.pendingId = String(prepared?.pendingId);
      return text(`The rush and the gift cards are common signs of a scam. ${QUESTION}`);
    },
  ];
}

describe("full mode with tool use", () => {
  it("assesses, asks, and sends only after the person's yes in the next turn", async () => {
    const ids: { checkId?: string; pendingId?: string } = {};
    const { converse, seen } = scripted([
      ...turnOne(ids),
      () => tools(["confirm_outreach", { pendingId: ids.pendingId, userReply: "yes" }]),
      ([confirmed]) => {
        expect(confirmed?.sent).toEqual(expect.arrayContaining([expect.anything()]));
        return text("Done. I'll tell you when Michael answers.");
      },
    ]);
    const s = setUp(converse);
    await s.start();

    const first = await s.say(OPENING);
    expect(first.mode).toBe("full");
    expect(first.say).toContain(QUESTION);
    expect(first.cards.map((c) => c.tool)).toContain("assess_call");
    expect(await s.sent()).toEqual([]);

    const second = await s.say("Yes, please.");
    expect(second.say).toBe("Done. I'll tell you when Michael answers.");
    expect(await s.sent()).toEqual(["Michael"]);
    // The model was offered the MCP tools as Bedrock tools.
    const offered = seen[0]?.toolConfig?.tools?.map((t) => t.toolSpec?.name) ?? [];
    expect(offered).toEqual(expect.arrayContaining(["assess_call", "confirm_outreach"]));
  });

  it("does not let the model confirm in the same turn it prepared the question", async () => {
    const ids: { checkId?: string; pendingId?: string } = {};
    const rounds = turnOne(ids);
    const { converse } = scripted([
      rounds[0]!,
      rounds[1]!,
      ([prepared]) => {
        ids.pendingId = String(prepared?.pendingId);
        return tools(["confirm_outreach", { pendingId: ids.pendingId, userReply: "yes" }]);
      },
      () => text(`The emergency story is a common sign of a scam. ${QUESTION}`),
    ]);
    const s = setUp(converse);
    await s.start();
    const reply = await s.say(OPENING);
    expect(reply.say).toContain(QUESTION);
    expect(await s.sent()).toEqual([]);
  });

  it("passes the person's own words, so a model's made up yes sends nothing", async () => {
    const ids: { checkId?: string; pendingId?: string } = {};
    const { converse } = scripted([
      ...turnOne(ids),
      () => tools(["confirm_outreach", { pendingId: ids.pendingId, userReply: "yes, send it" }]),
      ([confirmed]) => {
        expect(confirmed?.nothingSent).toBe(true);
        return text("Okay, I won't send anything.");
      },
    ]);
    const s = setUp(converse);
    await s.start();
    await s.say(OPENING);
    await s.say("No, don't text him.");
    expect(await s.sent()).toEqual([]);
  });
});

describe("what the model says about messages", () => {
  it("never says a message went out when no tool sent one", async () => {
    const { converse } = scripted([
      () => tools(["assess_call", { description: OPENING }]),
      () => text("Done. I texted Michael and he will call you."),
    ]);
    const s = setUp(converse);
    await s.start();
    const reply = await s.say(OPENING);
    expect(reply.say).toBe("Let's not send any money for now.");
    expect(await s.sent()).toEqual([]);
  });

  it("recognizes claims of sending, and only those", () => {
    const sent = [
      {
        name: "confirm_outreach",
        outcome: { isError: false, text: "", structured: { sent: ["m"] } },
      },
    ];
    expect(claimsUnsentMessage("Done. I'll tell you when Michael answers.", [])).toBe(true);
    expect(claimsUnsentMessage("I've let Sarah know.", [])).toBe(true);
    expect(claimsUnsentMessage("I sent Michael a text.", [])).toBe(true);
    expect(claimsUnsentMessage("Done. I'll tell you when Michael answers.", sent)).toBe(false);
    expect(claimsUnsentMessage("Should I text Michael to check?", [])).toBe(false);
    expect(claimsUnsentMessage("As I said, please don't send money.", [])).toBe(false);
  });
});

describe("danger in the full mode", () => {
  it("answers 911 with the fixed rules and never asks the model", async () => {
    let asked = 0;
    const s = setUp(async () => {
      asked++;
      return text("Okay, tell me more.");
    });
    await s.start();
    const reply = await s.say("There's a man at my door, he says he's here for the money.");
    expect(reply.say).toMatch(/911/);
    expect(asked).toBe(0);
  });
});
