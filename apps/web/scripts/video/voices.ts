/**
 * Demo video, step 1: Ruth's and the narrator's lines as Polly neural audio, with their length,
 * so the recording can wait for Ruth to finish speaking. Writes video-out/voices.json.
 * Usage: pnpm --filter @asg/web exec tsx scripts/video/voices.ts   (AWS credentials)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pollySpeech } from "../../src/routes/tts";
import { NARRATOR, RUTH, VOICES } from "./lines";

export const OUT = resolve(import.meta.dirname, "../../../../video-out");

/** Length of an audio file in seconds, from ffprobe. */
export function seconds(file: string): number {
  const text = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return Number(text.trim());
}

export async function synthesize(id: string, text: string, voice: string) {
  mkdirSync(join(OUT, "audio"), { recursive: true });
  const file = join(OUT, "audio", `${id}.mp3`);
  writeFileSync(file, await pollySpeech("us-east-1", voice)(text, "normal"));
  return { id, text, file, seconds: seconds(file) };
}

if (import.meta.main ?? process.argv[1]?.endsWith("voices.ts")) {
  const voices = [];
  for (const line of [...RUTH, ...NARRATOR]) {
    voices.push({
      ...(await synthesize(line.id, line.text, VOICES[line.speaker])),
      speaker: line.speaker,
    });
  }
  writeFileSync(join(OUT, "voices.json"), JSON.stringify(voices, null, 2));
  for (const v of voices) console.log(`${v.id.padEnd(12)} ${v.seconds.toFixed(2)} s`);
}
