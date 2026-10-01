/**
 * The on screen demo phone (FR-014, FR-032): what the family receives, with the one tap
 * answers a relative would use. Links are shown as buttons; nothing leaves this page.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { answerOnPhone, type PhoneMessage } from "./api";

function bodyWithoutLinks(body: string): string[] {
  return body
    .split("\n")
    .filter((line) => !/^https?:\/\//.test(line.trim()))
    .map((line) =>
      line
        .replace(/https?:\/\/\S+/g, "")
        .replace(/:\s*$/, ".")
        .trim(),
    )
    .filter((line) => line.length > 0 && !/^To stop all messages/.test(line));
}

// The sample family lives in the United States; show their time, as the messages do.
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

export function DemoPhone(props: { messages: PhoneMessage[]; onAnswered(): void }) {
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const screen = useRef<HTMLDivElement>(null);
  const newest = props.messages[0]?.id;

  // Newest first, like a phone: keep the latest message in view when one arrives.
  useEffect(() => {
    if (screen.current) screen.current.scrollTop = 0;
  }, [newest]);

  async function answer(message: PhoneMessage, value: "it_was_me" | "it_wasnt_me") {
    if (!message.replyPath) return;
    setAnswered((current) => ({ ...current, [message.id]: value }));
    await answerOnPhone(message.replyPath, value);
    props.onAnswered();
  }

  return (
    <section class="demo-phone" aria-label="Demo phone">
      <header class="demo-phone-header">
        <h2>Demo phone</h2>
        <p>What the sample family receives.</p>
      </header>
      <div class="demo-phone-screen" ref={screen}>
        {props.messages.length === 0 ? (
          <p class="demo-phone-empty">No messages yet.</p>
        ) : (
          props.messages.map((message) => (
            <article class="phone-message" key={message.id}>
              <p class="phone-message-meta">
                To {message.to}, {message.kind === "text" ? "text message" : "email"},{" "}
                {timeOf(message.at)}
              </p>
              {message.subject && <p class="phone-message-subject">{message.subject}</p>}
              {bodyWithoutLinks(message.body).map((line) => (
                <p>{line}</p>
              ))}
              {message.replyPath &&
                (answered[message.id] ? (
                  <p class="phone-message-answered">
                    Answered: {answered[message.id] === "it_was_me" ? "It was me" : "It wasn't me"}
                  </p>
                ) : (
                  <div class="phone-message-actions">
                    <button
                      class="button"
                      type="button"
                      onClick={() => void answer(message, "it_was_me")}
                    >
                      It was me
                    </button>
                    <button
                      class="button button-warning"
                      type="button"
                      onClick={() => void answer(message, "it_wasnt_me")}
                    >
                      It wasn't me
                    </button>
                  </div>
                ))}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
