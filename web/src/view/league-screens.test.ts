import { expect, test } from 'bun:test';

import type { View } from '../sim/session';
import { playTo } from '../test/play';
import { leagueTableFor, weekResultsFor } from './league-screens';
import { modernScreenFor } from './modern-screen';

type TableView = Extract<View, { screen: 'table' }>;
type ResultsView = Extract<View, { screen: 'other-matches' }>;

const results = playTo('other-matches');
const firstTable = playTo('table');
const secondTable = playTo('table', 2);

test('the week results and the table show their Modern screens', () => {
  expect(modernScreenFor(results)?.kind).toBe('week-results');
  expect(modernScreenFor(firstTable)?.kind).toBe('league-table');
});

test("the week's results list all eight matches, the managed club's first", () => {
  const screen = weekResultsFor(results)!;
  const { game } = results;
  const { match } = results.completion;
  expect(screen.title).toBe(`Results – Division ${game.division}`);
  expect(screen.rows).toHaveLength(8);
  const [own, ...others] = screen.rows;
  expect(own).toMatchObject({
    away: { name: game.clubs[match.away - 1]!.name.trim() },
    home: { name: game.clubs[match.home - 1]!.name.trim() },
    own: true,
    score: match.score
  });
  expect(others.map(row => [row.home.name, row.score, row.away.name])).toEqual(
    results.completion.results.map(r => [
      game.clubs[r.home - 1]!.name.trim(),
      r.score,
      game.clubs[r.away - 1]!.name.trim()
    ])
  );
  expect(others.every(row => !row.own)).toBe(true);
  expect(screen.done).toEqual({ enabled: true, id: 'other-matches.continue' });
});

/** The view's clubs by their league position. */
const byPosition = (view: TableView) =>
  view.completion.order.map(index =>
    view.game.clubs[(view.game.division - 1) * 16 + index]!.name.trim()
  );

test('the table orders the division as the week left it, with the caption', () => {
  const screen = leagueTableFor(firstTable)!;
  expect(screen.rows.map(row => row.club.name)).toEqual(byPosition(firstTable));
  expect(screen.rows.map(row => row.position)).toEqual(
    Array.from({ length: 16 }, (_, i) => i + 1)
  );
  expect(screen.caption).toBe(
    `Division ${firstTable.game.division} – after 1 of 15`
  );
  expect(screen.final).toBe(false);
  expect(screen.done).toEqual({ enabled: true, id: 'table.continue' });
});

test("each row's goals, goal difference and points come from the league", () => {
  const { game } = firstTable;
  const screen = leagueTableFor(firstTable)!;
  firstTable.completion.order.forEach((index, rank) => {
    const record = game.league[index]!;
    expect(screen.rows[rank]).toMatchObject({
      against: record.against,
      difference: record.for - record.against,
      for: record.for,
      points: record.points
    });
  });
});

test("only the managed club's row is its own", () => {
  const { game } = firstTable;
  const own = leagueTableFor(firstTable)!.rows.filter(row => row.own);
  expect(own).toHaveLength(1);
  expect(own[0]!.position).toBe(game.leaguePosition);
});

test('the first week has no movement; later weeks count the places moved', () => {
  expect(
    leagueTableFor(firstTable)!.rows.every(r => r.move === undefined)
  ).toBe(true);
  const { completion } = secondTable;
  const moves = leagueTableFor(secondTable)!.rows.map(row => row.move);
  expect(moves).toEqual(
    completion.order.map(
      (index, rank) => completion.previous![index]! - (rank + 1)
    )
  );
  expect(moves.some(move => move !== 0)).toBe(true);
});

const inDivision = (view: TableView, division: number): TableView => ({
  ...view,
  game: { ...view.game, division }
});

const zones = (view: TableView): string[] =>
  leagueTableFor(view)!.rows.map(row => row.zone ?? '');

test('the top three go up and the bottom three down, where there is a division', () => {
  const promotion = ['promotion', 'promotion', 'promotion'];
  const relegation = ['relegation', 'relegation', 'relegation'];
  const middle = Array.from({ length: 10 }, () => '');
  expect(zones(inDivision(firstTable, 4))).toEqual([
    ...promotion,
    ...middle,
    '',
    '',
    ''
  ]);
  expect(zones(inDivision(firstTable, 2))).toEqual([
    ...promotion,
    ...middle,
    ...relegation
  ]);
  expect(zones(inDivision(firstTable, 1))).toEqual([
    'champions',
    '',
    '',
    ...middle,
    ...relegation
  ]);
});

test('the season-end table names the outcomes and shows no movement', () => {
  const { game } = secondTable;
  const view: View = { ...secondTable, game, screen: 'season-table' };
  const screen = leagueTableFor(view)!;
  expect(screen.final).toBe(true);
  expect(screen.done.id).toBe('season-table.continue');
  expect(screen.rows.every(row => row.move === undefined)).toBe(true);
  expect(screen.rows.map(row => row.position)).toEqual(
    Array.from({ length: 16 }, (_, i) => i + 1)
  );
  const names = [...game.league.keys()]
    .sort((a, b) => game.league[a]!.position - game.league[b]!.position)
    .map(index => game.clubs[(game.division - 1) * 16 + index]!.name.trim());
  expect(screen.rows.map(row => row.club.name)).toEqual(names);
});

test('a print fault shows the original screen', () => {
  const faulted: ResultsView = { ...results, printFault: 'Fault' };
  expect(modernScreenFor(faulted)).toBeUndefined();
  expect(
    modernScreenFor({ ...firstTable, printFault: 'Fault' })
  ).toBeUndefined();
});
