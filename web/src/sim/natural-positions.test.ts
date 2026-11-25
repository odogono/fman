import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import { placePickedPlayer, teamStrength, togglePickedPlayer } from './league';
import { createNewGame, type Game, type Player } from './management';
import { pickShooter } from './moments';
import {
  countedSkill,
  lineAnswer,
  outOfPosition,
  placeAll,
  playsIn,
  skillAt
} from './natural-positions';
import { createRng } from './rng';
import { experiments, naturalPositions, ruleChangeNeeds } from './ruleset';
import { createSession } from './session';
import type { Position } from './squads';
import { viewOn } from './view-on';

const player = (
  id: number,
  position: Position,
  skill: number,
  status: Player['status'] = 2
): Player => ({
  energy: 11,
  id,
  name: `P${id}`,
  position,
  skill,
  status,
  value: 5000 * skill
});

/**
 * A squad in the 24 places: a goalkeeper and three of each outfield
 * position picked, a second goalkeeper and a midfielder in reserve, and
 * the transfer list after them.
 */
const squad = (): Player[] =>
  placeAll([
    player(1, 'GK', 4),
    ...([2, 3, 4] as const).map(id => player(id, 'DF', 3)),
    ...([5, 6, 7] as const).map(id => player(id, 'MF', 4)),
    ...([8, 9, 10, 11] as const).map(id => player(id, 'FW', 2)),
    player(12, 'GK', 2, 1),
    player(13, 'MF', 5, 1),
    ...Array.from({ length: 11 }, (_, i) => player(14 + i, 'DF', 1, 0))
  ]);

const game = (players = squad()): Game => ({
  ...createNewGame({
    club: 1,
    level: 1,
    manager: 'alex',
    ruleset: 'natural-positions',
    seed: 1
  }),
  morale: 10,
  players
});

test('natural positions are measured on Enhanced version 14 and need squads', () => {
  expect(experiments.find(e => e.name === 'natural-positions')?.base).toBe(
    'enhanced-14'
  );
  expect(ruleChangeNeeds.naturalPositions).toEqual(['clubSquads']);
  expect(naturalPositions('enhanced-14')).toBe(false);
  expect(naturalPositions('natural-positions')).toBe(true);
});

test('out of position a player counts one less for each line away, never below 0', () => {
  const midfielder = player(5, 'MF', 4);
  expect(skillAt(midfielder, 'MF')).toBe(4);
  expect(skillAt(midfielder, 'FW')).toBe(3);
  expect(skillAt(midfielder, 'DF')).toBe(3);
  const defender = player(2, 'DF', 1);
  expect(skillAt(defender, 'FW')).toBe(0);
  expect(skillAt(player(2, 'DF', 4), 'FW')).toBe(2);
});

test('only a goalkeeper keeps his skill in goal, and he counts 1 outfield', () => {
  expect(skillAt(player(1, 'GK', 4), 'GK')).toBe(4);
  expect(skillAt(player(1, 'GK', 4), 'DF')).toBe(1);
  expect(skillAt(player(1, 'GK', 4), 'FW')).toBe(1);
  expect(skillAt(player(5, 'DF', 5), 'GK')).toBe(1);
});

test('a new game puts every picked player in his position, one goalkeeper in goal', () => {
  const players = squad();
  expect(players.filter(p => playsIn(p) === 'GK').map(p => p.id)).toEqual([1]);
  expect(players.some(outOfPosition)).toBe(false);
  const two = placeAll([
    player(1, 'GK', 4),
    player(2, 'GK', 3),
    player(3, 'DF', 3)
  ]);
  expect(two.map(p => p.plays)).toEqual(['GK', 'DF', 'DF']);
  const started = createNewGame({
    club: 1,
    level: 1,
    manager: 'alex',
    ruleset: 'natural-positions',
    seed: 1
  });
  const picked = started.players.filter(p => p.status === 2);
  expect(picked.every(p => p.plays !== undefined)).toBe(true);
  expect(picked.filter(p => p.plays === 'GK').length).toBeLessThanOrEqual(1);
});

test('team strength counts each player where he plays', () => {
  // Goal 4 and defence 9 make 13; midfield 12; attack 8.
  expect(teamStrength(game()).slice(2)).toEqual([13, 12, 8]);
  // A midfielder pushed up counts 3 in attack, not 4 in midfield.
  expect(teamStrength(placePickedPlayer(game(), 5, 'FW')).slice(2)).toEqual([
    13, 8, 11
  ]);
});

test('with nobody in goal defence loses 3; an outfielder in goal counts 1', () => {
  const dropped = {
    ...game(),
    players: squad().map(p => (p.id === 1 ? { ...p, status: 1 as const } : p))
  };
  // Defence 9 less 3 for the empty goal.
  expect(teamStrength(dropped)[2]).toBe(6);
  // A defender in goal counts 1, and defence loses his 3.
  expect(teamStrength(placePickedPlayer(dropped, 2, 'GK'))[2]).toBe(7);
});

test('a new goalkeeper sends the one in goal to defence, an outfielder to his position', () => {
  let next = placePickedPlayer(game(), 12, 'GK');
  expect(next.players[0]!.plays).toBe('DF');
  expect(next.players[11]!.plays).toBe('GK');
  next = placePickedPlayer(next, 5, 'GK');
  expect(next.players[11]!.plays).toBe('DF');
  next = placePickedPlayer(next, 2, 'GK');
  expect(next.players[4]!.plays).toBe('MF');
});

test('a goalkeeper picked by number alone plays in defence when goal is filled', () => {
  const picked = togglePickedPlayer(game(), 12);
  expect(picked.players[11]!.plays).toBe('DF');
  expect(countedSkill(picked.players[11]!)).toBe(1);
});

test('over eleven picked a reserve is refused, but a picked player still moves', () => {
  const twelve = togglePickedPlayer(game(), 13);
  expect(() => placePickedPlayer(twelve, 12, 'GK')).toThrow(
    'PLAYER NOT IN TEAM'
  );
  expect(placePickedPlayer(twelve, 5, 'FW').players[4]!.plays).toBe('FW');
  expect(() => placePickedPlayer(game(), 14, 'FW')).toThrow(
    'PLAYER NOT AVAILABLE'
  );
  expect(() => placePickedPlayer(game(), 30, 'FW')).toThrow(
    'PLAYER NO. OUT OF RANGE'
  );
});

test('picking a player again starts him back in his position', () => {
  const moved = placePickedPlayer(togglePickedPlayer(game(), 13), 5, 'FW');
  const dropped = togglePickedPlayer(moved, 5);
  expect(playsIn(dropped.players[4]!)).toBeUndefined();
  const back = togglePickedPlayer(dropped, 5);
  expect(back.players[4]!.plays).toBe('MF');
});

test('a shooter is weighted by the skill and line he plays in', () => {
  const players = squad().map(p =>
    p.id === 2 ? p : { ...p, status: p.status === 2 ? (1 as const) : p.status }
  );
  const pushed = placePickedPlayer(
    { ...game(), players: placeAll(players) },
    2,
    'FW'
  );
  // The only picked player, so he shoots; at skill 3 a line up he counts 2.
  expect(pickShooter(createRng(1), pushed.players)).toBe(2);
  const nobody = placePickedPlayer(
    {
      ...game(),
      players: placeAll(players.map(p => (p.id === 2 ? { ...p, skill: 2 } : p)))
    },
    2,
    'FW'
  );
  expect(pickShooter(createRng(1), nobody.players)).toBeUndefined();
});

test('a line answer is a number and a letter, in either case', () => {
  expect(lineAnswer('14A')).toEqual({ id: 14, line: 'FW' });
  expect(lineAnswer('9g')).toEqual({ id: 9, line: 'GK' });
  expect(lineAnswer('14')).toBeUndefined();
  expect(lineAnswer('14X')).toBeUndefined();
  expect(lineAnswer('A14')).toBeUndefined();
});

test('the selection prompt takes a line answer only under natural positions', () => {
  for (const ruleset of ['natural-positions', 'enhanced-14'] as const) {
    const session = createSession(2 ** 24 - 5, 0, ruleset);
    session.advance(5);
    session.skipPause();
    for (const input of ['alex', '1', '1']) {
      submitInput(session, input);
    }
    for (const input of ['99', '', 'c']) {
      submitInput(session, input);
    }
    const before = viewOn(session, 'selection').game;
    const mover = before.players.find(
      p => p.status === 2 && p.position === 'MF'
    )!;
    submitInput(session, `${mover.id}a`);
    const after = viewOn(session, 'selection').game.players[mover.id - 1]!;
    expect(playsIn(after)).toBe(
      ruleset === 'natural-positions' ? 'FW' : undefined
    );
  }
});
