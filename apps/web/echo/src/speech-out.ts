/**
 * Speech output (research R7): Amazon Polly through /api/tts when configured, the browser's
 * voice otherwise. Resolves when speaking ends, or after a safety timeout.
 */
let current: HTMLAudioElement | undefined;

function browserVoice(text: string, rate: "normal" | "slow"): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  return new Promise((resolve) => {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate === "slow" ? 0.8 : 0.95;
    const voice = synth
      .getVoices()
      .find((v) => v.lang === "en-US" && /female|samantha|aria|jenny/i.test(v.name));
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

export function stopSpeaking() {
  current?.pause();
  current = undefined;
  window.speechSynthesis?.cancel();
}

export async function speak(
  deviceId: string,
  text: string,
  rate: "normal" | "slow",
): Promise<void> {
  stopSpeaking();
  const done = (async () => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId, rate }),
      });
      if (response.ok && response.headers.get("content-type")?.includes("audio")) {
        const url = URL.createObjectURL(await response.blob());
        const audio = new Audio(url);
        current = audio;
        const played = await new Promise<boolean>((resolve) => {
          audio.onended = () => resolve(true);
          audio.onerror = () => resolve(false);
          // Autoplay rules can refuse audio started without a recent tap: try the browser voice.
          audio.play().catch(() => resolve(false));
        });
        URL.revokeObjectURL(url);
        if (played || current !== audio) return;
      }
    } catch {
      // fall through to the browser voice
    }
    await browserVoice(text, rate);
  })();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000 + text.length * 90));
  await Promise.race([done, timeout]);
}
