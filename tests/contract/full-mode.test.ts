/**
 * Full mode with a scripted stand in for Bedrock that answers with real Converse tool_use
 * blocks: the agent loop, the MCP tools behind it, and the host's outreach rules
 * (constitution Principle IV): the model never answers for the person.
 */
import type {
  ContentBlock,
  ConverseCommandInput,
  ConverseCommandOutput,
  Message,
} from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import { textOnly, type ConverseFn } from "../../apps/web/src/agent/bedrock-agent";
import {
  claimsUnsentMessage,
  fitToThree,
  houseStyle,
  trimHistory,
} from "../../apps/web/src/agent/turn";
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
/** New details after the first check: the model answers them, with the tools. */
const DETAIL = "He also said not to tell his parents.";

/**
 * The first description and the answer to its question are the rules' (no model round is
 * used); after a no, new details go to the model.
 */
async function primed(s: ReturnType<typeof setUp>) {
  await s.start();
  const first = await s.say(OPENING);
  expect(first.mode).toBe("simplified");
  expect((await s.say("No")).say).toBe("Okay, I didn't send anything.");
}

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
    await primed(s);
    const first = await s.say(DETAIL);
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
    await primed(s);
    const reply = await s.say(DETAIL);
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
    await primed(s);
    await s.say(DETAIL);
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
    await primed(s);
    const reply = await s.say(DETAIL);
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

describe("who answers in the full mode", () => {
  it("assesses the first description by rules at once, without the model", async () => {
    let asked = 0;
    const s = setUp(async () => {
      asked++;
      return text("Tell me more.");
    });
    await s.start();
    const reply = await s.say(OPENING);
    expect(reply.mode).toBe("simplified");
    expect(reply.say).toContain("Should I text Michael");
    // Its yes goes to the rules too, which hold the pending message.
    expect((await s.say("Yes")).say).toMatch(/^Done. I'll tell you when Michael answers./);
    expect(await s.sent()).toEqual(expect.arrayContaining(["Michael"]));
    expect(asked).toBe(0);
  });

  it("answers a free question during the rules' question with no tools, then asks it again", async () => {
    const { converse, seen } = scripted([
      () => text("Scammers want gift cards because the money is gone once the codes are shared."),
    ]);
    const s = setUp(converse);
    await s.start();
    const first = await s.say(OPENING);
    const question = first.say.slice(first.say.indexOf("Should I"));
    const reply = await s.say("Why would they want gift cards?");
    expect(reply.mode).toBe("full");
    expect(reply.say).toBe(
      `Scammers want gift cards because the money is gone once the codes are shared. ${question}`,
    );
    expect(seen[0]?.toolConfig).toBeUndefined();
    expect(await s.sent()).toEqual([]);
    // The answer to the question is still the rules', with their pending message.
    expect((await s.say("Yes")).say).toMatch(/^Done./);
    expect(await s.sent()).toEqual(expect.arrayContaining(["Michael"]));
  });

  it("a blocked answer during the rules' question still asks the question again", async () => {
    const { converse } = scripted([() => text("It's safe to pay him.")]);
    const s = setUp(converse);
    await s.start();
    const first = await s.say(OPENING);
    const question = first.say.slice(first.say.indexOf("Should I"));
    const reply = await s.say("Is it really him?");
    expect(reply.say).toBe(`Let's not send any money for now. ${question}`);
  });

  it("the model reads the lines the rules said", async () => {
    const { converse, seen } = scripted([() => text("He asked for secrecy, a common trick.")]);
    const s = setUp(converse);
    await primed(s);
    await s.say(DETAIL);
    const history = (seen[0]?.messages ?? []).map((m) => m.content?.[0]?.text ?? "");
    expect(history[0]).toBe(OPENING);
    expect(history[1]).toContain("Should I text Michael");
    expect(history[2]).toBe("No");
    expect(history[3]).toBe("Okay, I didn't send anything.");
  });
});

describe("model output and history helpers", () => {
  it("keeps three sentences, the closing question last", () => {
    expect(fitToThree("One. Two. Three. Four?")).toBe("One. Two. Four?");
    expect(fitToThree("One. Two. Three. Four.")).toBe("One. Two. Three.");
    expect(fitToThree("One. Two?")).toBe("One. Two?");
  });

  it("turns dashes and line breaks into the house style", () => {
    expect(houseStyle("Gift cards are like cash—the money is gone.\n\nShould I?")).toBe(
      "Gift cards are like cash, the money is gone. Should I?",
    );
  });

  it("keeps only text, joined by speaker, starting with the user", () => {
    const messages: Message[] = [
      { role: "assistant", content: [{ text: "Earlier." }] },
      { role: "user", content: [{ text: "Hi" }] },
      {
        role: "assistant",
        content: [{ toolUse: { toolUseId: "u1", name: "assess_call", input: {} } }],
      },
      {
        role: "user",
        content: [{ toolResult: { toolUseId: "u1", content: [{ text: "ok" }] } }],
      },
      { role: "assistant", content: [{ text: "Signs." }] },
    ];
    expect(textOnly(messages)).toEqual([
      { role: "user", content: [{ text: "Hi" }] },
      { role: "assistant", content: [{ text: "Signs." }] },
    ]);
  });

  it("never cuts the history between a tool use and its result", () => {
    const messages: Message[] = [
      { role: "user", content: [{ text: "A" }] },
      {
        role: "assistant",
        content: [{ toolUse: { toolUseId: "u1", name: "get_updates", input: {} } }],
      },
      {
        role: "user",
        content: [{ toolResult: { toolUseId: "u1", content: [{ text: "ok" }] } }],
      },
      { role: "assistant", content: [{ text: "No news." }] },
      { role: "user", content: [{ text: "B" }] },
      { role: "assistant", content: [{ text: "Okay." }] },
    ];
    expect(trimHistory(messages, 4)).toEqual(messages.slice(4));
  });
});
