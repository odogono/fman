import { expect, test } from 'bun:test';

import { createNewGame, type Game } from './management';
import { ruleData, type RuleData } from './rule-data';
import { latestEnhanced, presentDay, type Ruleset } from './ruleset';
import { saveVersion, savedGame } from './save';

const newGame = (ruleset: Ruleset) =>
  createNewGame({
    club: 1,
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed: 1
  });

/**
 * A game under the latest Enhanced rules carrying every rule's data: club
 * squads and kits come with a new game, a grace period and weeks out come
 * during play.
 */
const injured = (game: Game): Game => ({
  ...game,
  players: game.players.map((player, i) =>
    i === 0 ? { ...player, status: 3, weeksOut: 2 } : player
  )
});
const enhanced: Game = injured({ ...newGame(latestEnhanced), graceWeeks: 2 });

/**
 * For each rule with a save version, the first game to carry its data and
 * no data from a later rule.
 */
const firstCarrying: Readonly<Record<string, Game>> = {
  clubSquads: newGame('enhanced-6'),
  gracePeriod: { ...newGame('enhanced-2'), graceWeeks: 2 },
  tiringInjuries: injured(newGame('enhanced-5'))
};

type Saved = Record<string, unknown>;

/** `to` with the fields `rule` owns taken from `from`, at every level. */
const withRuleData = (to: Game, from: Game, rule: RuleData): Saved => {
  const take = (into: Saved, source: Saved, keys: readonly string[] = []) => {
    const out = { ...into };
    for (const key of keys) {
      if (key in source) {
        out[key] = source[key];
      } else {
        delete out[key];
      }
    }
    return out;
  };
  return {
    ...take(to, from, rule.game?.keys),
    clubs: to.clubs.map((club, i) =>
      take(club, from.clubs[i]!, rule.club?.keys)
    ),
    players: to.players.map((player, i) =>
      take(player, from.players[i]!, rule.player?.keys)
    )
  };
};

for (const [name, rule] of Object.entries(ruleData)) {
  test(`${name}: its data loads only under a ruleset with the rule`, () => {
    expect(rule.on(latestEnhanced)).toBe(true);
    expect(rule.on('original')).toBe(false);
    expect(savedGame(enhanced, saveVersion)).toEqual(enhanced);
    const original = newGame('original');
    expect(savedGame(original, saveVersion)).toEqual(original);
    expect(
      savedGame(withRuleData(original, enhanced, rule), saveVersion)
    ).toBeUndefined();
  });

  if (rule.since !== undefined) {
    const { since } = rule;
    test(`${name}: a save older than version ${since} never carries its data`, () => {
      const carrying = firstCarrying[name]!;
      expect(savedGame(carrying, since)).toEqual(carrying);
      expect(savedGame(carrying, since - 1)).toBeUndefined();
    });
  }
}
