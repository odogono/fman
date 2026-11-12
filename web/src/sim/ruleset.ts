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
 * carries one change alone while it is measured against the original
 * (`moment-highlights`), and is retired once the change joins Enhanced (`even-difficulty`, `grace-period`,
 * `lasting-skill`, `steep-difficulty`, `tiring-injuries`).
 */
export const rulesets = [
  'original',
  'enhanced-1',
  'enhanced-2',
  'enhanced-3',
  'enhanced-4',
  'enhanced-5',
  'moment-highlights'
] as const;
export type Ruleset = (typeof rulesets)[number];

/** The Enhanced version every new Enhanced game starts with. */
export const latestEnhanced = 'enhanced-5' satisfies Ruleset;

export const isRuleset = (value: unknown): value is Ruleset =>
  rulesets.includes(value as Ruleset);

/** The difficulty curves: what each level adds to an opponent's strength. */
type Difficulty = 'original' | 'smooth' | 'steep';

/** The rule changes each ruleset makes to the original. */
const changes: Record<
  Ruleset,
  {
    difficulty: Difficulty;
    gracePeriod: boolean;
    lastingSkill: boolean;
    momentHighlights: boolean;
    presentDay: boolean;
    tiringInjuries: boolean;
  }
> = {
  'enhanced-1': {
    difficulty: 'smooth',
    gracePeriod: false,
    lastingSkill: false,
    momentHighlights: false,
    presentDay: false,
    tiringInjuries: false
  },
  'enhanced-2': {
    difficulty: 'smooth',
    gracePeriod: true,
    lastingSkill: false,
    momentHighlights: false,
    presentDay: false,
    tiringInjuries: false
  },
  'enhanced-3': {
    difficulty: 'smooth',
    gracePeriod: true,
    lastingSkill: false,
    momentHighlights: false,
    presentDay: true,
    tiringInjuries: false
  },
  'enhanced-4': {
    difficulty: 'steep',
    gracePeriod: true,
    lastingSkill: true,
    momentHighlights: false,
    presentDay: true,
    tiringInjuries: false
  },
  'enhanced-5': {
    difficulty: 'steep',
    gracePeriod: true,
    lastingSkill: true,
    momentHighlights: false,
    presentDay: true,
    tiringInjuries: true
  },
  'moment-highlights': {
    difficulty: 'original',
    gracePeriod: false,
    lastingSkill: false,
    momentHighlights: true,
    presentDay: false,
    tiringInjuries: false
  },
  original: {
    difficulty: 'original',
    gracePeriod: false,
    lastingSkill: false,
    momentHighlights: false,
    presentDay: false,
    tiringInjuries: false
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
 * The difficulty curve for lasting skill (#90, measured as
 * `steep-difficulty`). A squad that keeps its skill wins far more under the
 * smooth curve, so the steps are steeper: tuned against the gameplay baseline
 * so that balanced play loses about the same ground at every level and Genius
 * plays about as the smooth curve's Genius does without lasting skill.
 */
const steepDifficultyBonus = [1, 3, 3.75, 4.25, 4.75, 5, 5.5] as const;

const difficultyBonus = {
  smooth: smoothDifficultyBonus,
  steep: steepDifficultyBonus
} as const;

/**
 * What the difficulty level adds to each of an opponent's five strength
 * attributes before the sum is floored and clamped to 1–20.
 */
export const opponentBonus = (ruleset: Ruleset, level: number) => {
  const { difficulty } = changes[ruleset];
  return difficulty === 'original'
    ? level
    : difficultyBonus[difficulty][level - 1]!;
};

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

/**
 * Whether injuries depend on energy and last up to three weeks, without
 * energy recovery, healing at the season end (#98, measured as
 * `tiring-injuries`). The original injures any owned player 1 time in 20 for
 * one week, and an injured player recovers energy as a reserve does.
 */
export const tiringInjuries = (ruleset: Ruleset) =>
  changes[ruleset].tiringInjuries;

/**
 * Whether a match is decided as a list of moments (goals, saves and near
 * misses) drawn from the team strengths, in place of the original's
 * attacking sequences and their collision checks (#107, measured as
 * `moment-highlights`). No highlights are shown.
 */
export const momentHighlights = (ruleset: Ruleset) =>
  changes[ruleset].momentHighlights;
