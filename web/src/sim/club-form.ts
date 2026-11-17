import type { Game } from './management';
import { clubForm } from './ruleset';

/** How many of a club's latest league results its form counts (#99). */
export const formLength = 3;

/** A league result for one club: 1 a win, 0 a draw, −1 a loss. */
export const resultValue = (own: number, other: number) =>
  Math.sign(own - other);

/** Every club in a division with no results yet, as at the season start. */
export const freshResults = (): readonly (readonly number[])[] =>
  Array.from({ length: 16 }, () => []);

/**
 * A club's form under club form (#99): the sum of its last three league
 * results, −3 to +3. The managed club, a club outside the managed club's
 * division and every club under other rulesets have none.
 */
export const formOf = (game: Game, club: number) => {
  const index = club - (game.division - 1) * 16 - 1;
  if (
    !clubForm(game.ruleset) ||
    club === game.club ||
    index < 0 ||
    index >= 16
  ) {
    return 0;
  }
  return (game.recentResults?.[index] ?? []).reduce((sum, r) => sum + r, 0);
};

/**
 * How much of a club's form adds to each attribute of its strength. Full
 * form flattened the difficulty curve by 4–6 points of league win rate at
 * either end; half keeps hot and cold opponents felt at about half that.
 */
export const strengthWeight = 0.5;

/** What a club's form adds to each attribute of its strength as an opponent. */
export const formStrength = (game: Game, club: number) =>
  formOf(game, club) * strengthWeight;

/**
 * The division's recent results after a week's league matches, each given
 * as home and away places in the division (0–15) and the score.
 */
export const addResults = (
  recent: readonly (readonly number[])[],
  matches: readonly { away: number; home: number; score: readonly number[] }[]
) => {
  const next = recent.map(results => [...results]);
  const add = (index: number, value: number) => {
    next[index] = [...next[index]!, value].slice(-formLength);
  };
  for (const { away, home, score } of matches) {
    add(home, resultValue(score[0]!, score[1]!));
    add(away, resultValue(score[1]!, score[0]!));
  }
  return next;
};
