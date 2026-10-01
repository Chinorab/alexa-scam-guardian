/** Client side calls to the web app (contracts/web-api.md). */
export interface StartResponse {
  deviceId: string;
  householdKind: "real" | "demo";
  olderAdultFirstName: string;
}

export interface Card {
  tool: string;
  uri: string;
  data: Record<string, unknown>;
}

export interface ConverseResponse {
  say: string;
  rate: "normal" | "slow";
  mode: "full" | "simplified";
  cards: Card[];
  expectReply: boolean;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return (await response.json()) as T;
}

export const startDevice = () => post<StartResponse>("/api/device/start", {});

export const converse = (deviceId: string, text: string) =>
  post<ConverseResponse>("/api/converse", { deviceId, text });
