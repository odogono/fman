/**
 * Named sets of game rules (ADR 0007, ADR 0009). `original` holds rules
 * parity. Enhanced rules are released in versions (`enhanced-1`, …): each
 * gathers the accepted rule changes, and a game keeps the version it started
 * with, so every released version stays playable. Experimental rulesets,
 * which carry one change while it is measured, would sit here too.
 */
export const rulesets = ['original', 'enhanced-1'] as const;
export type Ruleset = (typeof rulesets)[number];

/** The Enhanced version every new Enhanced game starts with. */
export const latestEnhanced = 'enhanced-1' satisfies Ruleset;

export const isRuleset = (value: unknown): value is Ruleset =>
  rulesets.includes(value as Ruleset);

/**
 * The smoother difficulty curve (#73, measured as `even-difficulty`) narrows
 * the step between levels so that Genius plays like the original's level 4.
 * The steps shrink as the bonus grows, because each extra point of opponent
 * strength costs more league places than the last; tuned against the gameplay
 * baseline so balanced play loses about the same ground at every level.
 * Values are quarters, so the league's Spectrum arithmetic stays exact.
 */
const smoothDifficultyBonus = [1, 2, 2.75, 3, 3.5, 3.75, 4] as const;

/**
 * What the difficulty level adds to each of an opponent's five strength
 * attributes before the sum is floored and clamped to 1–20.
 */
export const opponentBonus = (ruleset: Ruleset, level: number) =>
  ruleset === 'original' ? level : smoothDifficultyBonus[level - 1]!;
