/**
 * Demo video, step 3: cuts the recordings to the script, lays Ruth's, Alexa's and the
 * narrator's voices where they were spoken, holds a frame under the narration, burns in
 * captions, and writes video-out/scam-guardian-demo.mp4 (1920 x 1080, under 3 minutes).
 * Usage: pnpm --filter @asg/web exec tsx scripts/video/compose.ts   (after voices and record)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { OUT, synthesize, seconds } from "./voices";
import { VOICES } from "./lines";

const CARDS = resolve(import.meta.dirname, "../../../../docs/video");
const SEG = join(OUT, "segments");
const FPS = 30;
const BACKDROP = "0x1f2326";

interface Voice {
  id: string;
  text: string;
  file: string;
  seconds: number;
  speaker: string;
}
const voices: Voice[] = JSON.parse(readFileSync(join(OUT, "voices.json"), "utf8"));
const voiceOf = (id: string) => {
  const v = voices.find((x) => x.id === id);
  if (!v) throw new Error(`no voice ${id}`);
  return v;
};

type RawEvent =
  | { t: number; kind: "ruth"; id: string; text: string }
  | { t: number; kind: "alexa"; text: string }
  | { t: number; kind: "mark"; name: string };
/** A recording and its timeline, in seconds (the recorder writes milliseconds). */
const raw = (name: string) => {
  const recording = JSON.parse(readFileSync(join(OUT, "raw", `${name}.json`), "utf8")) as {
    file: string;
    events: RawEvent[];
  };
  return { ...recording, events: recording.events.map((e) => ({ ...e, t: e.t / 1000 })) };
};

/** Alexa's lines, in the product's voice; a long line may keep only its first sentences. */
const alexaVoices = new Map<string, Voice>();
async function alexaVoice(text: string, sentences?: number): Promise<Voice> {
  const spoken = sentences
    ? (text.match(/[^.!?]+[.!?]+/g) ?? [text]).slice(0, sentences).join("").trim()
    : text;
  const known = alexaVoices.get(spoken);
  if (known) return known;
  const id = `alexa-${alexaVoices.size + 1}`;
  const made = { ...(await synthesize(id, spoken, VOICES.alexa)), speaker: "alexa" };
  alexaVoices.set(spoken, made);
  return made;
}

/** A sound placed on the output timeline, with its caption. */
interface Placed {
  file: string;
  at: number;
  seconds: number;
  caption: string;
}

interface Segment {
  name: string;
  /** Builds the segment file and returns its length and its sounds (times within it). */
  build(file: string): Promise<{ length: number; sounds: Placed[] }>;
}

function ffmpeg(args: string[]) {
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
}

/** Mixes the sounds of one segment into an audio filter graph, starting at input index first. */
function audioGraph(sounds: Placed[], first: number, length: number): string {
  if (sounds.length === 0) {
    return `anullsrc=r=48000:cl=stereo,atrim=0:${length.toFixed(3)}[a]`;
  }
  const parts = sounds.map((s, i) => {
    const ms = Math.round(s.at * 1000);
    return `[${first + i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${s.seconds.toFixed(3)},adelay=${ms}|${ms}[s${i}]`;
  });
  const inputs = sounds.map((_, i) => `[s${i}]`).join("");
  return `${parts.join(";")};${inputs}amix=inputs=${sounds.length}:normalize=0,apad,atrim=0:${length.toFixed(3)}[a]`;
}

function encode(
  file: string,
  videoInputs: string[],
  videoGraph: string,
  sounds: Placed[],
  length: number,
) {
  const soundInputs = sounds.flatMap((s) => ["-i", s.file]);
  const first = videoInputs.filter((x) => x === "-i").length;
  ffmpeg([
    ...videoInputs,
    ...soundInputs,
    "-filter_complex",
    `${videoGraph};${audioGraph(sounds, first, length)}`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-t",
    length.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    file,
  ]);
}

/** A still card, with narration starting at `delay`. */
function card(png: string, length: number, narration?: string, delay = 0.3): Segment {
  return {
    name: png,
    async build(file) {
      const sounds: Placed[] = [];
      if (narration) {
        const v = voiceOf(narration);
        sounds.push({ file: v.file, at: delay, seconds: v.seconds, caption: v.text });
      }
      encode(
        file,
        ["-loop", "1", "-framerate", String(FPS), "-t", length.toFixed(3), "-i", join(CARDS, png)],
        `[0:v]scale=1920:1080,format=yuv420p,setsar=1[v]`,
        sounds,
        length,
      );
      return { length, sounds };
    },
  };
}

interface ClipOptions {
  /** Raw time window to use. */
  from: number;
  to: number;
  /** Raw windows to drop entirely (a beat left out). */
  drop?: [number, number][];
  /** Raw windows always kept (a tap on the demo phone). */
  show?: [number, number][];
  /** Alexa lines cut to their first sentences, by the start of their text. */
  shorten?: { startsWith: string; sentences: number }[];
  /** Seconds of picture kept after the last sound. */
  tail?: number;
  /** Narration over a held last frame. */
  narration?: string;
  phone?: boolean;
}

/** A recorded segment, cut around what is said. */
function clip(name: string, options: ClipOptions): Segment {
  return {
    name,
    async build(file) {
      const recording = raw(name);
      const inWindow = (t: number) =>
        t >= options.from &&
        t <= options.to &&
        !(options.drop ?? []).some(([a, b]) => t >= a && t < b);
      // What is said, on the raw clock.
      const spoken: { start: number; end: number; voice: Voice; caption: string }[] = [];
      for (const event of recording.events) {
        if (!inWindow(event.t)) continue;
        if (event.kind === "ruth") {
          const v = voiceOf(event.id);
          spoken.push({
            start: event.t,
            end: event.t + v.seconds,
            voice: v,
            caption: `Ruth: ${v.text}`,
          });
        } else if (event.kind === "alexa" && !event.text.startsWith("Tell me what happened")) {
          const cut = (options.shorten ?? []).find((s) => event.text.startsWith(s.startsWith));
          const v = await alexaVoice(event.text, cut?.sentences);
          const start = event.t + 0.25;
          spoken.push({ start, end: start + v.seconds, voice: v, caption: `Alexa: ${v.text}` });
        }
      }
      // Keep each line with a little air around it, plus what must be seen; cut the rest.
      const wanted: [number, number][] = [
        ...spoken.map((s): [number, number] => [s.start - 0.35, s.end + 0.45]),
        ...(options.show ?? []),
      ].sort((a, b) => a[0] - b[0]);
      const last = wanted.at(-1);
      if (last && options.tail) last[1] += options.tail;
      const keep: [number, number][] = [];
      for (const [a, b] of wanted) {
        const start = Math.max(a, options.from);
        const end = Math.min(b, options.to);
        if (end <= start) continue;
        const previous = keep.at(-1);
        if (previous && start <= previous[1] + 0.05) previous[1] = Math.max(previous[1], end);
        else keep.push([start, end]);
      }
      const map = (t: number) => {
        let out = 0;
        for (const [a, b] of keep) {
          if (t < a) return undefined;
          if (t <= b) return out + (t - a);
          out += b - a;
        }
        return undefined;
      };
      const body = keep.reduce((sum, [a, b]) => sum + (b - a), 0);
      const sounds: Placed[] = [];
      for (const s of spoken) {
        const at = map(s.start);
        if (at === undefined) continue;
        const range = keep.find(([a, b]) => s.start >= a && s.start <= b);
        const room = range ? range[1] - s.start : s.voice.seconds;
        sounds.push({
          file: s.voice.file,
          at,
          seconds: Math.min(s.voice.seconds, room),
          caption: s.caption,
        });
      }
      let hold = 0;
      if (options.narration) {
        const v = voiceOf(options.narration);
        hold = v.seconds + 0.6;
        sounds.push({ file: v.file, at: body + 0.2, seconds: v.seconds, caption: v.text });
      }
      const length = body + hold;
      const trims = keep
        .map(
          ([a, b], i) =>
            `[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS}[k${i}]`,
        )
        .join(";");
      const joined = `${keep.map((_, i) => `[k${i}]`).join("")}concat=n=${keep.length}:v=1:a=0`;
      const frame = options.phone
        ? `scale=-2:1000:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${BACKDROP}`
        : `scale=1920:1080:flags=lanczos`;
      const held = hold > 0 ? `,tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}` : "";
      encode(
        file,
        ["-i", recording.file],
        `${trims};${joined},${frame},format=yuv420p,setsar=1${held}[v]`,
        sounds,
        length,
      );
      return { length, sounds };
    },
  };
}

const mark = (name: string, label: string) => {
  const e = raw(name).events.find((x) => x.kind === "mark" && x.name === label);
  if (!e) throw new Error(`no mark ${label} in ${name}`);
  return e.t;
};

const segments: Segment[] = [
  card("01-cold-open.png", 3.5),
  clip("check", {
    from: mark("check", "start") - 0.3,
    to: mark("check", "denied"),
    show: [[mark("check", "tap") - 0.2, mark("check", "tap") + 1.6]],
    shorten: [{ startsWith: "Done. I'll tell you when Michael answers", sentences: 2 }],
  }),
  card("02-title.png", 4.6, "n-title"),
  card("03-why.png", 8.6, "n-why"),
  clip("rules", {
    from: mark("rules", "beat-r-pay") - 0.3,
    to: mark("rules", "end"),
    drop: [[mark("rules", "beat-r-call-back"), mark("rules", "beat-r-door")]],
    narration: "n-rules",
  }),
  clip("check", {
    from: mark("check", "denied"),
    to: mark("check", "end"),
    tail: 2,
  }),
  clip("paid", {
    from: mark("paid", "start") - 0.3,
    to: mark("paid", "end"),
    tail: 1,
    narration: "n-paid",
  }),
  clip("family", {
    from: mark("family", "start"),
    to: mark("family", "end"),
    show: [[mark("family", "start"), mark("family", "end")]],
    phone: true,
  }),
  card("04-architecture.png", 14.4, "n-build"),
  card("05-closing.png", 9.2, "n-close"),
];

// The family clip has no speech of its own: the narration goes over it.
const familyNarration = voiceOf("n-family");

mkdirSync(SEG, { recursive: true });
const list: string[] = [];
const captions: { from: number; to: number; text: string }[] = [];
let clock = 0;
for (const [i, segment] of segments.entries()) {
  const file = join(SEG, `${String(i).padStart(2, "0")}.mp4`);
  const built = await segment.build(file);
  let sounds = built.sounds;
  if (segment.name === "family") {
    // Re-encode with the narration laid over the picture.
    const placed = {
      file: familyNarration.file,
      at: 0.3,
      seconds: familyNarration.seconds,
      caption: familyNarration.text,
    };
    const length = Math.max(built.length, placed.at + placed.seconds + 0.4);
    const withVoice = join(SEG, `${String(i).padStart(2, "0")}-voice.mp4`);
    encode(
      withVoice,
      ["-i", file],
      `[0:v]tpad=stop_mode=clone:stop_duration=${Math.max(0, length - built.length).toFixed(3)}[v]`,
      [placed],
      length,
    );
    sounds = [placed];
    list.push(withVoice);
    for (const s of sounds)
      captions.push({ from: clock + s.at, to: clock + s.at + s.seconds, text: s.caption });
    clock += length;
    console.log(`${segment.name.padEnd(22)} ${length.toFixed(1)} s`);
    continue;
  }
  list.push(file);
  for (const s of sounds)
    captions.push({ from: clock + s.at, to: clock + s.at + s.seconds, text: s.caption });
  clock += built.length;
  console.log(`${segment.name.padEnd(22)} ${built.length.toFixed(1)} s`);
}
console.log(`total ${clock.toFixed(1)} s`);

// Captions: one cue per spoken line, split into two line chunks so they stay readable.
const stamp = (t: number) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
const cues: string[] = [];
let n = 0;
for (const c of captions) {
  // Every chunk says who speaks; the narrator has no label.
  const label = c.text.match(/^(Ruth|Alexa): /)?.[0] ?? "";
  const body = c.text.slice(label.length);
  const sentences = body.match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim()) ?? [body];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const lastChunk = chunks.at(-1);
    if (lastChunk && (lastChunk + " " + sentence).length <= 90)
      chunks[chunks.length - 1] = `${lastChunk} ${sentence}`;
    else chunks.push(sentence);
  }
  const total = chunks.reduce((sum, x) => sum + x.length, 0);
  let at = c.from;
  for (const chunk of chunks) {
    const span = ((c.to - c.from) * chunk.length) / total;
    cues.push(`${++n}\n${stamp(at)} --> ${stamp(at + span)}\n${label}${chunk}\n`);
    at += span;
  }
}
writeFileSync(join(OUT, "captions.srt"), cues.join("\n"));
writeFileSync(
  join(OUT, "segments.txt"),
  list.map((f) => `file '${f.replaceAll("\\", "/")}'`).join("\n"),
);

ffmpeg([
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  join(OUT, "segments.txt"),
  "-c",
  "copy",
  join(OUT, "joined.mp4"),
]);
const style =
  "FontName=Arial,FontSize=15,PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=22";
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    "joined.mp4",
    "-vf",
    `subtitles=captions.srt:force_style='${style}'`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    // Speech at the loudness video sites expect.
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    "scam-guardian-demo.mp4",
  ],
  { cwd: OUT, stdio: "inherit" },
);
const final = join(OUT, "scam-guardian-demo.mp4");
console.log(`${final}: ${seconds(final).toFixed(1)} s`);
if (!existsSync(final)) process.exit(1);
