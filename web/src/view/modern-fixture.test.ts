import { expect, test } from 'bun:test';

import type { View } from '../sim/session';
import { playTo } from '../test/play';
import { modernFixtureFor } from './modern-fixture';
import { modernScreenFor } from './modern-screen';
import { screenTitle } from './screen-title';

type FixtureView = Extract<View, { screen: 'fixture' }>;

/** The first of a new game's fixtures that `wanted` picks out. */
const fixtureWhere = (wanted: (view: FixtureView) => boolean) => {
  for (let n = 1; n < 10; n++) {
    const view = playTo('fixture', n);
    if (wanted(view)) {
      return view;
    }
  }
  throw new Error('No such fixture');
};

const first = playTo('fixture');
/** A league match once the table has places. */
const second = fixtureWhere(
  v => v.fixture.kind === 'league' && v.game.leaguePosition > 0
);
const cup = fixtureWhere(v => v.fixture.kind === 'cup');
const name = (view: FixtureView, club: number) =>
  view.game.clubs[club - 1]!.name.trim();

test('the next fixture shows its Modern screen, titled by its competition', () => {
  expect(modernScreenFor(first)?.kind).toBe('fixture');
  expect(screenTitle(first)).toBe(
    `League match – Division ${first.game.division}`
  );
  expect(cup.fixture.kind).toBe('cup');
  expect(screenTitle(cup)).toBe(`F.A. Cup – Round ${cup.game.cupRound}`);
});

test('a league match names both clubs, home first, with where each stands', () => {
  const { fixture, game } = second;
  const screen = modernFixtureFor(second)!;
  const opponent =
    game.league[fixture.opponent - (game.division - 1) * 16 - 1]!;
  const ours = { name: name(second, game.club), position: game.leaguePosition };
  const theirs = {
    name: name(second, fixture.opponent),
    position: opponent.position
  };
  const [home, away] = fixture.home ? [ours, theirs] : [theirs, ours];
  expect(screen.home.club.name).toBe(home.name);
  expect(screen.away.club.name).toBe(away.name);
  expect(screen.home.standing).toMatch(
    new RegExp(`^${home.position}(st|nd|rd|th) in Division ${game.division}$`)
  );
  expect(screen.venue).toBe(fixture.home ? 'At home' : 'Away');
  expect(screen.draw).toBeUndefined();
  expect(screen.done).toEqual({
    enabled: true,
    id: 'fixture.continue',
    label: 'Pick team'
  });
});

test('before the first league match, a club stands only in its division', () => {
  const screen = modernFixtureFor(first)!;
  expect(screen.home.standing).toBe(`Division ${first.game.division}`);
  expect(screen.away.standing).toBe(`Division ${first.game.division}`);
});

const division = (club: number) => Math.floor((club - 1) / 16) + 1;

test('a cup round reveals its draw, each club by its division', () => {
  const { fixture } = cup;
  const screen = modernFixtureFor(cup)!;
  const opponent = name(cup, fixture.opponent);
  expect(screen.draw).toBe(
    `Drawn against ${opponent}, ${fixture.home ? 'at home' : 'away'}`
  );
  const [home, away] = fixture.home
    ? [cup.game.club, fixture.opponent]
    : [fixture.opponent, cup.game.club];
  expect(screen.home.standing).toBe(`Division ${division(home)}`);
  expect(screen.away.standing).toBe(`Division ${division(away)}`);
});

/** The managed club's side of `second`, at `leaguePosition`. */
const ours = (leaguePosition: number) => {
  const screen = modernFixtureFor({
    ...second,
    game: { ...second.game, leaguePosition }
  })!;
  return second.fixture.home ? screen.home : screen.away;
};

test('the positions read as ordinals', () => {
  expect(ours(1).standing).toMatch(/^1st /);
  expect(ours(2).standing).toMatch(/^2nd /);
  expect(ours(3).standing).toMatch(/^3rd /);
  expect(ours(11).standing).toMatch(/^11th /);
  expect(ours(12).standing).toMatch(/^12th /);
  expect(ours(13).standing).toMatch(/^13th /);
});
