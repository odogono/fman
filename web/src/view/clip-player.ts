import { spectrumFrameT } from '../sim/frame-clock';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import type { Ticker } from '../sim/ticker';
import type { ClipSides } from './clip-canvas';
import { clipScriptsFor, stillFrameFor } from './clip-match';
import type { ClipFrame, ClipScript } from './clips';
import type { ClipProgress } from './modern-highlights';

/** What the clip canvas paints: one frame and the sides it shows. */
export type ClipShot = Readonly<{ frame: ClipFrame; sides: ClipSides }>;

/**
 * Where Modern mode's sprite highlights (#144) have got: the frame on show,
 * the stage of the ticker it stands for, how far the clips have got (which
 * the ticker alone can't tell, since a clip shows its moment partway
 * through), and the score after the moments shown.
 */
export type ClipState = Readonly<{
  /** The still pitch at kick-off and full time; otherwise the clip on show. */
  phase: 'clip' | 'full-time' | 'kick-off';
  progress: ClipProgress;
  score: readonly number[];
  shot: ClipShot;
}>;

/**
 * What the screen shows of the clips, besides the frame: a change means
 * the screen repaints, not just the clip.
 */
export const screenKey = (state: ClipState | undefined) =>
  state ? `${state.progress.shown}:${state.progress.full}` : '';

type TickerView = Extract<View, { screen: 'highlights'; ticker: Ticker }>;

const tickerView = (view: View): TickerView | undefined =>
  view.screen === 'highlights' && 'ticker' in view ? view : undefined;

/**
 * Modern mode's clip player: the view's whole knowledge of a match's clips.
 * It works out every clip once from the match's moments, says what lengths
 * to hand the sim at kick-off (ADR 0013), and, from the ticker, what shows.
 * Which ticker Skip was pressed on and whether the moments drawer (#145) is
 * open are the view's alone: neither is saved, so a resumed match starts
 * with both cleared.
 */
export const createClipPlayer = () => {
  let plan: { moments: readonly Moment[]; scripts: ClipScript[] } | undefined;
  let skipped: Ticker | undefined;
  let drawer: Ticker | undefined;
  const scriptsFor = ({ fixture, game, ticker }: TickerView) => {
    if (plan?.moments !== ticker.moments) {
      plan = {
        moments: ticker.moments,
        scripts: clipScriptsFor(game, fixture, ticker.moments)
      };
    }
    return plan.scripts;
  };
  const progressOf = (ticker: Ticker, shown: number, full: boolean) => ({
    drawer: !full && shown > 0 && drawer === ticker,
    full,
    shown
  });
  const stateOf = (view: TickerView): ClipState => {
    const { ticker } = view;
    const stage = ticker.stage;
    if (stage.kind !== 'moment') {
      const end = stage.kind === 'full-time';
      const still = stillFrameFor(
        view.game,
        view.fixture,
        end ? 'Full time' : 'Kick-off'
      );
      const shown = end ? ticker.moments.length : 0;
      const full = end && skipped === ticker;
      return {
        phase: stage.kind,
        progress: progressOf(ticker, shown, full),
        score: ticker.scoreAfter(shown),
        shot: still
      };
    }
    const script = scriptsFor(view)[stage.index]!;
    const at = Math.min(
      ticker.pauseElapsedT / spectrumFrameT,
      script.length - 1
    );
    const shown = stage.index + (at >= script.momentFrame ? 1 : 0);
    return {
      phase: 'clip',
      progress: progressOf(ticker, shown, false),
      score: ticker.scoreAfter(shown),
      shot: {
        frame: script.frame(at),
        sides: { attack: script.input.attack, defence: script.input.defence }
      }
    };
  };
  const state = (view: View) => {
    const shown = tickerView(view);
    return shown?.ticker.lengths ? stateOf(shown) : undefined;
  };
  return {
    /**
     * At kick-off, before the ticker plays a frame, every clip's length in
     * frames, one per moment, for the sim to hold. Nothing once the match
     * has started or holds them already.
     */
    kickOff: (view: View): number[] | undefined => {
      const shown = tickerView(view);
      if (!shown || shown.ticker.lengths || shown.ticker.elapsedT > 0) {
        return undefined;
      }
      return scriptsFor(shown).map(script => script.length);
    },
    /** Opens or closes the moments drawer; it lists nothing before the first moment, or after Skip. */
    showDrawer: (view: View, open: boolean) => {
      const now = state(view);
      drawer =
        open && now && now.progress.shown > 0 && !now.progress.full
          ? tickerView(view)!.ticker
          : undefined;
    },
    /** Skip was pressed: the whole ticker shows for its final hold. */
    skip: (view: View) => {
      skipped = tickerView(view)?.ticker;
    },
    /** Where the clips have got, if the match on show plays as clips. */
    state
  };
};
export type ClipPlayer = ReturnType<typeof createClipPlayer>;
