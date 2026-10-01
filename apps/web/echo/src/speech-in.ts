/**
 * Speech input with the browser's speech recognition (research R7). Interim text goes to
 * /api/interim so a sensitive number is stopped mid sentence (FR-017). Typed input is the
 * fallback everywhere.
 */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

const RecognitionClass =
  (window as unknown as Record<string, unknown>).SpeechRecognition ??
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

export const voiceInputSupported = typeof RecognitionClass === "function";

export interface Listening {
  stop(): void;
}

export function listen(handlers: {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onEnd(): void;
}): Listening | undefined {
  if (!voiceInputSupported) return undefined;
  const recognition = new (RecognitionClass as new () => Recognition)();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  let finalText = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) finalText += transcript;
      else interim += transcript;
    }
    handlers.onInterim(`${finalText} ${interim}`.trim());
  };
  recognition.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd();
  };
  recognition.onerror = () => handlers.onEnd();
  recognition.start();
  return {
    stop: () => {
      finalText = "";
      recognition.abort();
    },
  };
}
