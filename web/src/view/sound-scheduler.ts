import { beeperSignal, type SoundEvent } from '../sim/beeper';
import { spectrumClockHz } from '../sim/frame-clock';

type Voice = { stop: () => void };
export type Signal = ReturnType<typeof beeperSignal>;
type Host = {
  now: () => number;
  play: (signal: Signal, when: number, offset: number) => Voice;
};

/** Schedule ahead on the audio clock; redraws never deliver sound events. */
export const createSoundScheduler = (host: Host) => {
  let origin: number | undefined;
  const voices = new Map<
    string,
    { endT: number; event: SoundEvent; voice: Voice | undefined }
  >();
  const reset = () => {
    for (const { voice } of voices.values()) {
      voice?.stop();
    }
    voices.clear();
    origin = undefined;
  };
  return {
    reset,
    sync: (events: readonly SoundEvent[], nowT: number) => {
      origin ??= host.now() - nowT / spectrumClockHz;
      const ids = new Set(events.map(event => event.id));
      for (const [id, previous] of voices) {
        const event = events.find(event => event.id === id);
        if (
          !ids.has(id) ||
          (event &&
            (event.startT !== previous.event.startT ||
              event.phaseT !== previous.event.phaseT ||
              event.hl !== previous.event.hl ||
              event.de !== previous.event.de))
        ) {
          // A finished source may still be draining the browser's audio buffer.
          if (previous.endT > nowT || event) {
            previous.voice?.stop();
          }
          voices.delete(id);
        }
      }
      for (const event of events) {
        if (voices.has(event.id)) {
          continue;
        }
        const signal = beeperSignal(event.hl, event.de, event.phaseT);
        const endT = event.startT + signal.durationT;
        const when = origin + event.startT / spectrumClockHz;
        const offset = Math.max(0, host.now() - when);
        const voice =
          offset < signal.durationT / spectrumClockHz
            ? host.play(signal, Math.max(when, host.now()), offset)
            : undefined;
        voices.set(event.id, { endT, event, voice });
      }
    }
  };
};
