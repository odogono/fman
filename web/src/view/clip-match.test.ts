import { expect, test } from 'bun:test';

import type { MatchFixture } from '../sim/league';
import type { Game, Player } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { Position, SquadPlayer } from '../sim/squads';
import {
  clipInputFor,
  clipScriptsFor,
  colourDistance,
  inkColours,
  keeperColours,
  keeperColoursFor,
  opponentEleven
} from './clip-match';

const css = (name: string) => keeperColours.find(c => c.name === name)!.css;

test('goalkeepers wear a colour unlike both kits and each other', () => {
  for (let home = 0; home < 8; home++) {
    for (let away = 0; away < 8; away++) {
      if (
        home === away ||
        home === 4 ||
        home === 6 ||
        away === 4 ||
        away === 6
      ) {
        continue;
      }
      const kits = [inkColours[home]!, inkColours[away]!];
      const keepers = keeperColoursFor(kits[0]!, kits[1]!);
      expect(keepers.home).not.toBe(keepers.away);
      for (const keeper of [keepers.home, keepers.away]) {
        for (const kit of kits) {
          expect(colourDistance(keeper, kit)).toBeGreaterThan(150);
        }
      }
    }
  }
  // Orange is too like red, grey too like white, purple too like blue.
  expect(keeperColoursFor(inkColours[2], inkColours[0]).home).not.toBe(
    css('orange')
  );
  expect(
    Object.values(keeperColoursFor(inkColours[7], inkColours[2]))
  ).not.toContain(css('grey'));
  expect(
    Object.values(keeperColoursFor(inkColours[1], inkColours[3]))
  ).not.toContain(css('purple'));
  // With nothing near it, the home keeper wears the first on the list.
  expect(keeperColoursFor(inkColours[1], inkColours[5]).home).toBe(
    css('orange')
  );
});

const squad = (positions: readonly Position[]): SquadPlayer[] =>
  positions.map((position, i) => ({ name: `S${i}`, position, skill: 3 }));

test('an opponent fields a 4-4-2 in squad order, with the named player', () => {
  const players = squad([
    'GK',
    'GK',
    'DF',
    'DF',
    'DF',
    'DF',
    'DF',
    'MF',
    'MF',
    'MF',
    'MF',
    'MF',
    'FW',
    'FW',
    'FW'
  ]);
  expect(opponentEleven(players)).toEqual([0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13]);
  // The named player takes the place of the last-listed in their position.
  expect(opponentEleven(players, 14)).toEqual([
    0, 2, 3, 4, 5, 7, 8, 9, 10, 12, 14
  ]);
  expect(opponentEleven(players, 6)).toEqual([
    0, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13
  ]);
  // Short of a position, the gap is filled from the rest.
  const few = squad([
    'GK',
    'DF',
    'DF',
    'MF',
    'MF',
    'MF',
    'MF',
    'MF',
    'MF',
    'MF',
    'FW',
    'FW'
  ]);
  expect(opponentEleven(few)).toHaveLength(11);
  expect(opponentEleven(few)).toContain(8);
});

const player = (
  id: number,
  position: Position | undefined,
  picked = true
): Player => ({
  energy: 10,
  id,
  name: `P${id}`,
  ...(position ? { position } : {}),
  skill: 3,
  status: picked ? 2 : 1,
  value: 1000
});

const opponentSquad = squad([
  'GK',
  'DF',
  'DF',
  'DF',
  'DF',
  'MF',
  'MF',
  'MF',
  'MF',
  'FW',
  'FW',
  'FW'
]);
const clubs = Array.from({ length: 64 }, (_, i) => ({
  ink: 0,
  kit: { change: 5, home: i === 0 ? 2 : 1 },
  name: `Club ${i + 1}`,
  ...(i === 1 ? { squad: opponentSquad } : {})
}));
const gameWith = (players: readonly Player[]) =>
  ({ club: 1, clubs, players, seed: 1 }) as unknown as Game;
const fixture = {
  home: true,
  opponent: 2,
  opponentStrength: [7, 10, 10, 10, 10]
} as unknown as MatchFixture;

test('a picked goalkeeper keeps goal; without one, the first-picked defender', () => {
  const players = [
    player(1, 'DF'),
    player(2, 'GK'),
    player(3, 'MF'),
    player(4, 'FW'),
    player(5, 'GK', false)
  ];
  const moment: Moment = { kind: 'goal', minute: 10, player: 4, side: 'club' };
  const withKeeper = clipInputFor(gameWith(players), fixture, moment, 0);
  const keeper = withKeeper.attack.players.find(p => p.line === 'keeper');
  expect(keeper?.label).toBe('P2');
  expect(withKeeper.attack.players).toHaveLength(4);
  expect(withKeeper.attack.players[withKeeper.shooter]!.label).toBe('P4');

  const noKeeper = clipInputFor(
    gameWith([
      player(1, 'MF'),
      player(2, 'DF'),
      player(3, 'DF'),
      player(4, 'FW')
    ]),
    fixture,
    moment,
    0
  );
  expect(noKeeper.attack.players.find(p => p.line === 'keeper')?.label).toBe(
    'P2'
  );
  // A player with no position plays in midfield.
  const unplaced = clipInputFor(
    gameWith([player(1, 'GK'), player(2, undefined), player(4, 'FW')]),
    fixture,
    moment,
    0
  );
  expect(unplaced.attack.players.find(p => p.label === 'P2')?.line).toBe(
    'midfield'
  );
});

test('a goalkeeper who shoots plays up front, and another keeps goal', () => {
  const moment: Moment = { kind: 'goal', minute: 10, player: 2, side: 'club' };
  const input = clipInputFor(
    gameWith([player(1, 'DF'), player(2, 'GK'), player(3, 'MF')]),
    fixture,
    moment,
    0
  );
  expect(input.attack.players[input.shooter]).toEqual({
    energy: 10,
    label: 'P2',
    line: 'attack'
  });
  expect(input.attack.players.find(p => p.line === 'keeper')?.label).toBe('P1');
});

test('an opponent moment names its shooter from the squad, and the sides change ends', () => {
  const players = [player(1, 'GK'), player(2, 'DF'), player(3, 'FW')];
  const game = gameWith(players);
  const first: Moment = {
    kind: 'save',
    minute: 30,
    side: 'opponent',
    squadPlayer: 11
  };
  const input = clipInputFor(game, fixture, first, 2);
  expect(input.attack.players).toHaveLength(11);
  expect(input.attack.players[input.shooter]!.label).toBe('S11');
  expect(input.attack.kit).toBe(inkColours[1]);
  expect(input.defence.kit).toBe(inkColours[2]);
  // The away side shoots down the screen before half-time, up after.
  expect(input.attackingUp).toBe(false);
  expect(
    clipInputFor(game, fixture, { ...first, minute: 46 }, 2).attackingUp
  ).toBe(true);
  expect(
    clipInputFor(
      game,
      fixture,
      { kind: 'goal', minute: 30, player: 3, side: 'club' },
      0
    ).attackingUp
  ).toBe(true);
});

test("a clip's seed comes from the match and the moment, never the game's random numbers", () => {
  const players = [player(1, 'GK'), player(2, 'DF'), player(3, 'FW')];
  const moments: Moment[] = [
    { kind: 'goal', minute: 12, player: 3, side: 'club' },
    { kind: 'near-miss', minute: 70, side: 'opponent', squadPlayer: 9 }
  ];
  const a = clipScriptsFor(gameWith(players), fixture, moments);
  const reseeded = { ...gameWith(players), seed: 999 } as Game;
  const b = clipScriptsFor(reseeded, fixture, moments);
  expect(b.map(s => s.length)).toEqual(a.map(s => s.length));
  expect(b[0]!.input.seed).toBe(a[0]!.input.seed);
  expect(a[1]!.input.seed).not.toBe(a[0]!.input.seed);
  // Its place in the list counts too.
  expect(
    clipInputFor(gameWith(players), fixture, moments[0]!, 1).seed
  ).not.toBe(a[0]!.input.seed);
});

test("picked players carry their own energy, an opponent's the side's team Energy", () => {
  const players = [{ ...player(1, 'GK'), energy: 4 }, player(2, 'FW')];
  const moment: Moment = { kind: 'goal', minute: 70, player: 2, side: 'club' };
  const input = clipInputFor(gameWith(players), fixture, moment, 0);
  expect(input.attack.players.map(p => p.energy)).toEqual([4, 10]);
  expect(new Set(input.defence.players.map(p => p.energy))).toEqual(
    new Set([7])
  );
});
