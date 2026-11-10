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
import type { PauseKeyboard } from './pause-keyboard';
import {
  createPlayback,
  type HighlightResult,
  type Playback
} from './playback';

export type MatchdayStage =
  'fixture' | 'team' | 'highlights' | 'result' | 'replay' | 'settled';
export type MatchSettlement =
  | { bills: MatchCompletion['bills']; cupWon: boolean; kind: 'cup' }
  | { completion: MatchCompletion; kind: 'league' };

/** The managed club's ink is its colour at home and the opposite colour away. */
export const matchInks = (game: Game, home: boolean) => ({
  away: home ? 7 - game.colour : game.colour,
  home: home ? game.colour : 7 - game.colour
});

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
  let playback: Playback | undefined;
  let settlement: MatchSettlement | undefined;
  const expect = (expected: MatchdayStage) => {
    if (stage !== expected) {
      throw new RangeError(`Matchday is at ${stage}, not ${expected}`);
    }
  };
  const finishPlayback = () => {
    if (playback!.done) {
      // The original's RNG seed and attack positions continue from the
      // highlights only once they have been watched.
      game = {
        ...game,
        attackCarry: highlights!.carry,
        seed: highlights!.seed
      };
      stage = 'result';
    }
  };
  return {
    /** Advances highlight playback; the result follows its last frame. */
    advance: (frames: number) => {
      expect('highlights');
      const missed = playback!.advance(frames);
      finishPlayback();
      return missed;
    },
    advanceT: (t: number) => {
      expect('highlights');
      const missed = playback!.advanceT(t);
      finishPlayback();
      return missed;
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
      return matchInks(game, fixture.home);
    },
    /** Plays the highlights for the picked team. */
    kickOff: () => {
      expect('team');
      const inks = matchInks(game, fixture.home);
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
      playback = undefined;
      stage = 'fixture';
    },
    /** Credits receipts and settles the league match or cup leg. */
    settle: () => {
      expect('result');
      const score = highlights!.score;
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
    get settlement() {
      return settlement;
    },
    skipPause: () => {
      expect('highlights');
      playback!.skipPause();
      finishPlayback();
    },
    get stage() {
      return stage;
    }
  };
};

export type Matchday = NonNullable<ReturnType<typeof createMatchday>>;
