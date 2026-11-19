import type { Game } from './management';
import { evenTable, squadStrength } from './ruleset';
import { positionCategory, type SquadPlayer } from './squads';

/** How much of a squad's category sum counts in an opponent's attribute. */
export const squadWeight = 1 / 2;

/**
 * The roll each squad attribute keeps, `R(squadRoll)`, in place of `R(14)`.
 * Tuned so an opponent's mean strength stays as `enhanced-12` has it
 * (`INT(sum / 2)` averages about 5.75 and `R(3)` 2, against `R(14)`'s 7.5),
 * and so clubs differ more than one club's matches do.
 */
export const squadRoll = 3;

/** The squad-strength gap worth one goal in the week's other results. */
export const goalGap = 8;

/**
 * A squad's defence, midfield and attack: the sum of its players' skill in
 * each playing category, a goalkeeper counted in defence (#119).
 */
export const categorySums = (squad: readonly SquadPlayer[]) => {
  const sums = [0, 0, 0];
  for (const player of squad) {
    const category = positionCategory(player.position);
    sums[category] = sums[category]! + player.skill;
  }
  return sums;
};

/**
 * A club's squad strength as one number: the mean of its category sums,
 * each capped at 20 as an attribute is, so 4–20 for a squad of 12.
 */
export const squadMean = (squad: readonly SquadPlayer[]) =>
  categorySums(squad).reduce((sum, s) => sum + Math.min(20, s), 0) / 3;

/**
 * What an opponent's squad gives each of its five attributes before the
 * roll, bonus, points per match and form: nothing for energy and morale,
 * and `INT(sum × squadWeight)` for defence, midfield and attack. Undefined
 * under rulesets without squad strength, or for a club with no squad.
 */
export const squadTerms = (game: Game, club: number) => {
  const squad = game.clubs[club - 1]?.squad;
  if (!squadStrength(game.ruleset) || !squad) {
    return undefined;
  }
  const sums = categorySums(squad);
  return [
    0,
    0,
    ...sums.map(sum => Math.floor(Math.min(20, sum) * squadWeight))
  ];
};

/**
 * One attribute's roll and squad term. Without a squad term it is the
 * original's roll, `R(14)` in the league or `R(16)` in the cup. With one,
 * the squad's share plus a roll kept the same distance from `squadRoll`:
 * `R(3)` in the league, `R(5)` in the cup. One draw either way, so later
 * draws stay in step.
 */
export const rolledAttribute = (
  int: (min: number, max: number) => number,
  terms: readonly number[] | undefined,
  index: number,
  roll: number
) =>
  terms && index >= 2
    ? terms[index]! + int(1, squadRoll + roll - 14)
    : int(1, roll);

/**
 * What the squad-strength gap adds to a side's goals in the week's other
 * results, or 0 under rulesets without squad strength.
 */
export const squadGoals = (game: Game, own: number, other: number) => {
  const a = game.clubs[own - 1]?.squad;
  const b = game.clubs[other - 1]?.squad;
  if (!squadStrength(game.ruleset) || !a || !b) {
    return 0;
  }
  // Under an even table (#218), the gap moves them half as much.
  return (
    (squadMean(a) - squadMean(b)) /
    (evenTable(game.ruleset) ? 2 * goalGap : goalGap)
  );
};
