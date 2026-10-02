/** The light bar along the bottom of the Echo Show screen. */
export type LightState = "idle" | "listening" | "thinking" | "speaking" | "notification";

const LABELS: Record<LightState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  notification: "You have news. Say what's new.",
};

export function LightBar(props: { state: LightState }) {
  return (
    <div class="light-bar" data-testid="light-bar" data-state={props.state} role="status">
      <span class="visually-hidden">{LABELS[props.state]}</span>
    </div>
  );
}
