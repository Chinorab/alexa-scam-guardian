/** A soft two note chime for quiet notifications (FR-009), drawn with Web Audio, no asset file. */
let context: AudioContext | undefined;

export function chime() {
  try {
    context ??= new AudioContext();
    const now = context.currentTime;
    [880, 1318.5].forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const start = now + index * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    });
  } catch {
    // Audio may be blocked before the first user gesture; the light bar still shows the news.
  }
}
