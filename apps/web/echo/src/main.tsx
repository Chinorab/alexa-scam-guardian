import "./echo.css";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { converse, startDevice, type StartResponse } from "./api";

interface Line {
  who: "you" | "alexa";
  text: string;
}

/** Minimal Echo: typed input and large captions. The Echo Show frame comes in US6. */
function Echo() {
  const [device, setDevice] = useState<StartResponse>();
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    startDevice()
      .then(setDevice)
      .catch(() => setProblem("The demo could not start. Please reload the page."));
  }, []);

  async function send(event: Event) {
    event.preventDefault();
    const text = draft.trim();
    if (!device || !text || busy) return;
    setBusy(true);
    setProblem(undefined);
    setLines((current) => [...current, { who: "you", text }]);
    setDraft("");
    try {
      const reply = await converse(device.deviceId, text);
      setLines((current) => [...current, { who: "alexa", text: reply.say }]);
    } catch {
      setProblem("That did not go through. Please try again.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  const last = [...lines].reverse().find((line) => line.who === "alexa");

  return (
    <section class="echo-min" aria-label="Simulated Echo">
      <p class="echo-caption" aria-live="polite">
        {last ? last.text : "Tell me what happened on the call."}
      </p>
      <form onSubmit={send} class="echo-form">
        <label for="echo-input">What happened?</label>
        <textarea
          id="echo-input"
          ref={input}
          rows={3}
          value={draft}
          onInput={(event) => setDraft((event.target as HTMLTextAreaElement).value)}
          disabled={!device}
        />
        <button class="button" type="submit" disabled={!device || busy || !draft.trim()}>
          {busy ? "Listening" : "Tell Alexa"}
        </button>
      </form>
      {problem && (
        <p role="alert" class="echo-problem">
          {problem}
        </p>
      )}
      <ol class="echo-log" aria-label="Conversation">
        {lines.map((line) => (
          <li class={`echo-line echo-line-${line.who}`}>
            <strong>{line.who === "you" ? "You" : "Alexa"}</strong> {line.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

const root = document.getElementById("echo-root");
if (root) render(<Echo />, root);
