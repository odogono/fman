import {
  prepareCupMatch,
  prepareReplay,
  refreshPlayers,
  settleCupLeg
} from './cup';
import { simulateHighlights } from './highlights';
import {
  completeLeagueMatch,
  nextFixture,
  prepareLeagueMatch,
  teamStrength,
  togglePickedPlayer,
  type MatchCompletion,
  type MatchFixture
} from './league';
import type { Game } from './management';
import { decideMoments, type MomentResult } from './moments';
import type { PauseKeyboard } from './pause-keyboard';
import {
  createPlayback,
  type HighlightResult,
  type Playback
} from './playback';
import { momentHighlights } from './ruleset';
import { createTicker, validClipLengths, type Ticker } from './ticker';

export type MatchdayStage =
  'fixture' | 'team' | 'highlights' | 'result' | 'replay' | 'settled';
export type MatchSettlement =
  | {
      bills: NonNullable<MatchCompletion['bills']>;
      cupWon: boolean;
      kind: 'cup';
    }
  | { completion: MatchCompletion; kind: 'league' };

/**
 * The inks the two sides wear in the highlights. With a chosen colour, the
 * managed club wears it at home and the opposite colour away. Clubs with
 * their own kits wear their home kits, unless the away side's would clash:
 * then it changes (#91). Highlights tell the sides apart by ink, so they
 * must never share one.
 */
export const matchInks = (
  game: Game,
  fixture: Pick<MatchFixture, 'home' | 'opponent'>
) => {
  const { home } = fixture;
  if (game.colour !== undefined) {
    return {
      away: home ? 7 - game.colour : game.colour,
      home: home ? game.colour : 7 - game.colour
    };
  }
  const club = game.clubs[game.club - 1]!.kit!;
  const opponent = game.clubs[fixture.opponent - 1]!.kit!;
  const [homeKit, awayKit] = home ? [club, opponent] : [opponent, club];
  return {
    away: awayKit.home === homeKit.home ? awayKit.change : awayKit.home,
    home: homeKit.home
  };
};

/**
 * One League match or Cup round, from picking the fixture to settling it.
 * Returns `undefined` when the schedule offers no fixture. In the original
 * schedule cup round k always follows league match 2k-1, so play never
 * reaches that state: the final directly follows league match fifteen.
 */
export const createMatchday = (initial: Game, keyboard?: PauseKeyboard) => {
  const next = nextFixture(initial);
  if (next === 'season') {
    return;
  }
  let fixture: MatchFixture =
    next === 'league' ? prepareLeagueMatch(initial) : prepareCupMatch(initial);
  let game = fixture.game;
  let stage: MatchdayStage = 'fixture';
  let highlights: HighlightResult | undefined;
  let moments: MomentResult | undefined;
  let playback: Playback | undefined;
  let ticker: Ticker | undefined;
  let settlement: MatchSettlement | undefined;
  const expect = (expected: MatchdayStage) => {
    if (stage !== expected) {
      throw new RangeError(`Matchday is at ${stage}, not ${expected}`);
    }
  };
  /** The pitch playback or, under moment highlights, the ticker. */
  const watched = () => (playback ?? ticker)!;
  const finishPlayback = () => {
    if (!watched().done) {
      return;
    }
    if (highlights) {
      // The original's RNG seed and attack positions continue from the
      // highlights only once they have been watched.
      game = {
        ...game,
        attackCarry: highlights.carry,
        seed: highlights.seed
      };
    }
    stage = 'result';
  };
  return {
    /** Advances highlight playback; the result follows its last frame. */
    advance: (frames: number) => {
      expect('highlights');
      const missed = watched().advance(frames);
      finishPlayback();
      return missed;
    },
    advanceT: (t: number) => {
      expect('highlights');
      const missed = watched().advanceT(t);
      finishPlayback();
      return missed;
    },
    /** Plays highlights for up to `t` but not past their end. */
    advanceWithinT: (t: number) => {
      expect('highlights');
      const played = watched().advanceWithinT(t);
      finishPlayback();
      return played;
    },
    get fixture() {
      return fixture;
    },
    get game() {
      return game;
    },
    get highlights() {
      return highlights;
    },
    get inks() {
      return matchInks(game, fixture);
    },
    /**
     * Plays the highlights for the picked team. Under moment highlights
     * (#107) the moments decide the match at once, and the ticker (#108)
     * shows them.
     */
    kickOff: () => {
      expect('team');
      if (momentHighlights(game.ruleset)) {
        const { squad } = game.clubs[fixture.opponent - 1]!;
        moments = decideMoments({
          home: fixture.home,
          opponent: fixture.opponentStrength,
          players: game.players,
          seed: game.seed,
          strength: teamStrength(game),
          ...(squad && game.squadSeed !== undefined
            ? { opponentSquad: squad, squadSeed: game.squadSeed }
            : {})
        });
        game = { ...game, seed: moments.seed };
        ticker = createTicker(moments, fixture.home, keyboard);
        stage = 'highlights';
        return;
      }
      const inks = matchInks(game, fixture);
      highlights = simulateHighlights({
        awayInk: inks.away,
        carry: game.attackCarry,
        home: fixture.home,
        homeInk: inks.home,
        opponent: fixture.opponentStrength,
        seed: game.seed,
        strength: teamStrength(game)
      });
      playback = createPlayback(highlights, keyboard);
      stage = 'highlights';
    },
    /**
     * Hands the ticker one clip length per moment, in frames, in place of
     * its 75-frame pauses (ADR 0013). Only at kick-off, before the ticker
     * has played a frame; returns whether the lengths were taken.
     */
    holdClips: (lengths: readonly number[]) => {
      expect('highlights');
      if (!ticker || ticker.elapsedT > 0 || ticker.lengths) {
        return false;
      }
      if (!validClipLengths(lengths, moments!.moments.length)) {
        throw new RangeError('One clip length is needed for each moment');
      }
      ticker = createTicker(moments!, fixture.home, keyboard, [...lengths]);
      return true;
    },
    /** The moments that decided the match, under moment highlights. */
    get moments() {
      return moments;
    },
    /** Adds or removes a player from the picked team. */
    pick: (id: number) => {
      expect('team');
      game = togglePickedPlayer(game, id);
    },
    get playback() {
      return playback;
    },
    /** Recovers energy and draws injuries before team selection. */
    refresh: () => {
      expect('fixture');
      game = refreshPlayers(game);
      stage = 'team';
    },
    /** Replays a drawn cup tie with the grounds swapped. */
    replay: () => {
      expect('replay');
      fixture = prepareReplay(game, fixture);
      highlights = undefined;
      moments = undefined;
      playback = undefined;
      ticker = undefined;
      stage = 'fixture';
    },
    /** Credits receipts and settles the league match or cup leg. */
    settle: () => {
      expect('result');
      const score = (moments ?? highlights)!.score;
      if (fixture.kind === 'cup') {
        const result = settleCupLeg(game, fixture, score);
        game = result.game;
        if (result.replay) {
          stage = 'replay';
          return;
        }
        settlement = {
          bills: result.bills!,
          cupWon: result.cupWon,
          kind: 'cup'
        };
      } else {
        const completion = completeLeagueMatch(game, fixture, score);
        game = completion.game;
        settlement = { completion, kind: 'league' };
      }
      stage = 'settled';
    },
    /** The final score, home first, once the match is decided. */
    get score() {
      return (moments ?? highlights)?.score;
    },
    get settlement() {
      return settlement;
    },
    skipPause: () => {
      expect('highlights');
      watched().skipPause();
      finishPlayback();
    },
    get stage() {
      return stage;
    },
    /** The ticker showing the moments, under moment highlights. */
    get ticker() {
      return ticker;
    }
  };
};

export type Matchday = NonNullable<ReturnType<typeof createMatchday>>;
