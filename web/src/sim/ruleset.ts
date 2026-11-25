import {
  clubs,
  playerNames,
  presentDayClubs,
  presentDayPlayerNames
} from './catalogue';

/**
 * Named sets of game rules (ADR 0007, ADR 0009), each with the clubs and
 * players a new game starts with (ADR 0011). `original` holds rules
 * parity, with every rule change off. Enhanced rules are released in
 * versions (`enhanced-1`, …): each is the version before plus one or more
 * rule changes, and a game keeps the version it started with, so every
 * released version stays playable. An experimental ruleset carries one rule
 * change on top of a base ruleset while it is measured against that base,
 * and is retired once the change joins Enhanced (`even-difficulty`,
 * `grace-period`, `lasting-skill`, `steep-difficulty`, `tiring-injuries`,
 * `club-squads`, `moment-highlights`, `clearances`, `match-injuries`,
 * `penalties`, `club-form`, `squad-strength`, `even-table`).
 */

/** The difficulty curves: what each level adds to an opponent's strength. */
type Difficulty = 'original' | 'smooth' | 'steep' | 'steep-table';

/**
 * Every rule change a ruleset makes or doesn't. The difficulty curve is the
 * one rule change made by choosing a curve.
 */
type RuleChanges = {
  clearances: boolean;
  clubForm: boolean;
  clubSquads: boolean;
  difficulty: Difficulty;
  evenTable: boolean;
  gracePeriod: boolean;
  lastingSkill: boolean;
  matchInjuries: boolean;
  momentHighlights: boolean;
  naturalPositions: boolean;
  penalties: boolean;
  plainNames: boolean;
  presentDay: boolean;
  squadStrength: boolean;
  tiringInjuries: boolean;
};

export type RuleChange = keyof RuleChanges;

/**
 * What a ruleset adds to the one it builds on: rule changes turned on, or a
 * new difficulty curve. Nothing is ever turned off.
 */
type Adds = {
  [Change in RuleChange]?: RuleChanges[Change] extends boolean
    ? true
    : Exclude<Difficulty, 'original'>;
};

/** The original rules: every rule change off. */
const originalRules: RuleChanges = {
  clearances: false,
  clubForm: false,
  clubSquads: false,
  difficulty: 'original',
  evenTable: false,
  gracePeriod: false,
  lastingSkill: false,
  matchInjuries: false,
  momentHighlights: false,
  naturalPositions: false,
  penalties: false,
  plainNames: false,
  presentDay: false,
  squadStrength: false,
  tiringInjuries: false
};

/** The rule changes each rule change can't be made without. */
export const ruleChangeNeeds: Partial<
  Record<RuleChange, readonly RuleChange[]>
> = {
  clubSquads: ['presentDay'],
  evenTable: ['clubForm', 'squadStrength'],
  matchInjuries: ['tiringInjuries', 'momentHighlights'],
  naturalPositions: ['clubSquads'],
  penalties: ['momentHighlights'],
  squadStrength: ['clubSquads', 'clubForm']
};

/**
 * The Enhanced versions in release order, each the version before (the
 * original rules, for the first) plus what it adds. A promotion appends one
 * entry; released entries never change.
 */
export const enhancedVersions = [
  { adds: { difficulty: 'smooth' }, name: 'enhanced-1' },
  { adds: { gracePeriod: true }, name: 'enhanced-2' },
  { adds: { presentDay: true }, name: 'enhanced-3' },
  { adds: { difficulty: 'steep', lastingSkill: true }, name: 'enhanced-4' },
  { adds: { tiringInjuries: true }, name: 'enhanced-5' },
  { adds: { clubSquads: true }, name: 'enhanced-6' },
  { adds: { momentHighlights: true }, name: 'enhanced-7' },
  { adds: { clearances: true }, name: 'enhanced-8' },
  { adds: { matchInjuries: true }, name: 'enhanced-9' },
  { adds: { plainNames: true }, name: 'enhanced-10' },
  { adds: { penalties: true }, name: 'enhanced-11' },
  { adds: { clubForm: true }, name: 'enhanced-12' },
  { adds: { squadStrength: true }, name: 'enhanced-13' },
  { adds: { difficulty: 'steep-table', evenTable: true }, name: 'enhanced-14' }
] as const satisfies readonly { adds: Adds; name: `enhanced-${number}` }[];

type EnhancedVersion = (typeof enhancedVersions)[number]['name'];

/**
 * The experimental rulesets being measured, each its base (the original
 * rules or an Enhanced version) plus one rule change. An entry goes when its
 * change is promoted into an Enhanced version.
 */
export const experiments = [
  {
    adds: { naturalPositions: true },
    base: 'enhanced-14',
    name: 'natural-positions'
  }
] as const satisfies readonly {
  adds: Adds;
  base: 'original' | EnhancedVersion;
  name: string;
}[];

export type Ruleset =
  'original' | EnhancedVersion | (typeof experiments)[number]['name'];

/** Each experiment with its names widened, so an empty list still reads. */
const measured = experiments as readonly {
  adds: Adds;
  base: Ruleset;
  name: Ruleset;
}[];

export const rulesets: readonly Ruleset[] = [
  'original',
  ...enhancedVersions.map(version => version.name),
  ...measured.map(experiment => experiment.name)
];

/** The Enhanced version every new Enhanced game starts with. */
export const latestEnhanced: Ruleset = enhancedVersions.at(-1)!.name;

export const isRuleset = (value: unknown): value is Ruleset =>
  rulesets.includes(value as Ruleset);

/** The rule changes each ruleset makes, folded once from the ladder. */
const changes = (() => {
  const folded = { original: originalRules } as Record<Ruleset, RuleChanges>;
  let previous = originalRules;
  for (const { adds, name } of enhancedVersions) {
    previous = { ...previous, ...adds };
    folded[name] = previous;
  }
  for (const { adds, base, name } of measured) {
    folded[name] = { ...folded[base], ...adds };
  }
  return folded;
})();

/** Every rule change the ruleset makes, and its difficulty curve. */
export const ruleChanges = (ruleset: Ruleset): Readonly<RuleChanges> =>
  changes[ruleset];

/** The Enhanced version that first made the rule change. */
export const introducedIn = (change: RuleChange) =>
  enhancedVersions.find(version => change in version.adds)?.name;

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

/**
 * Whether a picked player can play out of position, in goal or in another
 * playing category, counting less the further it is from his position (#121,
 * measured as `natural-positions` against `enhanced-14`). It needs club
 * squads, whose players have positions.
 */
export const naturalPositions = (ruleset: Ruleset) =>
  changes[ruleset].naturalPositions;
