/**
 * The simulated Echo Show (user story 6). Speak or type, hear Alexa, read large captions,
 * see MCP Apps cards, watch the light bar, and use the demo phone as the family would.
 */
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import micIcon from "lucide-static/icons/mic.svg?raw";
import repeatIcon from "lucide-static/icons/repeat.svg?raw";
import resetIcon from "lucide-static/icons/rotate-ccw.svg?raw";
import sendIcon from "lucide-static/icons/send.svg?raw";
import {
  converse,
  demoPhone,
  events,
  interim,
  resetDemo,
  startDevice,
  type Card,
  type PhoneMessage,
  type StartResponse,
} from "./api";
import { chime } from "./chime";
import { DemoPhone } from "./DemoPhone";
import { LightBar, type LightState } from "./LightBar";
import { McpAppFrame } from "./mcp-apps-host";
import { listen, voiceInputSupported, type Listening } from "./speech-in";
import { speak, stopSpeaking } from "./speech-out";

/** After Alexa's last answer, news is announced right away for this long (FR-009). */
const CONVERSATION_OPEN_MS = 2 * 60_000;
const NEWS_PROMPT = "What's new?";
const ENDS_CONVERSATION = /^(ok(ay)? )?(thanks|thank you|bye|goodbye|that'?s all)\b/i;

function Icon(props: { svg: string }) {
  // Icons come from lucide-static (ISC): trusted, bundled at build time.
  return <span class="icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: props.svg }} />;
}

export function EchoShow(props: { pollMs: number }) {
  const [device, setDevice] = useState<StartResponse>();
  const [caption, setCaption] = useState("Tell me what happened on the call.");
  const [heard, setHeard] = useState<string>();
  const [cards, setCards] = useState<Card[]>([]);
  const [light, setLight] = useState<LightState>("idle");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [phone, setPhone] = useState<PhoneMessage[]>([]);

  const openUntil = useRef(0);
  const unreadSeen = useRef(0);
  const busyRef = useRef(false);
  const mic = useRef<Listening>();
  const lastInputWasVoice = useRef(false);
  const deviceRef = useRef<StartResponse>();
  deviceRef.current = device;
  /** Resolves once the demo device exists, so words sent in the first second are not lost. */
  const started = useRef<Promise<StartResponse | undefined>>();

  const refreshPhone = useCallback(async () => {
    const current = deviceRef.current;
    if (!current) return;
    try {
      setPhone((await demoPhone(current.deviceId)).messages);
    } catch {
      // the phone is a demo aid; a missed refresh is harmless
    }
  }, []);

  useEffect(() => {
    started.current = startDevice()
      .then((started) => {
        deviceRef.current = started;
        setDevice(started);
        return started;
      })
      .catch(() => {
        setProblem("The demo could not start. Please reload the page.");
        return undefined;
      });
  }, []);

  const send = useCallback(
    async (text: string, options: { quiet?: boolean } = {}) => {
      if (busyRef.current || !text.trim()) return;
      const current = deviceRef.current ?? (await started.current);
      if (!current || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setProblem(undefined);
      stopSpeaking();
      // News Alexa announces on her own was not said by anyone: no "You said" line.
      setHeard(options.quiet ? undefined : text.trim());
      setLight("thinking");
      try {
        const reply = await converse(current.deviceId, text.trim());
        setCaption(reply.say);
        if (reply.cards.length > 0) setCards(reply.cards);
        openUntil.current = ENDS_CONVERSATION.test(text.trim())
          ? 0
          : Date.now() + CONVERSATION_OPEN_MS;
        void refreshPhone();
        setLight("speaking");
        await speak(current.deviceId, reply.say, reply.rate);
        setLight("idle");
        if (reply.expectReply && lastInputWasVoice.current && voiceInputSupported) startListening();
      } catch {
        setProblem("That did not go through. Please try again.");
        setLight("idle");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    // startListening only reads refs, so it does not need to be a dependency.
    [refreshPhone],
  );

  function startListening() {
    const current = deviceRef.current;
    if (!current || mic.current) return;
    stopSpeaking();
    let interimTimer: ReturnType<typeof setTimeout> | undefined;
    mic.current = listen({
      onInterim: (text) => {
        setHeard(text);
        clearTimeout(interimTimer);
        interimTimer = setTimeout(async () => {
          const check = await interim(current.deviceId, text).catch(() => undefined);
          if (check?.interrupt && check.say) {
            mic.current?.stop();
            setCaption(check.say);
            setLight("speaking");
            await speak(current.deviceId, check.say, "normal");
            setLight("idle");
          }
        }, 250);
      },
      onFinal: (text) => {
        lastInputWasVoice.current = true;
        void send(text);
      },
      onEnd: () => {
        clearTimeout(interimTimer);
        mic.current = undefined;
        setListening(false);
        setLight((state) => (state === "listening" ? "idle" : state));
      },
    });
    if (mic.current) {
      setListening(true);
      setLight("listening");
    }
  }

  function toggleTalk() {
    if (mic.current) {
      mic.current.stop();
      return;
    }
    startListening();
  }

  // News from the family: announced at once in an open conversation, otherwise a quiet
  // notification (light bar and chime) until the older adult asks (FR-009).
  useEffect(() => {
    if (!device) return;
    const timer = setInterval(async () => {
      void refreshPhone();
      const status = await events(device.deviceId).catch(() => undefined);
      if (!status) return;
      if (status.unread === 0) {
        unreadSeen.current = 0;
        setLight((state) => (state === "notification" ? "idle" : state));
        return;
      }
      if (busyRef.current || mic.current) return;
      if (Date.now() < openUntil.current) {
        void send(NEWS_PROMPT, { quiet: true });
        return;
      }
      if (status.unread > unreadSeen.current) chime();
      unreadSeen.current = status.unread;
      setLight("notification");
    }, props.pollMs);
    return () => clearInterval(timer);
  }, [device, props.pollMs, refreshPhone, send]);

  async function startOver() {
    if (!device) return;
    stopSpeaking();
    mic.current?.stop();
    await resetDemo(device.deviceId).catch(() => undefined);
    setCards([]);
    setHeard(undefined);
    setCaption("Tell me what happened on the call.");
    setPhone([]);
    setLight("idle");
    openUntil.current = 0;
    unreadSeen.current = 0;
  }

  function submit(event: Event) {
    event.preventDefault();
    lastInputWasVoice.current = false;
    // Read the field itself: a fast Enter can come before the draft state has caught up.
    const field = (event.currentTarget as HTMLFormElement).elements.namedItem("text");
    const text = field instanceof HTMLInputElement ? field.value : draft;
    setDraft("");
    void send(text);
  }

  return (
    <div class="echo-stage">
      <div class="echo-column">
        <figure
          class="echo-device"
          aria-label={`Simulated Echo Show for ${device?.olderAdultFirstName ?? "the family"}`}
        >
          <div class="echo-screen" role="region" aria-label="Echo screen" tabindex={0}>
            <p class="echo-heard" aria-live="off">
              {heard ? `You said: ${heard}` : `Hi ${device?.olderAdultFirstName ?? ""}`}
            </p>
            <p class="echo-caption" data-testid="caption" aria-live="polite">
              {caption}
            </p>
            {device && cards.length > 0 && (
              <div class="echo-cards">
                {cards.map((card) => (
                  <McpAppFrame
                    key={`${card.uri}#${String(card.data.checkId ?? card.tool)}`}
                    deviceId={device.deviceId}
                    card={card}
                  />
                ))}
              </div>
            )}
          </div>
          <LightBar state={light} />
        </figure>

        <div class="echo-controls">
          <button
            type="button"
            class="button echo-talk"
            onClick={toggleTalk}
            disabled={!device || !voiceInputSupported}
            aria-pressed={listening}
          >
            <Icon svg={micIcon} />
            {listening ? "Stop listening" : "Talk"}
          </button>
          <button
            type="button"
            class="button button-secondary"
            onClick={() => void send("Repeat")}
            disabled={!device || busy}
          >
            <Icon svg={repeatIcon} />
            Repeat
          </button>
          <button
            type="button"
            class="button button-secondary"
            onClick={() => void startOver()}
            disabled={!device}
          >
            <Icon svg={resetIcon} />
            Start over
          </button>
        </div>
        {!voiceInputSupported && (
          <p class="echo-hint">Voice input works in Chrome and Edge. You can type instead.</p>
        )}

        <form class="echo-type" onSubmit={submit}>
          <label for="echo-input">Type what you want to say</label>
          <div class="echo-type-row">
            <input
              id="echo-input"
              name="text"
              type="text"
              autocomplete="off"
              value={draft}
              onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
              disabled={!device}
              placeholder="My grandson called and needs bail money"
            />
            <button class="button" type="submit" disabled={!device || busy}>
              <Icon svg={sendIcon} />
              Send
            </button>
          </div>
        </form>
        {problem && (
          <p role="alert" class="echo-problem">
            {problem}
          </p>
        )}
      </div>

      <DemoPhone messages={phone} onAnswered={() => void refreshPhone()} />
    </div>
  );
}
