import { expect, test } from 'bun:test';

import { injuryBand, refreshPlayers } from './cup';
import {
  createNewGame,
  makeSaleOffer,
  respondToSale,
  type Game,
  type Player
} from './management';
import { createMatchday, type Matchday } from './matchday';
import { createRng } from './rng';
import { presentDay, tiringInjuries, type Ruleset } from './ruleset';
import { decodeSave, encodeSave } from './save';
import { completeSeason } from './season';

const fresh = (ruleset: Ruleset, seed = 0): Game =>
  createNewGame({
    club: 1,
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed
  });

/** A game past its first week, so the refresh runs, with every player owned. */
const squad = (
  ruleset: Ruleset,
  seed: number,
  player: (p: Player, index: number) => Partial<Player>
): Game => {
  const game = fresh(ruleset, seed);
  return {
    ...game,
    leagueMatches: 2,
    players: game.players.map((p, i) => ({ ...p, ...player(p, i) })),
    seed
  };
};

/** The rolls the refresh draws: one R(20) per player, in squad order. */
const rolls = (seed: number) => {
  const rng = createRng(seed);
  return Array.from({ length: 24 }, () => rng.int(1, 20));
};

/** Injures a new squad's one reserve for three weeks. */
const injure = (game: Game): Game => ({
  ...game,
  players: game.players.map(p =>
    p.status === 1 ? { ...p, status: 3, weeksOut: 3 } : p
  )
});

/** A finished season with three injured players. */
const seasonEnd = (ruleset: Ruleset): Game => {
  const game = fresh(ruleset, 9);
  return {
    ...game,
    club: 24,
    cupFinished: true,
    cupRound: 3,
    division: 2,
    league: game.league.map((r, i) => ({ ...r, position: i + 1 })),
    leagueMatches: 15,
    leaguePosition: 8,
    players: game.players.map((p, i) =>
      i < 3
        ? {
            ...p,
            status: 3,
            ...(ruleset === 'original' ? {} : { weeksOut: 3 })
          }
        : p
    )
  };
};

/** A squad whose third player is set as given. */
const withThird = (ruleset: Ruleset, player: Partial<Player>) =>
  squad(ruleset, 4, (_, i) => (i === 2 ? player : {}));

test('Enhanced has lasting injuries from version 5', () => {
  expect(tiringInjuries('enhanced-5')).toBe(true);
  for (const ruleset of [
    'original',
    'enhanced-1',
    'enhanced-2',
    'enhanced-3',
    'enhanced-4'
  ] as const) {
    expect(tiringInjuries(ruleset)).toBe(false);
  }
});

test('players tire and reserves recover as in the original; injured players recover nothing', () => {
  const before = squad('enhanced-5', 5, (_, i) => ({
    energy: 12,
    status: i < 8 ? 2 : i < 16 ? 1 : 3,
    ...(i >= 16 ? { weeksOut: 3 } : {})
  }));
  const after = refreshPlayers(before);
  after.players.forEach((p, i) => {
    expect(p.energy).toBe(i < 8 ? 11 : i < 16 ? 20 : 12);
  });
  const original = refreshPlayers({ ...before, ruleset: 'original' });
  expect(original.players.slice(16).map(p => p.energy)).toEqual(
    Array.from({ length: 8 }, () => 20)
  );
});

test('the injury band widens as energy falls', () => {
  expect([20, 16, 15, 11, 10, 6, 5, 1].map(injuryBand)).toEqual([
    1, 1, 1, 1, 2, 2, 3, 3
  ]);
});

test('a roll in the band injures, for as many weeks as it lands in', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    // Picked players lose 1, landing in each band in turn.
    const energies = [2, 7, 12, 17];
    const before = squad('enhanced-5', seed, (_, i) => ({
      energy: energies[i % 4]!,
      status: 2
    }));
    const after = refreshPlayers(before);
    const drawn = rolls(seed);
    after.players.forEach((p, i) => {
      const band = injuryBand(p.energy);
      const roll = drawn[i]!;
      if (roll > 20 - band) {
        const weeks = roll - (20 - band);
        expect(p).toMatchObject({ status: 3, weeksOut: weeks });
        seen.add(`${band}:${weeks}`);
      } else {
        expect(p.status).toBe(2);
        expect(p.weeksOut).toBeUndefined();
      }
    });
  }
  expect([...seen].sort()).toEqual(['1:1', '2:1', '2:2', '3:1', '3:2', '3:3']);
});

test('a fresh player is injured on a 20 for one week, as in the original', () => {
  for (let seed = 0; seed < 200; seed++) {
    const before = squad('enhanced-5', seed, () => ({
      energy: 10,
      status: 1
    }));
    const tiring = refreshPlayers(before);
    const original = refreshPlayers({ ...before, ruleset: 'original' });
    tiring.players.forEach((p, i) => {
      expect(p.energy).toBe(20);
      expect(p.status).toBe(original.players[i]!.status);
      expect(p.weeksOut).toBe(p.status === 3 ? 1 : undefined);
    });
  }
});

test('the refresh draws the same numbers as the original', () => {
  for (let seed = 0; seed < 200; seed++) {
    const before = squad('enhanced-5', seed, (p, i) => ({
      energy: (i % 20) + 1,
      status: i < 11 ? 2 : i < 14 ? 1 : i < 17 ? 3 : 0,
      ...(i >= 14 && i < 17 ? { weeksOut: (i % 3) + 1 } : {})
    }));
    expect(refreshPlayers(before).seed).toBe(
      refreshPlayers({ ...before, ruleset: 'original' }).seed
    );
  }
});

test('an injury counts down across league matches, cup legs and replays', () => {
  // The one reserve in a new squad is the player injured.
  const reserve = fresh('enhanced-5').players.find(p => p.status === 1)!;
  const weeksLeft = (matchday: Matchday) =>
    matchday.game.players[reserve.id - 1]!.weeksOut;

  // The season's first league match has no refresh, as in the original.
  const league = createMatchday(
    injure({
      ...fresh('enhanced-5'),
      leagueMatches: 1,
      scheduleCounter: 3
    })
  )!;
  expect(league.fixture.kind).toBe('league');
  league.refresh();
  expect(weeksLeft(league)).toBe(2);

  for (let seed = 0; seed < 2000; seed++) {
    const cup = createMatchday(
      injure({
        ...fresh('enhanced-5'),
        cupRound: 1,
        leagueMatches: 3,
        scheduleCounter: 5,
        seed
      })
    )!;
    expect(cup.fixture.kind).toBe('cup');
    cup.refresh();
    expect(weeksLeft(cup)).toBe(2);
    cup.kickOff();
    cup.advance(1_000_000);
    const score = cup.score!;
    if (score[0] !== score[1]) {
      continue;
    }
    cup.settle();
    cup.replay();
    cup.refresh();
    expect(weeksLeft(cup)).toBe(1);
    return;
  }
  throw new Error('No drawn cup tie found');
});

test('an injury with one week left heals to the reserves', () => {
  const before = squad('enhanced-5', 3, (_, i) => ({
    energy: 5,
    status: i < 12 ? 3 : 0,
    ...(i < 6 ? { weeksOut: 1 } : {})
  }));
  for (const p of refreshPlayers(before).players.slice(0, 12)) {
    expect(p.status).toBe(1);
    expect(p.weeksOut).toBeUndefined();
  }
});

test('every injury heals at the season end', () => {
  const tiring = completeSeason(seasonEnd('enhanced-5')).game;
  const original = completeSeason(seasonEnd('original')).game;
  expect(tiring.seed).toBe(original.seed);
  tiring.players.slice(0, 3).forEach((p, i) => {
    expect(p.status).toBe(1);
    expect(p.weeksOut).toBeUndefined();
    expect(p.energy).toBe(original.players[i]!.energy);
  });
  expect(original.players.slice(0, 3).map(p => p.status)).toEqual([3, 3, 3]);
});

test('refusing a sale offer still injures 2 times in 3, for one week', () => {
  let injured = 0;
  const runs = 600;
  for (let seed = 0; seed < runs; seed++) {
    const game = { ...fresh('enhanced-5'), seed };
    const id = game.players.find(p => p.status === 1)!.id;
    const offer = makeSaleOffer(game, id);
    const refused = respondToSale(offer.game, offer, false);
    const original = respondToSale(
      { ...offer.game, ruleset: 'original' },
      offer,
      false
    );
    const player = refused.players[id - 1]!;
    expect(player.status).toBe(original.players[id - 1]!.status);
    expect(refused.seed).toBe(original.seed);
    if (player.status === 3) {
      injured++;
      expect(player.weeksOut).toBe(1);
    }
  }
  expect(injured / runs).toBeCloseTo(2 / 3, 1);
});

test('a save mid-injury keeps the weeks left', () => {
  const game = squad('enhanced-5', 4, (_, i) =>
    i === 2 ? { status: 3, weeksOut: 2 } : {}
  );
  expect(decodeSave(encodeSave(game, 100)).game).toEqual(game);
});

test('weeks out are only valid on an injured player under tiring injuries', () => {
  for (const game of [
    withThird('original', { status: 3, weeksOut: 2 }),
    withThird('enhanced-5', { status: 1, weeksOut: 2 }),
    withThird('enhanced-5', { status: 3, weeksOut: 4 })
  ]) {
    expect(() => decodeSave(encodeSave(game, 100))).toThrow(RangeError);
  }
});
