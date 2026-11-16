import { fixtureSides, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import { answersFor } from './answers';
import { clubName, fixtureTitle, type ClubName } from './home';
import { shortNames } from './modern-highlights';

/** One scorer's row: the player, and the minutes of each goal they scored. */
export type FullTimeScorer = Readonly<{
  minutes: readonly string[];
  /** Absent for an opponent without a squad, whose goals name nobody. */
  name?: string;
}>;

/** A managed club's player injured in the match, and the matches they miss. */
export type FullTimeInjury = Readonly<{ matches: number; name: string }>;

/**
 * Modern mode's Full-time screen: the original's final score as the
 * scoreboard at full time, the goals and the managed club's injuries from
 * the match's moments, and the gate receipts.
 */
export type FullTime = Readonly<{
  away: ClubName;
  /** FT, under moment highlights; the original's attacks have no clock. */
  clock?: string;
  done: Readonly<{ enabled: boolean; id: string }>;
  gate: number;
  /**
   * Each club's scorers, home first. Absent when the original's attacks
   * decided the match, since they name no scorers.
   */
  goals?: readonly [readonly FullTimeScorer[], readonly FullTimeScorer[]];
  home: ClubName;
  /** Absent with the goals; empty when nobody was injured. */
  injuries?: readonly FullTimeInjury[];
  /** A drawn cup round, which the original replays. */
  replay: boolean;
  score: readonly number[];
  short?: readonly [string, string];
  title: string;
}>;

/** The player a moment names, or `undefined` when it names nobody. */
const playerName = (game: Game, fixture: MatchFixture, moment: Moment) => {
  if (moment.side === 'club') {
    return game.players.find(p => p.id === moment.player)?.name.trim();
  }
  const { squad } = game.clubs[fixture.opponent - 1]!;
  return moment.squadPlayer === undefined
    ? undefined
    : squad?.[moment.squadPlayer]?.name.trim();
};

/** One side's scorers, ordered by their first goal. */
const scorers = (
  game: Game,
  fixture: MatchFixture,
  goals: readonly Moment[]
): FullTimeScorer[] => {
  const rows = new Map<string | undefined, string[]>();
  for (const goal of goals) {
    const name = playerName(game, fixture, goal);
    const minutes = rows.get(name) ?? [];
    minutes.push(`${goal.minute}′`);
    rows.set(name, minutes);
  }
  return [...rows].map(([name, minutes]) =>
    name === undefined ? { minutes } : { minutes, name }
  );
};

export const fullTimeFor = (view: View): FullTime | undefined => {
  if (view.screen !== 'result') {
    return undefined;
  }
  const { fixture, game, moments: decided, score } = view;
  const sides = fixtureSides(game, fixture);
  const home = clubName(sides.home);
  const away = clubName(sides.away);
  const short = shortNames(home, away);
  const id = 'result.continue';
  const base = {
    away,
    done: { enabled: answersFor(view).some(a => a.id === id), id },
    gate: fixture.gate,
    home,
    replay: fixture.kind === 'cup' && score[0] === score[1],
    score,
    ...(short ? { short } : {}),
    title: fixtureTitle(game, fixture)
  };
  if (!decided) {
    return base;
  }
  const moments = decided.toSorted((a, b) => a.minute - b.minute);
  const goals = moments.filter(m => m.kind === 'goal');
  const homeSide = fixture.home ? 'club' : 'opponent';
  const injuries = moments.flatMap(moment => {
    const name =
      moment.kind === 'injury' && moment.side === 'club'
        ? playerName(game, fixture, moment)
        : undefined;
    return name ? [{ matches: moment.weeksOut ?? 1, name }] : [];
  });
  return {
    ...base,
    clock: 'FT',
    goals: [
      scorers(
        game,
        fixture,
        goals.filter(g => g.side === homeSide)
      ),
      scorers(
        game,
        fixture,
        goals.filter(g => g.side !== homeSide)
      )
    ],
    injuries
  };
};
