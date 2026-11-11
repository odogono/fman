import { beepRegisters, beeperT, type Tone } from './beeper';
import { spectrumFrameT } from './frame-clock';
import { createPauseKeyboard, type PauseKeyboard } from './pause-keyboard';

type Event = {
  clearKey?: boolean;
  duration: number;
  interrupts?: boolean;
  kind?: string;
  tones?: readonly Tone[];
};

/** Integer T-state playback. Only serviced interrupts scan the keyboard. */
export const createTimeline = <T extends Event>(
  events: readonly T[],
  keyboard?: PauseKeyboard,
  entered?: (event: T, t: number) => void,
  phase = 0
) => {
  let index = 0;
  let elapsedT = phase;
  let enteredT = phase;
  let completedT = events.length === 0 ? phase : undefined;
  let remaining = Math.round((events[0]?.duration ?? 0) * spectrumFrameT);
  const current = () => events[index];
  const enter = () => {
    const event = current();
    if (event) {
      enteredT = elapsedT;
      const tone = event.tones?.[0];
      const registers = tone
        ? beepRegisters(tone.duration, tone.pitch)
        : undefined;
      remaining =
        registers && event.interrupts === false
          ? beeperT(registers.hl, registers.de, elapsedT)
          : Math.round(event.duration * spectrumFrameT);
      if (event.clearKey) {
        keyboard?.clear();
      }
      entered?.(event, elapsedT);
    }
  };
  const next = () => {
    if (current()?.kind === 'pause') {
      keyboard?.clear();
    }
    index++;
    if (index === events.length) {
      completedT = elapsedT;
    }
    enter();
  };
  enter();
  /**
   * Plays up to `tstates`, stopping when the last event ends. Interrupts
   * that can change nothing (BEEPER spans, or an idle keyboard outside a
   * pending PAUSE exit) are crossed in one step rather than one by one.
   */
  const play = (tstates: number) => {
    if (!Number.isSafeInteger(tstates) || tstates < 0) {
      throw new RangeError('Invalid playback duration');
    }
    let left = tstates;
    let missed = 0;
    while (current()) {
      if (remaining === 0) {
        next();
        continue;
      }
      if (left === 0) {
        break;
      }
      const frame = current()!;
      const pauseExit = frame.kind === 'pause' && keyboard?.pending;
      if (
        !pauseExit &&
        (frame.interrupts === false || !keyboard || keyboard.idle)
      ) {
        const amount = Math.min(left, remaining);
        if (frame.interrupts === false) {
          missed +=
            Math.floor((elapsedT + amount) / spectrumFrameT) -
            Math.floor(elapsedT / spectrumFrameT);
        }
        elapsedT += amount;
        remaining -= amount;
        left -= amount;
        if (remaining === 0) {
          next();
        }
        continue;
      }
      const toInterrupt = spectrumFrameT - (elapsedT % spectrumFrameT);
      const amount = Math.min(left, remaining, toInterrupt);
      elapsedT += amount;
      remaining -= amount;
      left -= amount;
      if (amount === toInterrupt) {
        if (frame.interrupts === false) {
          missed++;
        } else {
          keyboard?.scan();
        }
        if (frame.kind === 'pause' && keyboard?.pending) {
          next();
          continue;
        }
      }
      if (remaining === 0) {
        next();
      }
    }
    return { missed, usedT: tstates - left };
  };
  /** Plays up to `tstates`; time past the end idles the keyboard. */
  const advanceT = (tstates: number) => {
    const { missed, usedT } = play(tstates);
    const left = tstates - usedT;
    if (left > 0) {
      keyboard?.advance(
        Math.floor((elapsedT + left) / spectrumFrameT) -
          Math.floor(elapsedT / spectrumFrameT)
      );
      elapsedT += left;
    }
    return missed;
  };
  /** Copy the keyboard so scheduled sounds include any predictable early PAUSE exit. */
  const forecast = (): {
    endT: number;
    sounds: { de: number; hl: number; index: number; t: number }[];
  } => {
    const sounds: { de: number; hl: number; index: number; t: number }[] = (
      current()?.tones ?? []
    ).map(tone => ({
      ...beepRegisters(tone.duration, tone.pitch),
      index,
      t: enteredT
    }));
    const future = events.slice(index).map((event, i) =>
      i === 0
        ? {
            ...event,
            clearKey: false,
            duration: remaining / spectrumFrameT,
            tones: []
          }
        : event
    );
    let i = index;
    const copy = createTimeline(
      future,
      keyboard ? createPauseKeyboard(keyboard.state) : undefined,
      (event, t) => {
        for (const tone of event.tones ?? []) {
          sounds.push({
            ...beepRegisters(tone.duration, tone.pitch),
            index: i,
            t
          });
        }
        i++;
      },
      elapsedT
    );
    // One frame per remaining event bounds the contention-driven BEEPER
    // variation for every reachable game tone; surplus time affects only the copy.
    copy.advanceT(
      future.reduce(
        (sum, e) => sum + Math.round(e.duration * spectrumFrameT),
        spectrumFrameT * future.length
      )
    );
    return { endT: copy.endT, sounds };
  };
  return {
    advance: (frames: number) => advanceT(frames * spectrumFrameT),
    advanceT,
    /** Plays up to `tstates` but no further than the end, returning the time used. */
    advanceWithinT: play,
    get current() {
      return current();
    },
    get done() {
      return !current();
    },
    get elapsedT() {
      return elapsedT;
    },
    get endT() {
      return completedT ?? forecast().endT;
    },
    get index() {
      return index;
    },
    get remainingT() {
      return Math.max(0, forecast().endT - elapsedT);
    },
    skipPause: () => {
      if (current()?.kind === 'pause') {
        next();
        advanceT(0);
      }
    },
    get sounds() {
      return forecast().sounds;
    }
  };
};
