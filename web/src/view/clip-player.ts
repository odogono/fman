import { spectrumFrameT } from '../sim/frame-clock';
import type { MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import { tickerPause, type Ticker } from '../sim/ticker';
import { clipScriptsFor, goneOff, stillFrameFor } from './clip-match';
import {
  clipStage,
  shotAt,
  type ClipPicture,
  type ClipShot,
  type ClipStage
} from './clip-wipe';
import { wipeFrames } from './clips';
import type { ClipProgress } from './modern-highlights';

export type { ClipShot } from './clip-wipe';

/**
 * Where Modern mode's sprite highlights (#144) have got: the frame on show,
 * the stage of the ticker it stands for, how far the clips have got (which
 * the ticker alone can't tell, since a clip shows its moment partway
 * through), and the score after the moments shown.
 */
export type ClipState = Readonly<{
  /**
   * The clip on show, as fractions of its length: how far it has got and
   * where its moment falls, for the progress bar under the pitch.
   */
  bar?: Readonly<{ at: number; moment: number }>;
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
  state
    ? [
        state.phase,
        state.progress.shown,
        state.progress.heard,
        state.progress.full,
        state.progress.paused,
        state.progress.playing ?? ''
      ].join(':')
    : '';

/** Rewound within this many frames of a clip's start, about 2 s, it goes back a clip. */
export const rewindGrace = 100;

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

/** A place in a match's stages: kick-off, each clip, then full time. */
type Place = Readonly<{ at: number; index: number }>;

/** Whether `a` comes at or after `b`. */
const reached = (a: Place, b: Place) =>
  a.index > b.index || (a.index === b.index && a.at >= b.at);

/**
 * Modern mode's clip player: the view's whole knowledge of a match's clips.
 * It works out every clip once from the match's moments, says what lengths
 * to hand the sim at kick-off (ADR 0013), and, from the ticker, what shows.
 * Which ticker Skip was pressed on, whether the moments drawer (#145) is
 * open and the playhead (ADR 0016) are the view's alone: none is saved, so
 * a resumed match starts with all three cleared, playing.
 */
export const createClipPlayer = () => {
  let plan:
    | {
        lengths: Ticker['lengths'];
        moments: readonly Moment[];
        scripts: ReturnType<typeof clipScriptsFor>;
        stages: ClipStage[];
      }
    | undefined;
  let skipped: Ticker | undefined;
  let drawer: Ticker | undefined;
  /**
   * The playhead, while it is held: paused, or behind where the match has
   * got while a clip is watched again. The match waits for it; without it,
   * the playhead is where the ticker is.
   */
  let held: (Place & { paused: boolean; ticker: Ticker }) | undefined;
  /** The most moments heard so far, so watching again says none twice. */
  let heard: { count: number; ticker: Ticker } | undefined;
  /**
   * The shot shown last, the stage it showed, and when the ticker's event
   * then on show was due to end, in T-states.
   */
  let last:
    { end: number; index: number; shot: ClipShot; ticker: Ticker } | undefined;
  /**
   * A stage reached by a jump rather than at the end of the one before: it
   * wipes in from the picture left (`from`), or, if that was mid-wipe
   * already, cuts straight to it.
   */
  let entry: { from?: ClipPicture; index: number; ticker: Ticker } | undefined;
  const planFor = ({ fixture, game, ticker }: TickerView) => {
    // The clips are made once per match; their stages again once the sim
    // holds their lengths.
    const same = plan?.moments === ticker.moments;
    if (!plan || !same || plan.lengths !== ticker.lengths) {
      const scripts =
        (same && plan?.scripts) ||
        clipScriptsFor(game, fixture, ticker.moments);
      const still = (caption: string, off?: ReadonlySet<number>): ClipStage => {
        const picture = stillFrameFor(game, fixture, caption, off);
        return { length: tickerPause, picture: () => picture };
      };
      plan = {
        lengths: ticker.lengths,
        moments: ticker.moments,
        scripts,
        stages: [
          still('Kick-off'),
          ...scripts.map((script, i) => clipStage(script, ticker.lengths?.[i])),
          // Full time, without anyone who went off injured.
          still('Full time', goneOff(ticker.moments))
        ]
      };
    }
    return plan;
  };
  /** Where the ticker has got, as a stage and a frame into it. */
  const liveOf = (ticker: Ticker, stages: readonly ClipStage[]): Place => {
    const stage = ticker.stage;
    const index =
      stage.kind === 'moment'
        ? stage.index + 1
        : stage.kind === 'kick-off'
          ? 0
          : stages.length - 1;
    return {
      at: Math.min(
        ticker.pauseElapsedT / spectrumFrameT,
        stages[index]!.length - 1
      ),
      index
    };
  };
  /** The picture left on show, to wipe from, unless it was mid-wipe. */
  const enter = (ticker: Ticker, index: number) => {
    entry = {
      index,
      ticker,
      ...(!last || last.shot.wipe
        ? {}
        : { from: { frame: last.shot.frame, sides: last.shot.sides } })
    };
  };
  /** The shot at frame `at` of stage `index`, wiping in if it was jumped to. */
  const framed = (
    ticker: Ticker,
    stages: readonly ClipStage[],
    index: number,
    at: number
  ): ClipShot => {
    if (ticker.done && !held) {
      return stages[index]!.picture(at);
    }
    if (entry?.ticker === ticker && entry.index === index) {
      const picture = stages[index]!.picture(at);
      if (entry.from && at < wipeFrames) {
        return {
          ...picture,
          wipe: { from: entry.from, progress: at / wipeFrames }
        };
      }
      // It wipes out to the next stage as usual, but not in again.
      const played = shotAt(stages, index, at);
      return played.wipe?.from ? picture : played;
    }
    return shotAt(stages, index, at);
  };
  /**
   * The shot at frame `at` of stage `index`, where the ticker is. Played
   * through, each stage wipes into the next across their ends; reached
   * early, by a tap or Skip, one wipes in from where the last left off.
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
      if (played) {
        entry = undefined;
      } else {
        enter(ticker, index);
      }
    }
    const shot = framed(ticker, stages, index, at);
    last = {
      end: start + (ticker.current?.duration ?? 0) * spectrumFrameT,
      index,
      shot,
      ticker
    };
    return shot;
  };
  /** The shot at a held playhead, which moves by the view's own clock. */
  const heldShot = (
    ticker: Ticker,
    stages: readonly ClipStage[],
    place: Place
  ): ClipShot => {
    const shot = framed(ticker, stages, place.index, place.at);
    // Caught up, the ticker's shot follows on from it with no wipe.
    last = {
      end: ticker.elapsedT - ticker.pauseElapsedT,
      index: place.index,
      shot,
      ticker
    };
    return shot;
  };
  /** The moments shown at `place`: each clip's once it reaches its moment. */
  const shownAt = (
    ticker: Ticker,
    scripts: ReturnType<typeof clipScriptsFor>,
    stages: readonly ClipStage[],
    place: Place
  ) => {
    if (place.index === 0) {
      return 0;
    }
    if (place.index === stages.length - 1) {
      return ticker.moments.length;
    }
    const moment = place.index - 1;
    return moment + (place.at >= scripts[moment]!.momentFrame ? 1 : 0);
  };
  const stateOf = (view: TickerView): ClipState => {
    const { ticker } = view;
    const { scripts, stages } = planFor(view);
    const live = liveOf(ticker, stages);
    const hold = held?.ticker === ticker ? held : undefined;
    const place = hold ?? live;
    const shot = hold
      ? heldShot(ticker, stages, place)
      : shotFor(ticker, stages, place.index, place.at);
    // Screen readers hear each moment once, as the match reaches it.
    const reachedNow = shownAt(ticker, scripts, stages, live);
    if (heard?.ticker !== ticker || heard.count < reachedNow) {
      heard = {
        count: Math.max(reachedNow, heard?.ticker === ticker ? heard.count : 0),
        ticker
      };
    }
    const full = place.index === stages.length - 1 && skipped === ticker;
    const shown = shownAt(ticker, scripts, stages, place);
    const playing =
      place.index > 0 && place.index < stages.length - 1
        ? place.index - 1
        : undefined;
    const progress: ClipProgress = {
      drawer: !full && shown > 0 && drawer === ticker,
      full,
      heard: full ? ticker.moments.length : heard.count,
      paused: hold?.paused ?? false,
      ...(playing === undefined ? {} : { playing }),
      shown
    };
    const phase =
      playing !== undefined
        ? 'clip'
        : place.index === 0
          ? 'kick-off'
          : 'full-time';
    const script = playing === undefined ? undefined : scripts[playing];
    const length = stages[place.index]!.length;
    return {
      ...(script
        ? {
            bar: {
              at: Math.min(1, place.at / length),
              moment: Math.min(1, script.momentFrame / length)
            }
          }
        : {}),
      phase,
      progress,
      score: ticker.scoreAfter(shown),
      shot
    };
  };
  const state = (view: View) => {
    const shown = tickerView(view);
    return shown?.ticker.lengths ? stateOf(shown) : undefined;
  };
  /** The match on show, with clips, unless Skip has ended them. */
  const clipped = (view: View) => {
    const shown = tickerView(view);
    if (!shown?.ticker.lengths || skipped === shown.ticker) {
      return undefined;
    }
    const { stages } = planFor(shown);
    const live = liveOf(shown.ticker, stages);
    const hold = held?.ticker === shown.ticker ? held : undefined;
    return { hold, live, stages, ticker: shown.ticker };
  };
  /** Lets the held playhead go once it has caught up with the match. */
  const settle = (live: Place) => {
    if (held && !held.paused && reached(held, live)) {
      held = undefined;
    }
  };
  return {
    /**
     * Moves a held playhead on by `frames`, unless it is paused. Returns
     * whether it is still held, so the match should still wait.
     */
    advance: (view: View, frames: number) => {
      const now = clipped(view);
      if (!now?.hold) {
        held = undefined;
        return false;
      }
      const { hold, live, stages } = now;
      if (!hold.paused) {
        let { at, index } = hold;
        at += frames;
        while (index < live.index && at >= stages[index]!.length) {
          at -= stages[index]!.length;
          index++;
        }
        held = { ...hold, at, index };
        settle(live);
      }
      return held !== undefined;
    },
    /** Whether the playhead is held, so the match waits for it. */
    holding: (view: View) => clipped(view)?.hold !== undefined,
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
    /**
     * Next: a clip watched again gives way to the one after it, and the
     * match picks up where it had got once that is the clip it is on.
     * Returns whether the clip the match is on should end, as a tap ends
     * it; it plays on from there.
     */
    next: (view: View) => {
      const now = clipped(view);
      if (!now || (now.hold ?? now.live).index === now.stages.length - 1) {
        return false;
      }
      const { hold, live, ticker } = now;
      if (hold && hold.index + 1 < live.index) {
        enter(ticker, hold.index + 1);
        held = { at: 0, index: hold.index + 1, paused: false, ticker };
        return false;
      }
      held = undefined;
      return !hold || hold.index === live.index;
    },
    /** Pauses or plays the clips; while paused, the match waits. */
    playPause: (view: View) => {
      const now = clipped(view);
      if (!now || (now.hold ?? now.live).index === now.stages.length - 1) {
        return;
      }
      const { hold, live, ticker } = now;
      held = hold
        ? { ...hold, paused: !hold.paused }
        : { ...live, paused: true, ticker };
      settle(live);
    },
    /**
     * Rewind: back to the start of the clip on show, or, within its first
     * two seconds or from full time, to the clip before. The kick-off still
     * is as far back as it goes.
     */
    rewind: (view: View) => {
      const now = clipped(view);
      if (!now) {
        return;
      }
      const { hold, live, stages, ticker } = now;
      const place = hold ?? live;
      const back =
        place.index === stages.length - 1 ||
        (place.at < rewindGrace && place.index > 1);
      const index = Math.max(0, back ? place.index - 1 : place.index);
      enter(ticker, index);
      held = { at: 0, index, paused: hold?.paused ?? false, ticker };
    },
    /** Lets the playhead go, so the match carries on from where it had got. */
    release: () => {
      held = undefined;
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
      held = undefined;
    },
    /** Where the clips have got, if the match on show plays as clips. */
    state
  };
};
export type ClipPlayer = ReturnType<typeof createClipPlayer>;
