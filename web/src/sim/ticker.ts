import type { Moment } from './moments';
import type { PauseKeyboard } from './pause-keyboard';
import { createTimeline } from './timeline';

/** How long each moment shows before the next: 1.5 s at 50 frames a second. */
export const tickerPause = 75;
/**
 * The frame before the first pause in which the screen clears. The Enter
 * that kicked off is scanned there, then the clear forgets it, as CLS
 * does, so it can't end the first pause.
 */
export const tickerLeadIn = 1;

/**
 * The ticker (#108): a match's moments shown one at a time in minute order,
 * each held for a PAUSE that a keypress ends early, as the original's PAUSE
 * does. The first pause shows the empty 0-0 header; after the last moment a
 * final hold keeps the full list on screen before the result. Skipping ends
 * every moment's pause at once but keeps the final hold.
 */
export const createTicker = (
  result: { moments: readonly Moment[] },
  home: boolean,
  keyboard?: PauseKeyboard
) => {
  const { moments } = result;
  const finalHold = moments.length + 2;
  const events = [
    { duration: tickerLeadIn, kind: 'clear', shown: 0 },
    ...Array.from({ length: moments.length + 2 }, (_, i) => ({
      clearKey: i === 0,
      duration: tickerPause,
      kind: 'pause',
      shown: Math.min(i, moments.length)
    }))
  ];
  let shown = 0;
  const timeline = createTimeline(events, keyboard, event => {
    shown = event.shown;
  });
  const goals = (side: Moment['side']) =>
    moments.slice(0, shown).filter(m => m.kind === 'goal' && m.side === side)
      .length;
  return {
    advance: timeline.advance,
    advanceT: timeline.advanceT,
    advanceWithinT: timeline.advanceWithinT,
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
    get index() {
      return timeline.index;
    },
    get key() {
      return String(timeline.index);
    },
    get remainingT() {
      return timeline.remainingT;
    },
    /** The score so far, home first. */
    get score(): readonly number[] {
      const club = goals('club');
      const opponent = goals('opponent');
      return home ? [club, opponent] : [opponent, club];
    },
    /** The moments shown so far, in minute order. */
    get shown(): readonly Moment[] {
      return moments.slice(0, shown);
    },
    /**
     * Ends every moment's pause, or the final hold once it is reached. Like
     * a keypress, it does nothing outside a pause.
     */
    skipPause: () => {
      while (timeline.current?.kind === 'pause') {
        const atHold = timeline.index === finalHold;
        timeline.skipPause();
        if (atHold || timeline.index === finalHold) {
          return;
        }
      }
    },
    get sounds() {
      return timeline.sounds;
    }
  };
};
export type Ticker = ReturnType<typeof createTicker>;
