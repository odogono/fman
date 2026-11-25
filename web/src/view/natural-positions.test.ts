import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';

import { GlobalRegistrator } from '@happy-dom/global-registrator';

import { placePickedPlayer } from '../sim/league';
import { createNewGame, type Game } from '../sim/management';
import { createSession } from '../sim/session';
import { inSquadOrder } from '../sim/squads';
import { viewOn } from '../sim/view-on';
import { submitInput } from '../test/input';
import type { Style } from './grid';
import { paintSquad } from './management-layouts';
import { pickTeamFor } from './pick-team';
import { paintPickTeam } from './pick-team-paint';

// Natural positions (#121) on the screens: the Classic squad screen marks a
// player out of position, and Modern mode groups the team by where each
// player plays.

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => GlobalRegistrator.unregister());
beforeEach(() => {
  document.body.replaceChildren();
});

const paint = (game: Game, selection = false) => {
  const rows: string[] = Array.from({ length: 24 }, () => ' '.repeat(32));
  const styles = new Map<string, Style | undefined>();
  paintSquad(
    game,
    (row, column, text, style) => {
      rows[row] =
        rows[row]!.slice(0, column) +
        text +
        rows[row]!.slice(column + text.length);
      [...text].forEach((_, i) => styles.set(`${row}:${column + i}`, style));
    },
    11,
    selection
  );
  return { rows, styles };
};

const start = () =>
  createNewGame({
    club: 1,
    level: 1,
    manager: 'alex',
    ruleset: 'natural-positions',
    seed: 0
  });

/** The first picked midfielder of `game`. */
const midfielder = (game: Game) =>
  game.players.find(p => p.status === 2 && p.position === 'MF')!;

test('the Classic squad screen shows the skill counted and the line, in red', () => {
  const game = start();
  const mover = midfielder(game);
  const moved = placePickedPlayer(game, mover.id, 'FW');
  const { rows, styles } = paint(moved, true);
  const row =
    inSquadOrder(moved.players.filter(p => p.status > 0)).findIndex(
      p => p.id === mover.id
    ) + 2;
  expect(rows[row]!.slice(15, 19)).toBe(
    `${Math.max(0, mover.skill - 1)}(${mover.skill})`
  );
  expect(rows[row]![31]).toBe('A');
  expect(styles.get(`${row}:31`)).toMatchObject({ ink: 2, inverse: true });
  expect(rows.join('\n')).toContain('OR No.+G,D,M,A to place him');
  expect(paint(moved).rows.join('\n')).not.toContain('place him');
});

/** A session at the selection prompt of a natural positions game. */
const atSelection = () => {
  const session = createSession(2 ** 24 - 5, 0, 'natural-positions');
  session.advance(5);
  session.skipPause();
  for (const input of ['alex', '1', '1', '99', '', 'c']) {
    submitInput(session, input);
  }
  return session;
};

test('Modern mode groups the team by where each player plays', () => {
  const session = atSelection();
  const mover = midfielder(viewOn(session, 'selection').game);
  submitInput(session, `${mover.id}A`);
  const pick = pickTeamFor(session.view)!;
  expect(pick.arranging).toBe(true);
  expect(pick.groups.map(g => g.title)).toEqual([
    'Goal',
    'Defence',
    'Midfield',
    'Attack',
    'Reserves and injured'
  ]);
  const attack = pick.groups.find(g => g.line === 'A')!;
  const row = attack.players.find(r => r.number === mover.id)!;
  expect(row.tag).toBe('M');
  expect(row.playsIn).toEqual({
    counts: Math.max(0, mover.skill - 1),
    line: 'A'
  });
  expect(row.placings?.map(p => p.line)).toEqual(['G', 'D', 'M']);
});

test('over eleven Done waits for a drop', () => {
  const session = atSelection();
  const reserve = viewOn(session, 'selection').game.players.find(
    p => p.status === 1
  )!;
  submitInput(session, String(reserve.id));
  const pick = pickTeamFor(session.view)!;
  expect(pick.actions).toEqual([
    {
      enabled: false,
      id: 'selection.done',
      label: 'Drop 1 to continue',
      tone: 'primary'
    }
  ]);
  // Only picked players can go to a line now; reserves wait.
  const reserves = pick.groups.find(g => g.line === 'reserves')!;
  expect(reserves.players.every(r => !r.placings)).toBe(true);
});

test('choosing a player turns each line into a button that puts him there', () => {
  const session = atSelection();
  const mover = midfielder(viewOn(session, 'selection').game);
  const pane = document.createElement('section');
  document.body.append(pane);
  paintPickTeam(pane, pickTeamFor(session.view)!);
  expect(pane.querySelectorAll('[data-line]')).toHaveLength(5);
  // Rows choose; they never answer on their own.
  const rowButton = [
    ...pane.querySelectorAll<HTMLButtonElement>('button.pick-row')
  ].find(b => b.textContent!.includes(mover.name.trim()))!;
  expect(rowButton.dataset.id).toBeUndefined();
  rowButton.click();
  const targets = [
    ...pane.querySelectorAll<HTMLButtonElement>('.pick-target')
  ].map(b => b.dataset.id);
  expect(targets).toEqual([
    `selection.place.${mover.id}.G`,
    `selection.place.${mover.id}.D`,
    `selection.place.${mover.id}.A`
  ]);
  pane.querySelector<HTMLButtonElement>('.pick-cancel')!.click();
  expect(pane.querySelectorAll('.pick-target')).toHaveLength(0);
});
