# Even difficulty ruleset

[#73](https://github.com/odogono/fman/issues/73). `even-difficulty` is the first experimental ruleset beside `original` ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)). It narrows the gap between difficulty levels, so each level is a real step and Genius is hard but still winnable.

## The problem in the original

The difficulty level adds its value (1–7) to each of an opponent's five strength attributes before the 1–20 clamp: `INT(R(14)+level+points/matches)` in the league and `INT(R(16)+level+…)` in the cup. Balanced play's league win rate falls fairly evenly with level, but over a wide range. From level 5 up, every strategy's median finish is Division 4, so the top three levels feel the same: the club stays stuck where it started.

## The rule

`even-difficulty` adds a smaller bonus in place of the level, in both the league and the cup formulas. Nothing else changes, and every fixture draws exactly the same random numbers as under `original`. The bonus is:

| Level             | 1   | 2   | 3    | 4   | 5   | 6    | 7   |
| ----------------- | --- | --- | ---- | --- | --- | ---- | --- |
| Original          | 1   | 2   | 3    | 4   | 5   | 6    | 7   |
| `even-difficulty` | 1   | 2   | 2.75 | 3   | 3.5 | 3.75 | 4   |

Genius therefore plays like the original's level 4. The steps shrink as the bonus grows, because each extra point of opponent strength costs more league places than the last. The values were chosen from the gameplay baseline so that balanced play's mean league position worsens by about the same amount at every level. They are quarters, which the Spectrum's arithmetic holds exactly. Levels 1 and 2 match the original.

## Result

Balanced strategy, 200 runs per level, 10 seasons ([full baseline](baseline/even-difficulty.md)):

| Level | Mean league position (original → even) | League win rate | Runs with a promotion |
| ----- | -------------------------------------- | --------------- | --------------------- |
| 1     | 1.97 → 1.97                            | 78.4% → 78.4%   | 100% → 100%           |
| 2     | 3.05 → 3.05                            | 69.5% → 69.5%   | 100% → 100%           |
| 3     | 4.85 → 4.04                            | 58.6% → 63.1%   | 98.5% → 100%          |
| 4     | 7.72 → 4.85                            | 44.5% → 58.6%   | 84.5% → 98.5%         |
| 5     | 10.58 → 5.75                           | 32.1% → 54.2%   | 47.5% → 97.5%         |
| 6     | 13.10 → 6.56                           | 21.0% → 50.0%   | 11.0% → 92.5%         |
| 7     | 14.56 → 7.72                           | 13.8% → 44.5%   | 2.0% → 84.5%          |

The step in mean position between levels is 0.8–1.2 places throughout, where the original's ranges from 1.1 to 2.9. Aggressive's dismissal rate rises from 1.5% at level 1 to 43.5% at level 7, against the original's 100%.

## Where it went

This change was measured as the experimental ruleset `even-difficulty`, then became the first version of the [Enhanced rules](enhanced-rules.md), `enhanced-1`, and the experimental name was retired ([#84](https://github.com/odogono/fman/issues/84)). This page and [its baseline](baseline/even-difficulty.md) stay as the record of how it was measured.
