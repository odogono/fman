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
import { paintPickTeam, pickAnswerEvent } from './pick-team-paint';

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
    ruleset: 'enhanced-15',
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
  const session = createSession(2 ** 24 - 5, 0, 'enhanced-15');
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

/** The pick team pane at the selection prompt, with `mover`'s row. */
const dragSetup = () => {
  const session = atSelection();
  const mover = midfielder(viewOn(session, 'selection').game);
  const pane = document.createElement('section');
  document.body.append(pane);
  paintPickTeam(pane, pickTeamFor(session.view)!);
  const row = [
    ...pane.querySelectorAll<HTMLButtonElement>('button.pick-row')
  ].find(b => b.textContent!.includes(mover.name.trim()))!;
  const zone = (line: string) =>
    pane.querySelector<HTMLElement>(`[data-line="${line}"]`)!;
  const answers: string[] = [];
  pane.addEventListener(pickAnswerEvent, event =>
    answers.push((event as CustomEvent<string>).detail)
  );
  return { answers, mover, pane, row, zone };
};

/** Points every hit test at `target`. */
const pointAt = (target: () => Element | null) => {
  document.elementFromPoint = target;
};

const pointer = (
  type: string,
  pointerType: 'mouse' | 'touch',
  x: number,
  y: number
) =>
  new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
    pointerType
  });

test('a mouse drag onto a line sends the answer that puts him there', () => {
  const { answers, mover, row, zone } = dragSetup();
  pointAt(() => zone('A'));
  row.dispatchEvent(pointer('pointerdown', 'mouse', 10, 10));
  dispatchEvent(pointer('pointermove', 'mouse', 10, 60));
  expect(zone('A').classList.contains('pick-over')).toBe(true);
  expect(zone('A').querySelector('.pick-counts')?.textContent).toBe(
    `counts ${Math.max(0, mover.skill - 1)}`
  );
  dispatchEvent(pointer('pointerup', 'mouse', 10, 60));
  expect(answers).toEqual([`selection.place.${mover.id}.A`]);
  expect(document.querySelector('.pick-ghost')).toBeNull();
  expect(zone('A').querySelector('.pick-counts')).toBeNull();
});

test('a drop where he is not taken, or a cancelled drag, sends nothing', () => {
  const { answers, row, zone } = dragSetup();
  // Over eleven aren't picked, so the reserves can't take a drop.
  pointAt(() => zone('reserves'));
  row.dispatchEvent(pointer('pointerdown', 'mouse', 10, 10));
  dispatchEvent(pointer('pointermove', 'mouse', 10, 60));
  dispatchEvent(pointer('pointerup', 'mouse', 10, 60));
  pointAt(() => zone('A'));
  row.dispatchEvent(pointer('pointerdown', 'mouse', 10, 10));
  dispatchEvent(pointer('pointermove', 'mouse', 10, 60));
  dispatchEvent(pointer('pointercancel', 'mouse', 10, 60));
  dispatchEvent(pointer('pointerup', 'mouse', 10, 60));
  expect(answers).toEqual([]);
  expect(document.querySelector('.pick-ghost')).toBeNull();
});

test('a finger that moves before the hold scrolls; one that holds drags', async () => {
  const { answers, mover, row, zone } = dragSetup();
  pointAt(() => zone('A'));
  row.dispatchEvent(pointer('pointerdown', 'touch', 10, 10));
  dispatchEvent(pointer('pointermove', 'touch', 10, 60));
  dispatchEvent(pointer('pointerup', 'touch', 10, 60));
  expect(document.querySelector('.pick-ghost')).toBeNull();
  row.dispatchEvent(pointer('pointerdown', 'touch', 10, 10));
  await Bun.sleep(300);
  expect(document.querySelector('.pick-ghost')).not.toBeNull();
  dispatchEvent(pointer('pointermove', 'touch', 10, 60));
  dispatchEvent(pointer('pointerup', 'touch', 10, 60));
  expect(answers).toEqual([`selection.place.${mover.id}.A`]);
});

test('while a player is chosen nobody drags', () => {
  const { answers, pane, row, zone } = dragSetup();
  const other = [
    ...pane.querySelectorAll<HTMLButtonElement>('button.pick-row')
  ].find(b => b !== row)!;
  other.click();
  const chosenRow = [
    ...pane.querySelectorAll<HTMLButtonElement>('button.pick-row')
  ].find(b => b.textContent === row.textContent)!;
  pointAt(() => zone('A'));
  chosenRow.dispatchEvent(pointer('pointerdown', 'mouse', 10, 10));
  dispatchEvent(pointer('pointermove', 'mouse', 10, 60));
  dispatchEvent(pointer('pointerup', 'mouse', 10, 60));
  expect(document.querySelector('.pick-ghost')).toBeNull();
  expect(answers).toEqual([]);
});
