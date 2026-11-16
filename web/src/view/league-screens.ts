import type { Game } from '../sim/management';
import type { View } from '../sim/session';
import { answersFor } from './answers';
import { clubName, type ClubName } from './home';

type Done = Readonly<{ enabled: boolean; id: string }>;

/** One match of the week's results, home first. */
export type WeekResult = Readonly<{
  away: ClubName;
  home: ClubName;
  /** The managed club's own match. */
  own: boolean;
  score: readonly number[];
}>;

/**
 * Modern mode's week's results, in place of the original's other matches:
 * every league match in the division that week, the managed club's first.
 */
export type WeekResults = Readonly<{
  done: Done;
  rows: readonly WeekResult[];
  title: string;
}>;

/** Where a place in the table leads at the season end. */
export type LeagueZone = 'champions' | 'promotion' | 'relegation';

export type LeagueRow = Readonly<{
  against: number;
  club: ClubName;
  difference: number;
  for: number;
  /**
   * Places gained since last week, negative when lost; absent on the
   * first week and at the season end, where there is nothing to compare.
   */
  move?: number;
  own: boolean;
  points: number;
  position: number;
  zone?: LeagueZone;
}>;

/**
 * Modern mode's league table, after each league match and again at the
 * season end, where `final` names the zones as outcomes.
 */
export type LeagueTable = Readonly<{
  caption: string;
  done: Done;
  final: boolean;
  rows: readonly LeagueRow[];
}>;

const doneFor = (view: View, id: string): Done => ({
  enabled: answersFor(view).some(answer => answer.id === id),
  id
});

export const weekResultsFor = (view: View): WeekResults | undefined => {
  if (view.screen !== 'other-matches') {
    return undefined;
  }
  const { completion, game } = view;
  const club = (index: number) => clubName(game.clubs[index - 1]!);
  const row = (
    result: Readonly<{ away: number; home: number; score: readonly number[] }>,
    own: boolean
  ): WeekResult => ({
    away: club(result.away),
    home: club(result.home),
    own,
    score: result.score
  });
  return {
    done: doneFor(view, 'other-matches.continue'),
    rows: [
      row(completion.match, true),
      ...completion.results.map(result => row(result, false))
    ],
    title: `Results – Division ${game.division}`
  };
};

const zoneOf = (division: number, position: number): LeagueZone | undefined =>
  position === 1 && division === 1
    ? 'champions'
    : position <= 3 && division > 1
      ? 'promotion'
      : position >= 14 && division < 4
        ? 'relegation'
        : undefined;

const rowsOf = (
  game: Game,
  order: readonly number[],
  previous?: readonly number[]
): LeagueRow[] => {
  const offset = (game.division - 1) * 16;
  return order.map((index, rank) => {
    const record = game.league[index]!;
    const position = rank + 1;
    const zone = zoneOf(game.division, position);
    const before = previous?.[index];
    return {
      against: record.against,
      club: clubName(game.clubs[offset + index]!),
      difference: record.for - record.against,
      for: record.for,
      ...(before === undefined ? {} : { move: before - position }),
      own: offset + index + 1 === game.club,
      points: record.points,
      position,
      ...(zone ? { zone } : {})
    };
  });
};

export const leagueTableFor = (view: View): LeagueTable | undefined => {
  if (view.screen === 'table') {
    const { completion, game } = view;
    return {
      caption: `Division ${game.division} – after ${game.leagueMatches} of 15`,
      done: doneFor(view, 'table.continue'),
      final: false,
      rows: rowsOf(game, completion.order, completion.previous)
    };
  }
  if (view.screen === 'season-table') {
    const { game } = view;
    const order = [...game.league.keys()].sort(
      (a, b) => game.league[a]!.position - game.league[b]!.position
    );
    return {
      caption: `Division ${game.division} – final`,
      done: doneFor(view, 'season-table.continue'),
      final: true,
      rows: rowsOf(game, order)
    };
  }
  return undefined;
};
