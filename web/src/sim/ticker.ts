import type { Moment } from './moments';
import type { PauseKeyboard } from './pause-keyboard';
import { createTimeline } from './timeline';

/** How long each moment shows before the next: 1.5 s at 50 frames a second. */
export const tickerPause = 75;
/** The longest clip the sim accepts: a minute at 50 frames a second. */
export const longestClip = 3000;

/**
 * Whether `lengths` can stand in for the pauses of `count` moments: one
 * whole, positive length in frames each, none longer than `longestClip`.
 */
export const validClipLengths = (
  lengths: readonly unknown[],
  count: number
): lengths is readonly number[] =>
  lengths.length === count &&
  lengths.every(
    length =>
      Number.isInteger(length) &&
      (length as number) > 0 &&
      (length as number) <= longestClip
  );
/**
 * The frame before the first pause in which the screen clears. The Enter
 * that kicked off is scanned there, then the clear forgets it, as CLS
 * does, so it can't end the first pause.
 */
export const tickerLeadIn = 1;

/** Where a ticker has got among its moments; see `stage`. */
export type TickerStage =
  | Readonly<{ kind: 'full-time' }>
  | Readonly<{ kind: 'kick-off' }>
  | Readonly<{ index: number; kind: 'moment' }>;

/**
 * The ticker (#108): a match's moments shown one at a time in minute order,
 * each held for a PAUSE that a keypress ends early, as the original's PAUSE
 * does. The first pause shows the empty 0-0 header; after the last moment a
 * final hold keeps the full list on screen before the result. Skipping ends
 * every moment's pause at once but keeps the final hold.
 *
 * Under sprite highlights (#111) each moment plays as a clip whose length
 * only the view knows (ADR 0013): `lengths`, one per moment in frames, then
 * replace the pauses that show each moment. The 0-0 header and the final
 * hold keep `tickerPause`.
 */
export const createTicker = (
  result: { moments: readonly Moment[] },
  home: boolean,
  keyboard?: PauseKeyboard,
  lengths?: readonly number[]
) => {
  const { moments } = result;
  /** The events before the first moment's pause: the clear and the header. */
  const firstMoment = 2;
  const finalHold = moments.length + firstMoment;
  const events = [
    { duration: tickerLeadIn, kind: 'clear', shown: 0 },
    ...Array.from({ length: moments.length + 2 }, (_, i) => ({
      clearKey: i === 0,
      duration: (i >= 1 && lengths?.[i - 1]) || tickerPause,
      kind: 'pause',
      shown: Math.min(i, moments.length)
    }))
  ];
  let shown = 0;
  const timeline = createTimeline(events, keyboard, event => {
    shown = event.shown;
  });
  const scoreAfter = (count: number): readonly number[] => {
    const goals = (side: Moment['side']) =>
      moments.slice(0, count).filter(m => m.kind === 'goal' && m.side === side)
        .length;
    const club = goals('club');
    const opponent = goals('opponent');
    return home ? [club, opponent] : [opponent, club];
  };
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
    /**
     * How long the current pause has shown, so a match resumed mid-clip
     * picks the clip up where it was (ADR 0013); 0 outside a pause.
     */
    get pauseElapsedT() {
      return timeline.current?.kind === 'pause' ? timeline.eventElapsedT : 0;
    },
    /** The clip lengths the view handed over, if any. */
    lengths,
    /**
     * Every moment of the match, in minute order, so the view can work out
     * each clip at kick-off. What shows so far is `shown`.
     */
    moments,
    get remainingT() {
      return timeline.remainingT;
    },
    /** The score so far, home first. */
    get score(): readonly number[] {
      return scoreAfter(shown);
    },
    /**
     * The score after the first `count` moments, home first. A clip shows
     * its moment partway through the pause, so the view can be behind
     * `score`.
     */
    scoreAfter,
    /**
     * Where the ticker has got among its moments: the lead-in and 0-0
     * header (`kick-off`), a moment's pause (`moment`, by index), or the
     * final hold and after (`full-time`).
     */
    get stage(): TickerStage {
      const index = timeline.index - firstMoment;
      if (timeline.done || index >= moments.length) {
        return { kind: 'full-time' };
      }
      return index < 0 ? { kind: 'kick-off' } : { index, kind: 'moment' };
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
