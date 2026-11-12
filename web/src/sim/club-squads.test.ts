import { expect, test } from 'bun:test';

import data from './data/club-squads.json';
import { teamStrength } from './league';
import {
  createNewGame,
  respondToSale,
  type Game,
  type SaleOffer
} from './management';
import { renameClub } from './names';
import { decodeSave, encodeSave, saveLimit, savedGame } from './save';
import { completeSeason } from './season';
import { playerCategory } from './squads';

// Club squads (#113, ADR 0012), measured as `club-squads`: `enhanced-5` with
// every club owning a squad and the managed club's squad and transfer list in
// the original's 24 numbered places.

const start = (seed: number, ruleset: 'club-squads' | 'enhanced-5') =>
  createNewGame({ club: 5, level: 3, manager: 'Test', ruleset, seed });

/** The same game as `enhanced-5` would hold it, without squads. */
const withoutSquads = (game: Game): Game => {
  const { freeAgents: _, squadSeed: __, ...rest } = game;
  return {
    ...rest,
    clubs: game.clubs.map(({ squad: _, ...club }) => club),
    players: game.players.map(({ position: _, ...player }) => player),
    ruleset: 'enhanced-5'
  };
};

const numbers = (game: Game) =>
  game.players.map(({ energy, skill, status, value }) => ({
    energy,
    skill,
    status,
    value
  }));

const allNames = (game: Game) => [
  ...game.players.map(p => p.name),
  ...game.freeAgents!.map(p => p.name),
  ...game.clubs.flatMap(club => club.squad ?? []).map(p => p.name)
];

test('a new game makes the same RND draws as enhanced-5', () => {
  for (const seed of [0, 1, 777, 40_000, 65_535]) {
    const squads = start(seed, 'club-squads');
    const plain = start(seed, 'enhanced-5');
    expect(squads.seed).toBe(plain.seed);
    expect(numbers(squads)).toEqual(numbers(plain));
  }
});

test("the managed club's squad is its own 12, and free agents fill the other places", () => {
  const game = start(777, 'club-squads');
  const club = game.clubs[game.club - 1]!;
  expect(club.squad).toBeUndefined();
  const own = data.squads[club.name as keyof typeof data.squads];
  const owned = game.players.filter(p => p.status > 0);
  expect(owned.map(p => p.name).sort()).toEqual(own.map(p => p.name).sort());
  const freeNames = new Set(data.freeAgents.map(p => p.name));
  for (const player of game.players.filter(p => p.status === 0)) {
    expect(freeNames.has(player.name)).toBe(true);
  }
  expect(game.freeAgents).toHaveLength(116);
  for (const [i, other] of game.clubs.entries()) {
    if (i + 1 !== game.club) {
      expect(other.squad).toHaveLength(12);
    }
  }
  expect(new Set(allNames(game)).size).toBe(896);
});

test('the reserve can be any of the squad, not always the same position', () => {
  const reserves = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    const game = start(seed, 'club-squads');
    reserves.add(game.players.find(p => p.status === 1)!.position!);
  }
  expect(reserves).toEqual(new Set(['GK', 'DF', 'MF', 'FW']));
});

test('team strength counts a player by his position, and a goalkeeper as a defender', () => {
  const game = start(777, 'club-squads');
  const picked = game.players.filter(p => p.status === 2);
  const sum = (category: number) =>
    picked
      .filter(p => playerCategory(p) === category)
      .reduce((total, p) => total + p.skill, 0);
  const strength = teamStrength(game);
  for (const category of [0, 1, 2]) {
    expect(strength[category + 2]).toBe(
      Math.max(1, Math.min(20, sum(category)))
    );
  }
  expect(playerCategory({ ...picked[0]!, position: 'GK' })).toBe(0);
});

const offerFor = (game: Game, buyerId: number): SaleOffer => ({
  amount: 1000,
  buyer: game.clubs[buyerId - 1]!.name,
  buyerId,
  game,
  playerId: game.players.find(p => p.status === 1 || p.status === 2)!.id
});

const sell = (game: Game, buyerId: number) => {
  const offer = offerFor(game, buyerId);
  return {
    player: game.players[offer.playerId - 1]!,
    sold: respondToSale(game, offer, true)
  };
};

test('a sold player joins the buying club, and a free agent takes his place', () => {
  const game = start(777, 'club-squads');
  const { player, sold } = sell(game, 3);
  const plain = withoutSquads(game);
  expect(sold.seed).toBe(respondToSale(plain, offerFor(plain, 3), true).seed);
  expect(sold.cash).toBe(game.cash + 1000);
  expect(sold.clubs[2]!.squad!.at(-1)).toEqual({
    name: player.name,
    position: player.position!,
    skill: player.skill
  });
  const place = sold.players[player.id - 1]!;
  expect(place.status).toBe(0);
  expect(place.name).not.toBe(player.name);
  expect(game.freeAgents!.map(p => p.name)).toContain(place.name);
  expect(sold.freeAgents).toHaveLength(115);
  expect(sold.squadSeed).not.toBe(game.squadSeed);
  expect(new Set(allNames(sold)).size).toBe(896);
});

test('a player sold to the managed club itself stays in his place as a listed free agent', () => {
  const game = start(777, 'club-squads');
  const { player, sold } = sell(game, game.club);
  expect(sold.players[player.id - 1]).toEqual({ ...player, status: 0 });
  expect(sold.clubs).toEqual(game.clubs);
  expect(sold.freeAgents).toEqual(game.freeAgents!);
  expect(sold.squadSeed).toBe(game.squadSeed!);
});

const seasonOver = (game: Game): Game => ({
  ...game,
  cupFinished: true,
  league: game.league.map((record, i) => ({ ...record, position: i + 1 })),
  leagueMatches: 15
});

test('the season end makes the same RND draws as enhanced-5', () => {
  const game = seasonOver(start(777, 'club-squads'));
  const squads = completeSeason(game).game;
  const plain = completeSeason(withoutSquads(game)).game;
  expect(squads.seed).toBe(plain.seed);
  expect(numbers(squads)).toEqual(numbers(plain));
});

test('at the season end clubs release their newest signings back to twelve', () => {
  const { player, sold } = sell(start(777, 'club-squads'), 3);
  const next = completeSeason(seasonOver(sold)).game;
  expect(next.clubs[2]!.squad).toHaveLength(12);
  expect(next.clubs[2]!.squad!.map(p => p.name)).not.toContain(player.name);
  expect(allNames(next)).toContain(player.name);
  expect(new Set(allNames(next)).size).toBe(896);
});

const listed = (game: Game) =>
  game.players.filter(p => p.status === 0).map(p => p.name);

test('at the season end the transfer list is drawn again from the free agents', () => {
  const game = start(777, 'club-squads');
  const next = completeSeason(seasonOver(game)).game;
  expect(listed(next)).toHaveLength(listed(game).length);
  expect(listed(next)).not.toEqual(listed(game));
  for (const [i, player] of next.players.entries()) {
    if (player.status > 0) {
      expect(player.name).toBe(game.players[i]!.name);
    }
  }
});

test("other clubs' players drift under lasting skill", () => {
  const game = start(777, 'club-squads');
  const next = completeSeason(seasonOver(game)).game;
  // Promotion and relegation move clubs between slots, squads and all.
  const byName = new Map(next.clubs.map(club => [club.name, club]));
  for (const club of game.clubs) {
    for (const [j, player] of (club.squad ?? []).entries()) {
      const after = byName.get(club.name)!.squad![j]!;
      expect(after.name).toBe(player.name);
      expect(Math.abs(after.skill - player.skill)).toBeLessThanOrEqual(1);
    }
  }
});

test('a renamed club keeps its squad', () => {
  const game = start(777, 'club-squads');
  const renamed = renameClub(game, 3, 'Rovers');
  expect(renamed.clubs[2]!.squad).toEqual(game.clubs[2]!.squad!);
});

test('a club-squads game saves and loads within the save limit', () => {
  const { sold } = sell(start(777, 'club-squads'), 3);
  const data = encodeSave(sold, 0);
  expect(data.length).toBeLessThan(saveLimit / 3);
  expect(decodeSave(data).game).toEqual(sold);
  expect(savedGame(JSON.parse(data).game, 10)).toBeUndefined();
});

test('saves reject squads under a ruleset without them', () => {
  const game = start(777, 'club-squads');
  expect(savedGame({ ...game, ruleset: 'enhanced-5' }, 11)).toBeUndefined();
  expect(savedGame(withoutSquads(game), 11)).toEqual(withoutSquads(game));
});
