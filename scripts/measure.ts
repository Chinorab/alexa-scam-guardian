/**
 * Times the main scenario against a running web app, local or deployed (T080, T103):
 * SC-002 turns from first sentence to check message sent, SC-004 answer time per turn, and
 * one free question after the check, which the model answers in the full mode.
 * Speech time is not included; the timed runs with a person cover it.
 *
 *   pnpm measure                         # http://localhost:8787, 10 runs
 *   pnpm measure https://xyz.lambda-url.us-east-1.on.aws 20
 */
const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/+$/, "");
const runs = Number(process.argv[3] ?? 10);

const OPENING =
  "My grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.";

async function post<T>(path: string, body: unknown): Promise<{ ms: number; data: T }> {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  const data = (await response.json()) as T;
  return { ms: performance.now() - started, data };
}

type Reply = { say: string; mode: string };

/** A question the rules do not know: in the full mode, the model answers it. */
const FREE_QUESTION = "Why would they want gift cards?";

const turnTimes: number[] = [];
const freeTimes: number[] = [];
const freeModes = new Map<string, number>();
const scenarioTimes: number[] = [];
const modes = new Map<string, number>();
let failures = 0;

for (let run = 0; run < runs; run++) {
  try {
    const started = performance.now();
    const { data: device } = await post<{ deviceId: string }>("/api/device/start", {});
    let turns = 0;
    let sent = false;
    for (const text of [OPENING, "Yes, please."]) {
      const { ms, data } = await post<Reply>("/api/converse", { deviceId: device.deviceId, text });
      turns++;
      turnTimes.push(ms);
      modes.set(data.mode, (modes.get(data.mode) ?? 0) + 1);
      const phone = await fetch(`${base}/api/device/${device.deviceId}/demo-phone`);
      const { messages } = (await phone.json()) as { messages: unknown[] };
      if (messages.length > 0) {
        sent = true;
        break;
      }
    }
    if (!sent) throw new Error("no check message after the scripted turns");
    scenarioTimes.push(performance.now() - started);
    const free = await post<Reply>("/api/converse", {
      deviceId: device.deviceId,
      text: FREE_QUESTION,
    });
    freeTimes.push(free.ms);
    turnTimes.push(free.ms);
    freeModes.set(free.data.mode, (freeModes.get(free.data.mode) ?? 0) + 1);
    if (turns > 3) throw new Error(`took ${turns} turns`);
  } catch (error) {
    failures++;
    console.error(`run ${run + 1}: ${(error as Error).message}`);
  }
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN;
};
const ms = (n: number) => `${Math.round(n)} ms`;

console.log(`Target: ${base}`);
console.log(
  `Runs: ${runs}, failed: ${failures}, modes: ${JSON.stringify(Object.fromEntries(modes))}`,
);
console.log("");
console.log("| Measure | Median | p95 | Max |");
console.log("|---|---|---|---|");
console.log(
  `| Answer time per turn (SC-004, goal under 3 s in 95% of turns) | ${ms(percentile(turnTimes, 50))} | ${ms(percentile(turnTimes, 95))} | ${ms(Math.max(...turnTimes))} |`,
);
console.log(
  `| First sentence to check message sent, server time (SC-002) | ${ms(percentile(scenarioTimes, 50))} | ${ms(percentile(scenarioTimes, 95))} | ${ms(Math.max(...scenarioTimes))} |`,
);
console.log(
  `| Free question after the check, answered by ${JSON.stringify(Object.fromEntries(freeModes))} | ${ms(percentile(freeTimes, 50))} | ${ms(percentile(freeTimes, 95))} | ${ms(Math.max(...freeTimes))} |`,
);
process.exitCode = failures > 0 ? 1 : 0;

export {};
