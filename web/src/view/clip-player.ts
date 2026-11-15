import { spectrumFrameT } from '../sim/frame-clock';
import type { MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import { tickerPause, type Ticker } from '../sim/ticker';
import { clipScriptsFor, stillFrameFor } from './clip-match';
import {
  clipStage,
  shotAt,
  wipeFrames,
  type ClipPicture,
  type ClipShot,
  type ClipStage
} from './clip-wipe';
import type { ClipProgress } from './modern-highlights';

export type { ClipShot } from './clip-wipe';

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

type TickerView = Readonly<{
  fixture: MatchFixture;
  game: Game;
  ticker: Ticker;
}>;

/** The match on show and its ticker, if moments decide it. */
const tickerView = (view: View): TickerView | undefined =>
  view.screen === 'highlights' && view.highlights.kind === 'moments'
    ? {
        fixture: view.fixture,
        game: view.game,
        ticker: view.highlights.timeline
      }
    : undefined;

/**
 * Modern mode's clip player: the view's whole knowledge of a match's clips.
 * It works out every clip once from the match's moments, says what lengths
 * to hand the sim at kick-off (ADR 0013), and, from the ticker, what shows.
 * Which ticker Skip was pressed on and whether the moments drawer (#145) is
 * open are the view's alone: neither is saved, so a resumed match starts
 * with both cleared.
 */
export const createClipPlayer = () => {
  let plan:
    | {
        moments: readonly Moment[];
        scripts: ReturnType<typeof clipScriptsFor>;
        stages: ClipStage[];
      }
    | undefined;
  let skipped: Ticker | undefined;
  let drawer: Ticker | undefined;
  /**
   * The shot shown last, the stage it showed, and when the ticker's event
   * then on show was due to end, in T-states.
   */
  let last:
    { end: number; index: number; shot: ClipShot; ticker: Ticker } | undefined;
  /**
   * A stage reached by a tap or Skip rather than at the end of the one
   * before: it wipes in from the picture left (`from`), or, if that was
   * mid-wipe already, cuts straight to it.
   */
  let entry: { from?: ClipPicture; index: number; ticker: Ticker } | undefined;
  const planFor = ({ fixture, game, ticker }: TickerView) => {
    if (plan?.moments !== ticker.moments) {
      const scripts = clipScriptsFor(game, fixture, ticker.moments);
      const still = (caption: string): ClipStage => {
        const picture = stillFrameFor(game, fixture, caption);
        return { length: tickerPause, picture: () => picture };
      };
      plan = {
        moments: ticker.moments,
        scripts,
        stages: [
          still('Kick-off'),
          ...scripts.map(clipStage),
          still('Full time')
        ]
      };
    }
    return plan;
  };
  /**
   * The shot at frame `at` of stage `index`. Played through, each stage
   * wipes into the next across their ends; reached early, by a tap or
   * Skip, one wipes in from where the last left off.
   */
  const shotFor = (
    ticker: Ticker,
    stages: readonly ClipStage[],
    index: number,
    at: number
  ): ClipShot => {
    // When the ticker's event on show began: a stage played through begins
    // as the one before was due to end, one tapped or skipped to earlier.
    const start = ticker.elapsedT - ticker.pauseElapsedT;
    if (last?.ticker === ticker && last.index !== index) {
      const played =
        index === last.index + 1 &&
        Math.abs(start - last.end) < spectrumFrameT / 2;
      entry = played
        ? undefined
        : {
            index,
            ticker,
            ...(last.shot.wipe
              ? {}
              : { from: { frame: last.shot.frame, sides: last.shot.sides } })
          };
    }
    let shot: ClipShot;
    if (ticker.done) {
      shot = stages[index]!.picture(at);
    } else if (entry?.ticker === ticker && entry.index === index) {
      const picture = stages[index]!.picture(at);
      if (entry.from && at < wipeFrames) {
        shot = {
          ...picture,
          wipe: { from: entry.from, progress: at / wipeFrames }
        };
      } else {
        // It wipes out to the next stage as usual, but not in again.
        const played = shotAt(stages, index, at);
        shot = played.wipe?.from ? picture : played;
      }
    } else {
      shot = shotAt(stages, index, at);
    }
    last = {
      end: start + (ticker.current?.duration ?? 0) * spectrumFrameT,
      index,
      shot,
      ticker
    };
    return shot;
  };
  const progressOf = (ticker: Ticker, shown: number, full: boolean) => ({
    drawer: !full && shown > 0 && drawer === ticker,
    full,
    shown
  });
  const stateOf = (view: TickerView): ClipState => {
    const { ticker } = view;
    const stage = ticker.stage;
    const { scripts, stages } = planFor(view);
    const index =
      stage.kind === 'moment'
        ? stage.index + 1
        : stage.kind === 'kick-off'
          ? 0
          : stages.length - 1;
    const at = Math.min(
      ticker.pauseElapsedT / spectrumFrameT,
      stages[index]!.length - 1
    );
    const shot = shotFor(ticker, stages, index, at);
    if (stage.kind !== 'moment') {
      const end = stage.kind === 'full-time';
      const shown = end ? ticker.moments.length : 0;
      const full = end && skipped === ticker;
      return {
        phase: stage.kind,
        progress: progressOf(ticker, shown, full),
        score: ticker.scoreAfter(shown),
        shot
      };
    }
    const script = scripts[stage.index]!;
    const shown = stage.index + (at >= script.momentFrame ? 1 : 0);
    return {
      phase: 'clip',
      progress: progressOf(ticker, shown, false),
      score: ticker.scoreAfter(shown),
      shot
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
      return planFor(shown).scripts.map(script => script.length);
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
