# Steep difficulty ruleset

[#90](https://github.com/odogono/fman/issues/90). Under the Enhanced rules from version 4, the difficulty curve is steeper, to match [lasting skill](lasting-skill.md). It was measured as the experimental ruleset `steep-difficulty` ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), lasting skill with the retuned curve, then became part of [`enhanced-4`](enhanced-rules.md) together with lasting skill.

## The problem

The [smoother difficulty curve](even-difficulty.md) was tuned so that Genius plays like the original's level 4: hard but still winnable. Lasting skill makes a squad that buys well far stronger, so the two together make the upper levels easy. With the two together (`enhanced-2` plus lasting skill, a promotion that was held back), balanced at Genius wins 63.8% of league matches and finishes in Division 1 in most runs, against 44.5% and Division 3 under `enhanced-2`.

Lasting skill changes how much each point of opponent strength costs, so the retuning is measured on top of `lasting-skill`, not on top of `original` alone.

## The rule

`steep-difficulty` is `lasting-skill` with this bonus in place of the level, in both the league and the cup formulas:

| Level              | 1   | 2   | 3    | 4    | 5    | 6    | 7   |
| ------------------ | --- | --- | ---- | ---- | ---- | ---- | --- |
| Original           | 1   | 2   | 3    | 4    | 5    | 6    | 7   |
| Smooth (Enhanced)  | 1   | 2   | 2.75 | 3    | 3.5  | 3.75 | 4   |
| `steep-difficulty` | 1   | 3   | 3.75 | 4.25 | 4.75 | 5    | 5.5 |

The values were chosen as #73's were: quarters, from the gameplay baseline, so that balanced play's mean league position worsens by about the same amount at every level. The ends are fixed: level 1 keeps a bonus of 1, and Genius aims for where balanced finishes under `enhanced-2`. A first table interpolated from the `lasting-skill` baseline and that held-back promotion's baseline hit both. Raising level 6 to 5.25 made the last two steps less even (1.5 and 0.7 places), so it stayed at 5.

## Result

200 runs per level and strategy, 10 seasons ([full baseline](baseline/steep-difficulty.md)). Medians, except promotions (means).

Balanced, `enhanced-2` / `lasting-skill` / `steep-difficulty`:

| Level | Mean league position | League win rate       | Promotions         | Final division |
| ----- | -------------------- | --------------------- | ------------------ | -------------- |
| 1     | 1.9 / 1.3 / 1.3      | 78.4% / 87.8% / 87.8% | 3.01 / 3 / 3       | 1 / 1 / 1      |
| 2     | 3.0 / 1.7 / 2.45     | 69.5% / 82.1% / 74.2% | 3.03 / 3 / 3       | 1 / 1 / 1      |
| 3     | 4.0 / 2.45 / 3.3     | 63.1% / 74.2% / 68.0% | 3.06 / 3 / 3       | 1 / 1 / 1      |
| 4     | 4.7 / 3.9 / 4.2      | 58.6% / 63.8% / 61.5% | 2.92 / 2.96 / 2.95 | 1 / 1 / 1      |
| 5     | 5.7 / 6.2 / 5.4      | 54.2% / 50.6% / 55.0% | 2.60 / 2.47 / 2.79 | 1 / 1 / 1      |
| 6     | 6.4 / 10.0 / 6.2     | 50.0% / 33.3% / 50.6% | 2.31 / 0.73 / 2.47 | 2 / 4 / 1      |
| 7     | 7.7 / 14.15 / 7.6    | 44.5% / 18.1% / 44.1% | 1.75 / 0.07 / 1.76 | 3 / 4 / 2      |

Balanced lands where it was aimed. Its mean position worsens by 0.8–1.4 places a level, and Genius plays as it does under `enhanced-2`, while buying still pays: balanced ends richer than under `enhanced-2` at every level (£355k against £267k at Genius).

Clubs that borrow pay for the steeper curve. Dismissed, `original` / `enhanced-2` / `lasting-skill` / `steep-difficulty`:

| Level | Aggressive                    | Recovering                   |
| ----- | ----------------------------- | ---------------------------- |
| 1     | 1.5% / 1.5% / 1.0% / 1.0%     | 0% / 0% / 0% / 0%            |
| 2     | 8.5% / 8.5% / 3.0% / 22.5%    | 0% / 0% / 0% / 1.0%          |
| 3     | 29.5% / 22.0% / 22.5% / 24.0% | 0% / 0% / 1.0% / 10.0%       |
| 4     | 43.5% / 29.5% / 35.5% / 35.5% | 22.5% / 0% / 22.0% / 22.0%   |
| 5     | 87.0% / 28.0% / 79.5% / 62.0% | 84.0% / 1.0% / 78.5% / 56.0% |
| 6     | 99.0% / 35.0% / 99.5% / 79.5% | 99.0% / 4.5% / 99.5% / 78.5% |
| 7     | 100% / 42.5% / 100% / 93.5%   | 100% / 15.5% / 100% / 93.0%  |

Lasting skill does little for aggressive, which borrows to fill its squad and never sells, so it feels the stronger opponents without the matching gain. Recovering's numbers here lack the grace period, which `enhanced-2` and `enhanced-4` have: under the original curve the grace period cut its Genius-level dismissals only from 100% to 100%, and at level 5 from 84% to 74.5% ([grace period](grace-period.md#measuring-it)).

So Enhanced with lasting skill and this curve rewards building a squad from earned money, and makes playing on borrowed money much riskier above level 4 than `enhanced-2` does.

## In Enhanced

`enhanced-4` is `enhanced-3` with lasting skill and this curve ([full baseline](baseline/enhanced-4.md)). `enhanced-3` only adds present-day clubs and players to `enhanced-2`, so its rules are `enhanced-2`'s. Against `enhanced-3`, balanced's mean league position improves by about half a place at levels 1–4 and is within 0.4 places at 5–7, and it ends richer at every level (£2,403k against £1,873k at level 1, £324k against £262k at Genius). Dismissed, `enhanced-3` → `enhanced-4`:

| Level | Aggressive    | Recovering    |
| ----- | ------------- | ------------- |
| 1     | 1.5% → 1.0%   | 0% → 0%       |
| 2     | 10.0% → 22.5% | 0% → 0%       |
| 3     | 19.5% → 27.0% | 0% → 2.5%     |
| 4     | 29.0% → 36.0% | 0.5% → 13.0%  |
| 5     | 27.0% → 59.5% | 0.5% → 40.0%  |
| 6     | 37.0% → 75.5% | 1.0% → 62.0%  |
| 7     | 45.0% → 91.0% | 12.5% → 81.0% |

The grace period softens recovering's losses a little (81.0% at Genius against 93.0% under `steep-difficulty`), but playing on borrowed money is much riskier above level 4 than under `enhanced-3`.
