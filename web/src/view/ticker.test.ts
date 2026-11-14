import { expect, test } from 'bun:test';

import { createJournal, type Journal } from '../sim/journal';
import type { Moment } from '../sim/moments';
import { presentDay, type Ruleset } from '../sim/ruleset';
import { createTicker, tickerLeadIn } from '../sim/ticker';
import { submitInput } from '../test/input';
import { paintMatch, type MatchView } from './match-layouts';
import { tickerLines, tickerText } from './ticker-layout';

/** A new game's first league match, kicked off under `ruleset`. */
const kickedOff = (ruleset: Ruleset) => {
  const journal = createJournal({ kind: 'title', ruleset });
  journal.advance(137);
  journal.skipPause();
  const colour = presentDay(ruleset) ? [] : ['0'];
  for (const text of ['alex', '1', '1', ...colour, '99', '', '99']) {
    submitInput(journal, text);
  }
  expect(journal.session.view.screen).toBe('highlights');
  return journal;
};

const tickerView = (journal: Journal) => {
  const view = journal.session.view;
  if (view.screen !== 'highlights' || view.highlights.kind !== 'moments') {
    throw new Error(`No ticker on ${view.screen}`);
  }
  return { ...view, highlights: view.highlights };
};

const rows = (view: MatchView) => {
  const screen: string[] = Array.from({ length: 22 }, () => ' '.repeat(32));
  const styles = new Map<string, object | undefined>();
  paintMatch(view, (row, column, text, style) => {
    screen[row] =
      screen[row]!.slice(0, column) +
      text +
      screen[row]!.slice(column + text.length);
    styles.set(`${row}:${column}`, style);
  });
  return { screen: screen.map(r => r.trimEnd()), styles };
};

const journal = kickedOff('enhanced-7');
const view = tickerView(journal);
const { fixture, game } = view;
const opponent = game.clubs[fixture.opponent - 1]!.name.trim().toUpperCase();
const club = game.clubs[game.club - 1]!.name.trim().toUpperCase();
const player = (id: number) =>
  game.players.find(p => p.id === id)!.name.toUpperCase();

test('each line opens with the minute and the kind, newest first', () => {
  const moments: Moment[] = [
    { kind: 'save', minute: 9, player: 23, side: 'club' },
    { kind: 'goal', minute: 34, side: 'opponent' },
    { kind: 'near-miss', minute: 67, side: 'opponent' },
    { kind: 'clearance', minute: 75, player: 20, side: 'club' },
    { kind: 'goal', minute: 88, player: 17, side: 'club' }
  ];
  const lines = tickerLines(game, fixture, moments).map(tickerText);
  const [homeGoals, awayGoals] = fixture.home ? ['1-1', '0-1'] : ['1-1', '1-0'];
  expect(lines).toEqual([
    `88' GOAL! ${player(17)} ${homeGoals}`,
    `75' CLEARED: ${player(20)}`,
    `67' MISSED: ${opponent}`,
    `34' GOAL! ${opponent} ${awayGoals}`,
    `9' SAVED: ${player(23)}`
  ]);
});

test('without a named player, the club is named', () => {
  const [line] = tickerLines(game, fixture, [
    { kind: 'goal', minute: 5, side: 'club' }
  ]);
  expect(line!.name).toBe(club);
});

test("an opponent's moment names the player from its squad", () => {
  const { squad } = game.clubs[fixture.opponent - 1]!;
  const lines = tickerLines(game, fixture, [
    { kind: 'goal', minute: 34, side: 'opponent', squadPlayer: 3 },
    { kind: 'save', minute: 50, side: 'opponent', squadPlayer: 0 }
  ]).map(tickerText);
  expect(lines).toEqual([
    `50' SAVED: ${squad![0]!.name.toUpperCase()}`,
    `34' GOAL! ${squad![3]!.name.toUpperCase()} ${fixture.home ? '0-1' : '1-0'}`
  ]);
});

test('a match under club squads names its opponent’s players', () => {
  const watched = kickedOff('enhanced-7');
  watched.advance(tickerLeadIn);
  watched.skipPause();
  const ticker = tickerView(watched).highlights.timeline;
  const names = new Set(
    game.clubs[fixture.opponent - 1]!.squad!.map(p => p.name.toUpperCase())
  );
  const lines = tickerLines(game, fixture, ticker.shown).toReversed();
  const named = lines.filter((_, i) => ticker.shown[i]!.side === 'opponent');
  expect(named.length).toBeGreaterThan(0);
  for (const line of named) {
    expect(names.has(line.name)).toBe(true);
  }
});

test('a long name is cut to fit, keeping the minute and score', () => {
  const long = {
    ...game,
    players: game.players.map(p =>
      p.id === 23 ? { ...p, name: 'Bartholomew Featherstonehaugh-Smythe' } : p
    )
  };
  const [line] = tickerLines(long, fixture, [
    { kind: 'goal', minute: 90, player: 23, side: 'club' }
  ]);
  const text = `${line!.minute} ${line!.word} ${line!.name} ${line!.score}`;
  expect(text).toHaveLength(32);
  expect(text.startsWith("90' GOAL! BARTHOLOMEW")).toBe(true);
  expect(text.endsWith(fixture.home ? ' 1-0' : ' 0-1')).toBe(true);
});

test('Classic mode shows the header and the newest moment on top', () => {
  const before = rows(view).screen;
  expect(before[0]).toBe('MATCH HIGHLIGHTS');
  expect(before[1]).toMatch(/^\S.* 0 .* 0$/);
  expect(before.slice(2).every(r => r === '')).toBe(true);
  journal.skipPause();
  const after = tickerView(journal);
  const lines = tickerLines(game, fixture, after.highlights.timeline.shown);
  const painted = rows(after);
  expect(painted.screen.slice(3, 3 + lines.length)).toEqual(
    lines.map(
      line =>
        `${line.minute} ${line.word} ${line.name}${line.score ? ` ${line.score}` : ''}`
    )
  );
  const [home, away] = after.highlights.timeline.score;
  expect(painted.screen[1]).toMatch(new RegExp(` ${home} .* ${away}$`));
});

test('goals stand out in red inverse video', () => {
  const ticker = createTicker(
    { moments: [{ kind: 'goal', minute: 12, side: 'club' }] },
    fixture.home
  );
  ticker.advance(tickerLeadIn);
  ticker.skipPause();
  const { styles } = rows({
    ...view,
    highlights: { ...view.highlights, timeline: ticker }
  });
  expect(styles.get('3:4')).toMatchObject({ ink: 2, inverse: true });
});

test('past the bottom row the oldest moments drop off', () => {
  const moments = Array.from({ length: 22 }, (_, i): Moment => ({
    kind: 'save',
    minute: i + 1,
    side: 'opponent'
  }));
  const ticker = createTicker({ moments }, fixture.home);
  ticker.advance(tickerLeadIn);
  ticker.skipPause();
  const { screen } = rows({
    ...view,
    highlights: { ...view.highlights, timeline: ticker }
  });
  expect(screen[3]).toBe(`22' SAVED: ${opponent}`);
  expect(screen[21]).toBe(` 4' SAVED: ${opponent}`);
});

test('original-rules games still show the pitch', () => {
  const original = kickedOff('original').session.view;
  expect(original.screen === 'highlights' && original.highlights.kind).toBe(
    'attacks'
  );
});
