# Club form ruleset

[#99](https://github.com/odogono/fman/issues/99). Every club in the managed club's division but the managed club has form from its recent league results, so opponents go on hot streaks and slumps ([glossary](../GLOSSARY.md): **Form**). Measured as the experimental ruleset `club-form`: `original` plus this rule alone ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then part of [`enhanced-12`](enhanced-rules.md).

## The rule

- **Form** is the sum of a club's last three league results: +1 for a win, 0 for a draw, −1 for a loss, so −3 to +3. Before a club has played three, it sums those there are, so form is 0 in the first week.
- **Every league result counts**, the managed club's own match included: beating a club takes one off its form.
- **The managed club has no form.** Its morale already moves with its results.
- **Opponent strength.** Half of the opponent's form adds to each of its five attributes, on top of points per match, before the sum is floored and clamped to 1–20: `R(14) + difficulty bonus + points/matches + form/2`.
- **Cup opponents** from the managed club's division bring their form the same way. Other divisions aren't simulated, so a cup opponent from one has none.
- **The week's results.** A third of each side's form adds to its goals: `INT(points/matches + RND × 4 + form/3)`, never below 0. From `enhanced-14`, form no longer adds to them ([even table](even-table.md)).
- **Season end.** Every club's form starts again from nothing, which also covers a division the managed club has just joined.

Form takes no random draws, so every draw is as under the rules without it, and the baseline comparison shows the rule alone.

`Game` gains `recentResults`: each division club's latest results, by place in the division, at most three. That is new game state, so saves go to [version 13](save-load.md).

## On screen

- **Modern mode's league table** gains a Form column: each club's latest results, oldest first, as `W`, `D` and `L`, the managed club's included. It shows only in games with form.
- **Opponent strength hint** ([#97](https://github.com/odogono/fman/issues/97)) is unchanged: the strength it shows already includes form.
- **Classic mode** is unchanged, since its screens reproduce the original.

## Tuning

Measured against `original`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/club-form.md)). Form's first weight added it in full to each attribute. That flattened the difficulty curve: the balanced strategy won 4–5 points fewer league matches at levels 1–3 and 4–6 more at levels 5–7. A strong club meets more upsets from a hot opponent, and near the clamp at 20 a hot opponent can't gain what a cold one loses. Half of form keeps hot and cold opponents felt at about half the change. A 50-run trial with form on goals only moved no win rate, but still moved league positions by up to 0.9 places: form spreads the other clubs' points further apart.

## Result

League win rate, `original` → `club-form`:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 54.5% → 53.2% | 78.4% → 76.7% | 77.5% → 74.8% | 71.8% → 69.7% |
| 2     | 42.7% → 42.8% | 69.5% → 68.4% | 68.5% → 66.0% | 61.8% → 60.7% |
| 3     | 30.8% → 32.4% | 58.6% → 57.7% | 57.6% → 55.4% | 49.4% → 49.2% |
| 4     | 22.8% → 23.6% | 44.5% → 45.5% | 45.4% → 45.1% | 37.2% → 38.6% |
| 5     | 15.0% → 17.2% | 32.1% → 33.5% | 33.1% → 35.0% | 26.0% → 29.0% |
| 6     | 9.9% → 11.9%  | 21.0% → 24.3% | 24.1% → 26.4% | 18.9% → 21.2% |
| 7     | 6.6% → 8.1%   | 13.8% → 16.0% | 17.0% → 19.2% | 12.9% → 15.2% |

The balanced strategy's mean league position moves about one place down at levels 1–3, holds at level 4, and moves 0.7–1.5 places up at levels 5–7. Of 630 metric means, 302 differ beyond sampling noise, most of them league positions, promotions and cup wins that follow from those win rates.

## In Enhanced

`enhanced-12` is `enhanced-11` plus club form ([full baseline](baseline/enhanced-12.md)). League win rate, `enhanced-11` → `enhanced-12`:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 37.9% → 37.6% | 85.3% → 83.5% | 76.2% → 73.9% | 65.1% → 63.2% |
| 2     | 19.9% → 21.2% | 69.1% → 68.1% | 56.7% → 54.7% | 42.9% → 43.0% |
| 3     | 16.3% → 17.6% | 62.7% → 61.5% | 48.8% → 48.5% | 34.8% → 36.8% |
| 4     | 13.5% → 14.2% | 56.0% → 54.3% | 42.0% → 40.7% | 30.8% → 31.3% |
| 5     | 11.1% → 12.7% | 47.9% → 49.5% | 35.9% → 38.5% | 24.8% → 27.7% |
| 6     | 9.3% → 10.9%  | 41.8% → 43.9% | 32.4% → 34.5% | 22.1% → 24.0% |
| 7     | 8.3% → 8.3%   | 36.0% → 38.2% | 28.2% → 29.3% | 19.6% → 20.9% |

At levels 5–7 the matches get a little easier but promotion gets harder: Balanced wins about 2 points more league matches yet wins 0.6–0.8 fewer promotions in 10 seasons, and ends half to three quarters of a division lower. A rival on a run collects more points, so the top three take more to reach. Aggressive is dismissed 18–20 points less often at levels 5 and 6, since its dismissals mostly follow a relegation and it is relegated less. Of 630 metric means, 296 differ beyond sampling noise.
