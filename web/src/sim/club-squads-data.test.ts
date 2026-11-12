import { expect, test } from 'bun:test';

import { presentDayClubs } from './catalogue';
import data from './data/club-squads.json';
import { nameBytes } from './names';

// The invented players of `club-squads` (#113, ADR 0012), written by
// `tools/squads/generate.ts`. The file is frozen once its Enhanced version
// ships.

const count = (players: readonly { position: string }[]) =>
  Object.fromEntries(
    ['GK', 'DF', 'MF', 'FW'].map(position => [
      position,
      players.filter(player => player.position === position).length
    ])
  );

const players = [...data.freeAgents, ...Object.values(data.squads).flat()];

test('every present-day club owns a squad of 1/4/4/3', () => {
  expect(Object.keys(data.squads).sort()).toEqual(
    presentDayClubs.map(club => club.name).sort()
  );
  for (const squad of Object.values(data.squads)) {
    expect(count(squad)).toEqual({ DF: 4, FW: 3, GK: 1, MF: 4 });
  }
});

test('there are 128 free agents: 8 goalkeepers and 40 of each other position', () => {
  expect(count(data.freeAgents)).toEqual({ DF: 40, FW: 40, GK: 8, MF: 40 });
});

test('every name fits the original eight characters of printable Spectrum text', () => {
  for (const { name } of players) {
    expect(name.length).toBeGreaterThan(0);
    expect(name.length).toBeLessThanOrEqual(8);
    for (const byte of nameBytes(name)) {
      expect(byte).toBeGreaterThanOrEqual(32);
      expect(byte).toBeLessThan(127);
    }
  }
});

test('all 896 names are unique', () => {
  expect(players).toHaveLength(896);
  expect(new Set(players.map(player => player.name)).size).toBe(896);
});
