import { expect, test } from 'bun:test';

import squads from '../../web/src/sim/data/club-squads.json';
import { generateSquads } from './generate';
import overrides from './overrides.json';
import { surnames } from './surnames';

test('the checked-in squads are what the script writes', () => {
  expect(generateSquads()).toEqual(squads as ReturnType<typeof generateSquads>);
});

test('every surname has at most six letters and appears once', () => {
  for (const surname of surnames) {
    expect(surname).toMatch(/^[A-Z][A-Za-z]{1,5}$/);
  }
  expect(new Set(surnames).size).toBe(surnames.length);
});

test('every override replaces a name the script draws', () => {
  const players = [
    ...squads.freeAgents,
    ...Object.values(squads.squads).flat()
  ].map(player => player.name);
  for (const [drawn, name] of Object.entries(
    overrides as Record<string, string>
  )) {
    expect(players).not.toContain(drawn);
    expect(players).toContain(name);
  }
});
