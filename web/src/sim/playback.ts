import type { HighlightFrame, simulateHighlights } from './highlights';
import type { PauseKeyboard } from './pause-keyboard';
import { createTimeline } from './timeline';

export type HighlightResult = ReturnType<typeof simulateHighlights>;
export const createPlayback = (
  result: HighlightResult,
  keyboard?: PauseKeyboard,
  phase = 0,
  observe?: (frame: HighlightFrame, t: number) => void
) => {
  const score = [0, 0];
  const events = result.attacks.flatMap((attack, attackIndex) =>
    attack.frames.map((frame, index) => ({
      ...frame,
      attack,
      attackIndex,
      frame,
      index
    }))
  );
  const timeline = createTimeline(
    events,
    keyboard,
    (event, t) => {
      observe?.(event, t);
      if (event.kind === 'goal') {
        const side = event.attack.direction === 'right' ? 0 : 1;
        score[side] = score[side]! + 1;
      }
    },
    phase
  );
  return {
    advance: timeline.advance,
    advanceT: timeline.advanceT,
    get current() {
      return timeline.current;
    },
    get done() {
      return timeline.done;
    },
    get elapsedT() {
      return timeline.elapsedT;
    },
    get endT() {
      return timeline.endT;
    },
    get key() {
      return String(timeline.index);
    },
    get remainingT() {
      return timeline.remainingT;
    },
    get score(): readonly number[] {
      return score;
    },
    skipPause: timeline.skipPause,
    get sounds() {
      return timeline.sounds;
    }
  };
};
export type Playback = ReturnType<typeof createPlayback>;
