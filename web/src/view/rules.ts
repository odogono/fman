import { latestEnhanced, type Ruleset } from '../sim/ruleset';

/**
 * The two rulesets a player chooses between when starting a new game
 * (ADR 0009). Enhanced versions stay internal: every one shows as Enhanced.
 */
export type Rules = 'enhanced' | 'original';

export const defaultRules: Rules = 'enhanced';

export const isRules = (value: unknown): value is Rules =>
  value === 'enhanced' || value === 'original';

/** The ruleset a new game starts under. */
export const rulesetFor = (rules: Rules): Ruleset =>
  rules === 'original' ? 'original' : latestEnhanced;

export const rulesOf = (ruleset: Ruleset): Rules =>
  ruleset === 'original' ? 'original' : 'enhanced';

/** How each choice is shown, Enhanced first. */
export const rulesChoices = [
  {
    description:
      'Matches told as a ticker of goals, saves, clearances and near misses, present-day clubs in their own colours, each with a squad of its own, players who keep their skill between seasons, tired players more likely to be injured and out for up to three weeks, a smoother difficulty curve, and a few weeks to clear debts before dismissal',
    name: 'Enhanced',
    rules: 'enhanced'
  },
  {
    description: 'Exactly as the 1982 Spectrum game played',
    name: 'Original',
    rules: 'original'
  }
] as const satisfies readonly {
  description: string;
  name: string;
  rules: Rules;
}[];

export const rulesName = (rules: Rules) =>
  rules === 'original' ? 'Original' : 'Enhanced';
