import { expect, test } from 'bun:test';

import { createJournal } from '../sim/journal';
import type { Moment } from '../sim/moments';
import { latestEnhanced, presentDay, type Ruleset } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { fullTimeFor } from './full-time';
import { modernScreenFor } from './modern-screen';

type ResultView = Extract<View, { screen: 'result' }>;

/** A new game's first league match under `ruleset`, played to full time. */
const fullTime = (ruleset: Ruleset): ResultView => {
  const journal = createJournal({ kind: 'title', ruleset });
  journal.advance(137);
  journal.skipPause();
  const colour = presentDay(ruleset) ? [] : ['0'];
  for (const text of ['alex', '1', '1', ...colour, '99', '', '99']) {
    submitInput(journal, text);
  }
  for (let i = 0; i < 200 && journal.session.view.screen !== 'result'; i++) {
    journal.advance(500);
  }
  const view = journal.session.view;
  if (view.screen !== 'result') {
    throw new Error(`Still on ${view.screen}`);
  }
  return view;
};

/** The view with its match decided by `moments` instead. */
const decidedBy = (view: ResultView, moments: Moment[]): ResultView => {
  const homeSide = view.fixture.home ? 'club' : 'opponent';
  const goals = moments.filter(m => m.kind === 'goal');
  const home = goals.filter(m => m.side === homeSide).length;
  const score = [home, goals.length - home];
  return { ...view, moments, score };
};

const enhanced = fullTime(latestEnhanced);
const { fixture, game } = enhanced;
const player = (id: number) => game.players.find(p => p.id === id)!.name;
const opponent = game.clubs[fixture.opponent - 1]!;
const squadName = (index: number) => opponent.squad![index]!.name;
/** Columns as home and away, given the managed club's and the opponent's. */
const columns = <T>(club: T, theirs: T): [T, T] =>
  fixture.home ? [club, theirs] : [theirs, club];

test('the result shows the Full-time screen in Modern mode', () => {
  expect(modernScreenFor(enhanced)?.kind).toBe('full-time');
});

test('the scoreboard reads FT over the final score and the gate receipts', () => {
  const screen = fullTimeFor(enhanced)!;
  expect(screen.clock).toBe('FT');
  expect(screen.score).toEqual(enhanced.score);
  expect(screen.gate).toBe(fixture.gate);
  expect(screen.title).toBe(`League match – Division ${game.division}`);
  expect(screen.done).toEqual({ enabled: true, id: 'result.continue' });
});

test('goals sit under their club, one row per scorer in order of first goal', () => {
  const view = decidedBy(enhanced, [
    { kind: 'goal', minute: 12, player: 17, side: 'club' },
    { kind: 'save', minute: 20, player: 18, side: 'club' },
    { kind: 'goal', minute: 31, side: 'opponent', squadPlayer: 9 },
    { kind: 'near-miss', minute: 40, side: 'opponent', squadPlayer: 8 },
    { kind: 'goal', minute: 55, player: 20, side: 'club' },
    { kind: 'goal', minute: 77, player: 17, side: 'club' }
  ]);
  expect(fullTimeFor(view)!.goals).toEqual(
    columns(
      [
        { minutes: ['12′', '77′'], name: player(17) },
        { minutes: ['55′'], name: player(20) }
      ],
      [{ minutes: ['31′'], name: squadName(9) }]
    )
  );
});

test("an opponent's goal without a named scorer shows its minute alone", () => {
  const view = decidedBy(enhanced, [
    { kind: 'goal', minute: 8, side: 'opponent' },
    { kind: 'goal', minute: 64, side: 'opponent' }
  ]);
  expect(fullTimeFor(view)!.goals).toEqual(
    columns([], [{ minutes: ['8′', '64′'] }])
  );
});

test("the managed club's injuries list each player and the matches they miss", () => {
  const view = decidedBy(enhanced, [
    { kind: 'goal', minute: 10, player: 17, side: 'club' },
    {
      kind: 'injury',
      minute: 50,
      player: 20,
      side: 'club',
      tackled: true,
      tackler: 4,
      weeksOut: 2
    },
    { kind: 'injury', minute: 70, player: 23, side: 'club', weeksOut: 1 }
  ]);
  expect(fullTimeFor(view)!.injuries).toEqual([
    { matches: 2, name: player(20) },
    { matches: 1, name: player(23) }
  ]);
});

test('a drawn league match has no replay to come', () => {
  const view = decidedBy(enhanced, [
    { kind: 'goal', minute: 10, player: 17, side: 'club' },
    { kind: 'goal', minute: 80, side: 'opponent' }
  ]);
  expect(fullTimeFor(view)!.replay).toBe(false);
});

test('a drawn cup round has a replay to come; a decided one has not', () => {
  const cup = { ...enhanced.fixture, kind: 'cup' as const };
  const drawn = decidedBy({ ...enhanced, fixture: cup }, []);
  expect(fullTimeFor(drawn)!.replay).toBe(true);
  const won = decidedBy({ ...enhanced, fixture: cup }, [
    { kind: 'goal', minute: 10, player: 17, side: 'club' }
  ]);
  expect(fullTimeFor(won)!.replay).toBe(false);
});

test("the original's attacks name no scorers, so there is no summary", () => {
  const original = fullTime('original');
  expect(original.moments).toBeUndefined();
  const screen = fullTimeFor(original)!;
  expect(screen.goals).toBeUndefined();
  expect(screen.injuries).toBeUndefined();
  expect(screen.clock).toBeUndefined();
  expect(screen.score).toEqual(original.score);
  expect(screen.gate).toBe(original.fixture.gate);
});
