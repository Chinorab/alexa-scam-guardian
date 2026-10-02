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

export interface PhoneMessage {
  id: string;
  kind: "email" | "text";
  to: string;
  subject?: string;
  body: string;
  at: string;
  replyPath?: string;
  /** False when the relative is asked about someone else: the answers are "It's true" or not. */
  aboutThemselves?: boolean;
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

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return (await response.json()) as T;
}

const DEVICE_KEY = "scam-guardian-device";

/** Starts the Echo, keeping this tab's demo family across reloads when it still exists. */
export async function startDevice(): Promise<StartResponse> {
  let saved: string | null = null;
  try {
    saved = sessionStorage.getItem(DEVICE_KEY);
  } catch {
    // storage can be blocked; a new demo family is fine
  }
  const started = await post<StartResponse>("/api/device/start", saved ? { deviceId: saved } : {});
  try {
    sessionStorage.setItem(DEVICE_KEY, started.deviceId);
  } catch {
    // see above
  }
  return started;
}

export const converse = (deviceId: string, text: string) =>
  post<ConverseResponse>("/api/converse", { deviceId, text });

export const interim = (deviceId: string, partialText: string) =>
  post<{ interrupt: boolean; say?: string }>("/api/interim", { deviceId, partialText });

export const events = (deviceId: string) =>
  get<{ unread: number; light: string }>(`/api/device/${encodeURIComponent(deviceId)}/events`);

export const demoPhone = (deviceId: string) =>
  get<{ messages: PhoneMessage[] }>(`/api/device/${encodeURIComponent(deviceId)}/demo-phone`);

export const resetDemo = (deviceId: string) =>
  post<{ ok: boolean; olderAdultFirstName: string }>("/api/demo/reset", { deviceId });

/** The relative's one tap answer, as the reply page form would send it. */
export async function answerOnPhone(replyPath: string, answer: "it_was_me" | "it_wasnt_me") {
  await fetch(replyPath, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `answer=${answer}`,
  });
}
