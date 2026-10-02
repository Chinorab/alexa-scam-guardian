/**
 * Speech for the simulated Echo (research R7). Speaks only the device's own last line, never
 * arbitrary text, so the endpoint cannot be used to make the voice say something else.
 */
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { Hono } from "hono";
import { z } from "zod";
import type { DeviceSessions } from "../device/sessions";

export type SpeechSynth = (text: string, rate: "normal" | "slow") => Promise<Uint8Array>;

/** Amazon Polly, neural engine. Slow rate wraps the line in SSML prosody. */
export function pollySpeech(region: string, voiceId: string): SpeechSynth {
  const client = new PollyClient({ region });
  return async (text, rate) => {
    const escaped = text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const output = await client.send(
      new SynthesizeSpeechCommand({
        Engine: "neural",
        VoiceId: voiceId as never,
        OutputFormat: "mp3",
        TextType: "ssml",
        Text: `<speak><prosody rate="${rate === "slow" ? "85%" : "100%"}">${escaped}</prosody></speak>`,
      }),
    );
    if (!output.AudioStream) throw new Error("Polly returned no audio");
    return output.AudioStream.transformToByteArray();
  };
}

const body = z.object({ deviceId: z.string().min(1).max(64), rate: z.enum(["normal", "slow"]) });

export function ttsRoutes(sessions: DeviceSessions, speech?: SpeechSynth) {
  const app = new Hono();
  app.post("/tts", async (c) => {
    const parsed = body.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    const device = await sessions.get(parsed.data.deviceId);
    const line = device?.engine.lastSay;
    if (!line) return c.json({ error: "nothing_to_say" }, 404);
    if (!speech) return c.json({ fallback: "browser" }, 501);
    try {
      const audio = await speech(line, parsed.data.rate);
      return c.body(audio as unknown as ArrayBuffer, 200, {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      });
    } catch {
      return c.json({ fallback: "browser" }, 502);
    }
  });
  return app;
}
