import type { simulateHighlights } from './highlights';

export type HighlightResult = ReturnType<typeof simulateHighlights>;
export const createPlayback = (result: HighlightResult) => {
  let attackIndex = 0;
  let index = 0;
  let remaining = result.attacks[0]?.frames[0]?.duration ?? 0;
  const score = [0, 0];
  const current = () => {
    const attack = result.attacks[attackIndex];
    const frame = attack?.frames[index];
    return frame && attack ? { attack, attackIndex, frame, index } : undefined;
  };
  const advance = (frames: number) => {
    if (!Number.isFinite(frames) || frames < 0) {
      throw new RangeError('Invalid playback duration');
    }
    while (current() && frames >= remaining) {
      frames -= remaining;
      index++;
      if (index >= result.attacks[attackIndex]!.frames.length) {
        attackIndex++;
        index = 0;
      }
      const next = current();
      if (!next) {
        break;
      }
      remaining = next.frame.duration;
      if (next.frame.kind === 'goal') {
        const side = next.attack.direction === 'right' ? 0 : 1;
        score[side] = score[side]! + 1;
      }
    }
    if (current()) {
      remaining -= frames;
    }
  };
  return {
    advance,
    get current() {
      return current();
    },
    get done() {
      return !current();
    },
    get key() {
      return `${attackIndex}:${index}`;
    },
    get score(): readonly number[] {
      return score;
    },
    skipPause: () => {
      if (current()?.frame.kind === 'pause') {
        advance(remaining);
      }
    }
  };
};
export type Playback = ReturnType<typeof createPlayback>;
