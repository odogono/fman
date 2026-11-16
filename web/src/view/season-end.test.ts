import { expect, test } from 'bun:test';

import type { View } from '../sim/session';
import { playTo } from '../test/play';
import { modernScreenFor } from './modern-screen';
import { endOfSeasonFor, seasonSummaryFor } from './season-end';

type EndView = Extract<View, { screen: 'end-season' }>;
type SummaryView = Extract<View, { screen: 'season-summary' }>;

const end = playTo('end-season');
const summary = playTo('season-summary');

test('the season end and its summary show Modern screens', () => {
  expect(modernScreenFor(end)?.kind).toBe('end-of-season');
  expect(modernScreenFor(summary)?.kind).toBe('season-summary');
});

test('the season end sums up the league place and the cup run', () => {
  const { game } = end;
  const screen = endOfSeasonFor(end)!;
  expect(screen.league).toMatch(
    new RegExp(
      `^Finished ${game.leaguePosition}(st|nd|rd|th) in Division ${game.division}$`
    )
  );
  expect(screen.done).toEqual({
    enabled: true,
    id: 'end-season.continue',
    label: 'Final table'
  });
});

const cupRun = (cupRound: number, cupWon = false) =>
  endOfSeasonFor({
    ...end,
    cupWon,
    game: { ...end.game, cupFinished: true, cupRound }
  } satisfies EndView)!.cup;

test('the cup run names where it ended', () => {
  expect(cupRun(3)).toBe('Out in Round 3');
  expect(cupRun(7)).toBe('Out in the Semi-Final');
  expect(cupRun(8)).toBe('Lost in the Final');
  expect(cupRun(8, true)).toBe('Won the F.A. Cup');
});

/** The summary as if the club had finished `finalPosition` in `from`, now in `to`. */
const settled = (finalPosition: number, from: number, to: number) =>
  seasonSummaryFor({
    ...summary,
    game: { ...summary.game, division: to },
    season: { ...summary.season, finalPosition, previousDivision: from }
  })!;

test('the summary leads with what happened to the club', () => {
  expect(settled(2, 4, 3)).toMatchObject({
    headline: 'Promoted to Division 3',
    outcome: 'promoted'
  });
  expect(settled(15, 2, 3)).toMatchObject({
    headline: 'Relegated to Division 3',
    outcome: 'relegated'
  });
  expect(settled(1, 1, 1)).toMatchObject({
    headline: 'League Champions',
    outcome: 'champions'
  });
  expect(settled(8, 4, 4)).toMatchObject({
    headline: 'Staying in Division 4',
    outcome: 'stayed'
  });
});

test('the bonus, the rating and the new season follow', () => {
  const { game, season } = summary;
  const screen = seasonSummaryFor(summary)!;
  expect(screen.bonus).toBe(season.bonus);
  expect(screen.bonusFor).toMatch(/^for finishing \d+(st|nd|rd|th)$/);
  expect(screen.rating).toBe(game.rating);
  expect(screen.done).toEqual({
    enabled: true,
    id: 'season-summary.continue',
    label: 'New season'
  });
});

test("the division's other moves are listed, without the club's own", () => {
  const ours = summary.game.clubs[summary.game.club - 1]!;
  const screen = seasonSummaryFor(summary)!;
  const named = [...screen.promoted, ...screen.relegated];
  expect(named).not.toContain(ours.name.trim());
  const moved = summary.season.movements.filter(m => m.club !== ours);
  expect(named.length).toBeLessThanOrEqual(moved.length);
  for (const movement of summary.season.movements) {
    const name = movement.club.name.trim();
    if (name === ours.name.trim()) {
      continue;
    }
    expect(
      movement.kind === 'relegated' ? screen.relegated : screen.promoted
    ).toContain(name);
  }
});
