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
 * carries one change alone while it is measured against the original, and
 * is retired once the change joins Enhanced (`even-difficulty`,
 * `grace-period`, `lasting-skill`, `steep-difficulty`, `tiring-injuries`,
 * `club-squads`, `moment-highlights`, `clearances`, `match-injuries`,
 * `penalties`, `club-form`, `squad-strength`, `even-table`).
 */
export const rulesets = [
  'original',
  'enhanced-1',
  'enhanced-2',
  'enhanced-3',
  'enhanced-4',
  'enhanced-5',
  'enhanced-6',
  'enhanced-7',
  'enhanced-8',
  'enhanced-9',
  'enhanced-10',
  'enhanced-11',
  'enhanced-12',
  'enhanced-13',
  'enhanced-14'
] as const;
export type Ruleset = (typeof rulesets)[number];

/** The Enhanced version every new Enhanced game starts with. */
export const latestEnhanced = 'enhanced-14' satisfies Ruleset;

export const isRuleset = (value: unknown): value is Ruleset =>
  rulesets.includes(value as Ruleset);

/** The difficulty curves: what each level adds to an opponent's strength. */
type Difficulty = 'original' | 'smooth' | 'steep' | 'steep-table';

/** The rule changes each ruleset makes to the original. */
const changes: Record<
  Ruleset,
  {
    clearances: boolean;
    clubForm: boolean;
    clubSquads: boolean;
    difficulty: Difficulty;
    evenTable: boolean;
    gracePeriod: boolean;
    lastingSkill: boolean;
    matchInjuries: boolean;
    momentHighlights: boolean;
    penalties: boolean;
    plainNames: boolean;
    presentDay: boolean;
    squadStrength: boolean;
    tiringInjuries: boolean;
  }
> = {
  'enhanced-1': {
    clearances: false,
    clubForm: false,
    clubSquads: false,
    difficulty: 'smooth',
    evenTable: false,
    gracePeriod: false,
    lastingSkill: false,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: false,
    squadStrength: false,
    tiringInjuries: false
  },
  'enhanced-10': {
    clearances: true,
    clubForm: false,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: true,
    momentHighlights: true,
    penalties: false,
    plainNames: true,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-11': {
    clearances: true,
    clubForm: false,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: true,
    momentHighlights: true,
    penalties: true,
    plainNames: true,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-12': {
    clearances: true,
    clubForm: true,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: true,
    momentHighlights: true,
    penalties: true,
    plainNames: true,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-13': {
    clearances: true,
    clubForm: true,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: true,
    momentHighlights: true,
    penalties: true,
    plainNames: true,
    presentDay: true,
    squadStrength: true,
    tiringInjuries: true
  },
  'enhanced-14': {
    clearances: true,
    clubForm: true,
    clubSquads: true,
    difficulty: 'steep-table',
    evenTable: true,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: true,
    momentHighlights: true,
    penalties: true,
    plainNames: true,
    presentDay: true,
    squadStrength: true,
    tiringInjuries: true
  },
  'enhanced-2': {
    clearances: false,
    clubForm: false,
    clubSquads: false,
    difficulty: 'smooth',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: false,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: false,
    squadStrength: false,
    tiringInjuries: false
  },
  'enhanced-3': {
    clearances: false,
    clubForm: false,
    clubSquads: false,
    difficulty: 'smooth',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: false,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: false
  },
  'enhanced-4': {
    clearances: false,
    clubForm: false,
    clubSquads: false,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: false
  },
  'enhanced-5': {
    clearances: false,
    clubForm: false,
    clubSquads: false,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-6': {
    clearances: false,
    clubForm: false,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-7': {
    clearances: false,
    clubForm: false,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: false,
    momentHighlights: true,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-8': {
    clearances: true,
    clubForm: false,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: false,
    momentHighlights: true,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  'enhanced-9': {
    clearances: true,
    clubForm: false,
    clubSquads: true,
    difficulty: 'steep',
    evenTable: false,
    gracePeriod: true,
    lastingSkill: true,
    matchInjuries: true,
    momentHighlights: true,
    penalties: false,
    plainNames: false,
    presentDay: true,
    squadStrength: false,
    tiringInjuries: true
  },
  original: {
    clearances: false,
    clubForm: false,
    clubSquads: false,
    difficulty: 'original',
    evenTable: false,
    gracePeriod: false,
    lastingSkill: false,
    matchInjuries: false,
    momentHighlights: false,
    penalties: false,
    plainNames: false,
    presentDay: false,
    squadStrength: false,
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

/**
 * The steep curve with Genius eased from 5.5 to 5.25 (#218, measured as
 * `even-table`, then part of `enhanced-14`). Squad strength made Genius
 * opponents stronger; with the table no longer spread by form and squad
 * strength, this brings balanced play's promotions back to Enhanced
 * version 11's.
 */
const steepTableDifficultyBonus = [1, 3, 3.75, 4.25, 4.75, 5, 5.25] as const;

const difficultyBonus = {
  smooth: smoothDifficultyBonus,
  steep: steepDifficultyBonus,
  'steep-table': steepTableDifficultyBonus
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
 * `moment-highlights`, then part of `enhanced-7`). The ticker shows the
 * moments in place of the pitch.
 */
export const momentHighlights = (ruleset: Ruleset) =>
  changes[ruleset].momentHighlights;

/**
 * Whether every present-day club owns a squad of invented players, with the
 * managed club's squad and the transfer list in the original's 24 numbered
 * places, and transfer offers drawn from free agents (#113, measured as
 * `club-squads` on top of `enhanced-5`, then part of `enhanced-6`). Squads don't change how matches play.
 */
export const clubSquads = (ruleset: Ruleset) => changes[ruleset].clubSquads;

/**
 * Whether some chances that aren't goals are clearances: a defender
 * intercepts the final pass or blocks the shot, and clears (#150, measured
 * as `clearances` against `enhanced-7`, then part of `enhanced-8`). The goal rate and the draws don't change; the save and
 * near-miss shares shrink to make room, as the original's misses divide.
 */
export const clearances = (ruleset: Ruleset) => changes[ruleset].clearances;

/**
 * Whether injuries happen in the match instead of before team selection
 * (#110, measured as `match-injuries` against `enhanced-8`, then part of
 * `enhanced-9`). Each picked
 * player rolls the lasting-injuries curve once at kick-off, and an injury is
 * a moment of the highlights that changes nothing in that match. It needs
 * tiring injuries and moment highlights.
 */
export const matchInjuries = (ruleset: Ruleset) =>
  changes[ruleset].matchInjuries;

/**
 * The most weeks out an injury can show (#98): 3, or 4 under match
 * injuries (#110), where an injury from a match counts one more refresh
 * before the player is back.
 */
export const longestInjury = (ruleset: Ruleset) =>
  matchInjuries(ruleset) ? 4 : 3;

/**
 * Whether a new name may carry no control codes beyond a club's leading
 * colour, so printing it can never stop the game (ADR 0014, part of
 * `enhanced-10` without an experiment, since only renamed names can
 * fault). The original keeps its print faults.
 */
export const plainNames = (ruleset: Ruleset) => changes[ruleset].plainNames;

/**
 * Whether each side can win a penalty, for a foul in the box, about once
 * in eight matches (#211, measured as `penalties` against `enhanced-10`,
 * then part of `enhanced-11`).
 * A penalty is a chance of its own, scored as often as any other chance,
 * so it can change the result. A managed player injured by a tackle in the
 * same match can be the one fouled. It needs moment highlights.
 */
export const penalties = (ruleset: Ruleset) => changes[ruleset].penalties;

/**
 * Whether every club in the managed club's division but the managed club
 * has form: the sum of its last three league results, +1 a win and −1 a
 * loss (#99, measured as `club-form`, then part of `enhanced-12`). Half of
 * form adds to its strength as an opponent, league or cup, and a third of
 * it to its goals in the week's results. Form starts again at the season
 * end.
 */
export const clubForm = (ruleset: Ruleset) => changes[ruleset].clubForm;

/**
 * Whether an opponent's defence, midfield and attack come mostly from its
 * squad strength, and other clubs' results lean towards the stronger squad
 * (#119, measured as `squad-strength` against `enhanced-12`, then part of
 * `enhanced-13`). It needs club squads and club form.
 */
export const squadStrength = (ruleset: Ruleset) =>
  changes[ruleset].squadStrength;

/**
 * Whether the other clubs' points spread no wider than before club form
 * and squad strength (#218, measured as `even-table` against
 * `enhanced-13`, then part of `enhanced-14`): form no longer adds to a
 * club's goals in the week's other results, only to its strength as an
 * opponent, and the squad-strength gap moves those goals half as much.
 * Both spread the table so that the top three took more points to reach,
 * and promotions fell from level 3 up. It needs club form and squad
 * strength, and comes with the `steep-table` curve.
 */
export const evenTable = (ruleset: Ruleset) => changes[ruleset].evenTable;
