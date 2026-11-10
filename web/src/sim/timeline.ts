import { spectrumFrameT } from './frame-clock';
import type { PauseKeyboard } from './pause-keyboard';

type Event = {
  clearKey?: boolean;
  duration: number;
  interrupts?: boolean;
  kind?: string;
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
  let remaining = Math.round((events[0]?.duration ?? 0) * spectrumFrameT);
  const current = () => events[index];
  const enter = () => {
    const event = current();
    if (event) {
      remaining = Math.round(event.duration * spectrumFrameT);
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
    enter();
  };
  enter();
  const advanceT = (tstates: number) => {
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
    if (left > 0) {
      keyboard?.advance(
        Math.floor((elapsedT + left) / spectrumFrameT) -
          Math.floor(elapsedT / spectrumFrameT)
      );
      elapsedT += left;
    }
    return missed;
  };
  return {
    advance: (frames: number) => advanceT(frames * spectrumFrameT),
    advanceT,
    get current() {
      return current();
    },
    get done() {
      return !current();
    },
    get index() {
      return index;
    },
    skipPause: () => {
      if (current()?.kind === 'pause') {
        next();
        advanceT(0);
      }
    }
  };
};
