/**
 * Named sets of game rules (ADR 0007). `original` holds rules parity and is
 * the default; every other ruleset is an experimental variation measured
 * against it with the gameplay baseline.
 */
export const rulesets = ['original', 'even-difficulty'] as const;
export type Ruleset = (typeof rulesets)[number];

export const isRuleset = (value: unknown): value is Ruleset =>
  rulesets.includes(value as Ruleset);

/**
 * `even-difficulty` narrows the step between levels so that Genius plays like
 * the original's level 4. The steps shrink as the bonus grows, because each
 * extra point of opponent strength costs more league places than the last;
 * tuned against the gameplay baseline so balanced play loses about the same
 * ground at every level. Values are quarters, so the league's Spectrum
 * arithmetic stays exact.
 */
const evenDifficultyBonus = [1, 2, 2.75, 3, 3.5, 3.75, 4] as const;

/**
 * What the difficulty level adds to each of an opponent's five strength
 * attributes before the sum is floored and clamped to 1–20.
 */
export const opponentBonus = (ruleset: Ruleset, level: number) =>
  ruleset === 'original' ? level : evenDifficultyBonus[level - 1]!;
