import {
  clubs,
  playerNames,
  presentDayClubs,
  presentDayPlayerNames
} from './catalogue';

/**
 * Named sets of game rules (ADR 0007, ADR 0009), each with the clubs and
 * players a new game starts with (ADR 0011). `original` holds rules
 * parity. Enhanced rules are released in versions (`enhanced-1`, …): each
 * gathers the accepted rule changes, and a game keeps the version it started
 * with, so every released version stays playable. An experimental ruleset
 * carries one change alone while it is measured against the original, and is
 * retired once the change joins Enhanced (`even-difficulty`, `grace-period`).
 * `lasting-skill` (#72) is being measured.
 */
export const rulesets = [
  'original',
  'enhanced-1',
  'enhanced-2',
  'enhanced-3',
  'lasting-skill'
] as const;
export type Ruleset = (typeof rulesets)[number];

/** The Enhanced version every new Enhanced game starts with. */
export const latestEnhanced = 'enhanced-3' satisfies Ruleset;

export const isRuleset = (value: unknown): value is Ruleset =>
  rulesets.includes(value as Ruleset);

/** The rule changes each ruleset makes to the original. */
const changes: Record<
  Ruleset,
  {
    gracePeriod: boolean;
    lastingSkill: boolean;
    presentDay: boolean;
    smoothDifficulty: boolean;
  }
> = {
  'enhanced-1': {
    gracePeriod: false,
    lastingSkill: false,
    presentDay: false,
    smoothDifficulty: true
  },
  'enhanced-2': {
    gracePeriod: true,
    lastingSkill: false,
    presentDay: false,
    smoothDifficulty: true
  },
  'enhanced-3': {
    gracePeriod: true,
    lastingSkill: false,
    presentDay: true,
    smoothDifficulty: true
  },
  'lasting-skill': {
    gracePeriod: false,
    lastingSkill: true,
    presentDay: false,
    smoothDifficulty: false
  },
  original: {
    gracePeriod: false,
    lastingSkill: false,
    presentDay: false,
    smoothDifficulty: false
  }
};

/**
 * Whether the ruleset starts with the present-day clubs and players (#91),
 * whose clubs wear their own kits, so a new game asks no colour question.
 */
export const presentDay = (ruleset: Ruleset) => changes[ruleset].presentDay;

/** The clubs a new game starts with, in their original slot order. */
export const startingClubs = (ruleset: Ruleset) =>
  presentDay(ruleset) ? presentDayClubs : clubs;

/** The players a new game starts with: defence, midfield, then attack. */
export const startingPlayerNames = (ruleset: Ruleset): readonly string[] =>
  presentDay(ruleset) ? presentDayPlayerNames : playerNames;

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
  changes[ruleset].smoothDifficulty ? smoothDifficultyBonus[level - 1]! : level;

/**
 * How many weeks of bills a club over its credit limit has to get back under
 * it before dismissal (#74, measured as `grace-period`), or `undefined` when the ruleset dismisses at once
 * as the original does.
 */
export const gracePeriodWeeks = (ruleset: Ruleset) =>
  changes[ruleset].gracePeriod ? 4 : undefined;

/**
 * Whether owned players keep their skill at the season end, moving by skill
 * drift of −1, 0 or +1 within 1–5, instead of rerolling it as the original
 * does (#72, measured as `lasting-skill`). Unowned players still reroll.
 */
export const lastingSkill = (ruleset: Ruleset) => changes[ruleset].lastingSkill;
