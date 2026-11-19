# Even table ruleset

[#218](https://github.com/odogono/fman/issues/218). The other clubs' points spread no wider than they did before [club form](club-form.md) and [squad strength](squad-strength.md), so promotion takes about as many points as it used to. Measured as the experimental ruleset `even-table`: `enhanced-13` plus this retune alone ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then part of [`enhanced-14`](enhanced-rules.md).

## The problem

Club form (`enhanced-12`) and squad strength (`enhanced-13`) each add to the other clubs' goals in the week's results: form a third of a club's form, and squad strength an eighth of the squad-strength gap. Both reward a club already doing well, so the other clubs' points spread further apart and the top three take more to reach. Balanced play wins about as many matches as under `enhanced-11`, yet far fewer promotions, from level 3 upwards. At Genius it wins 0.24 promotions in 10 seasons under `enhanced-13`, against 1.12 under `enhanced-11`, and most runs never leave Division 4. That misses the [steep curve](steep-difficulty.md)'s aim: hard but still winnable.

The step between levels is still even: balanced's mean league position worsens by about a place a level, as the steep curve was tuned for. With the table spread wider, the same position wins fewer promotions, so promotions are the target here, as close as practical to `enhanced-11`'s at every level, within about 0.2.

## The rule

`even-table` is `enhanced-13` with three numbers changed:

- **Form** no longer adds to a club's goals in the week's other results. It still adds half of itself to each attribute of the club's strength as an opponent, league or cup.
- **The squad-strength gap** moves those goals half as much: `(own − other squad strength) / 16`, so a gap of 4 is worth a quarter of a goal.
- **Genius** takes a difficulty bonus of 5.25 in place of 5.5. Squad strength made Genius opponents stronger, and with the first two changes alone balanced still fell about 0.3 promotions short there.

No draw changes, and `Game` gains no field, so the save version is unchanged.

## Tuning

Trials of 100 runs of balanced and aggressive. Balanced's promotions in 10 seasons:

| Level | `enhanced-11` | `enhanced-13` | No form on goals | And half the squad gap on goals | And Genius at 5.25 |
| ----- | ------------- | ------------- | ---------------- | ------------------------------- | ------------------ |
| 2     | 2.99          | 2.85          | 2.96             | 3.02                            | 3.02               |
| 3     | 2.96          | 2.25          | 2.82             | 2.87                            | 2.87               |
| 4     | 2.72          | 1.70          | 2.48             | 2.76                            | 2.76               |
| 5     | 2.17          | 1.28          | 1.96             | 2.11                            | 2.11               |
| 6     | 1.65          | 0.81          | 1.42             | 1.61                            | 1.61               |
| 7     | 1.04          | 0.18          | 0.72             | 0.77                            | 1.07               |

Other levers moved promotions only by making matches easier. Form's weight on opponent strength (`strengthWeight`, a quarter or none) moved them no more than noise. A softer curve at levels 3–7 brought them back only by raising balanced's win rate 7–12 points at levels 4–7 and cutting aggressive's dismissals at Genius from 97% to 67%. A lighter form on goals, a twelfth, fell 0.45 short at levels 4–5 on `enhanced-13`.

## Result

200 runs per level and strategy, 10 seasons ([full baseline](baseline/even-table.md)). Of 630 metric means against `enhanced-13`, 263 differ beyond sampling noise.

Balanced, `enhanced-11` / `enhanced-13` / `even-table`:

| Level | Promotions         | Final division | League win rate       | Mean league position |
| ----- | ------------------ | -------------- | --------------------- | -------------------- |
| 1     | 3 / 3 / 3          | 1 / 1 / 1      | 85.3% / 83.8% / 84.7% | 1.4 / 2.2 / 1.5      |
| 2     | 2.98 / 2.83 / 3    | 1 / 1 / 1      | 69.1% / 67.9% / 68.8% | 3.1 / 4.4 / 3.3      |
| 3     | 2.94 / 2.35 / 2.93 | 1 / 1 / 1      | 62.7% / 61.1% / 62.0% | 4.1 / 5.3 / 4.35     |
| 4     | 2.77 / 1.65 / 2.71 | 1 / 2 / 1      | 56.0% / 54.1% / 54.9% | 5.1 / 6.5 / 5.4      |
| 5     | 2.23 / 1.26 / 2.06 | 1 / 3 / 2      | 47.9% / 49.7% / 47.6% | 6.75 / 7.2 / 7       |
| 6     | 1.68 / 0.77 / 1.50 | 2 / 3 / 3      | 41.8% / 44.5% / 41.5% | 8.2 / 8.1 / 8.1      |
| 7     | 1.12 / 0.24 / 1.07 | 3 / 4 / 3      | 36.0% / 35.9% / 38.0% | 9.35 / 9.3 / 8.9     |

Every level is within 0.2 promotions of `enhanced-11`. Rotating's promotions come back too (1.29 against `enhanced-13`'s 0.40 at level 4), and so does the risk of borrowing. Dismissed, `enhanced-11` / `enhanced-13` / `even-table`:

| Level | Aggressive       | Recovering       |
| ----- | ---------------- | ---------------- |
| 1     | 4% / 0% / 6%     | 0% / 0% / 0%     |
| 2     | 24% / 2% / 23%   | 2% / 0% / 3%     |
| 3     | 46% / 8% / 27%   | 22% / 4% / 10%   |
| 4     | 60% / 31% / 56%  | 52% / 22% / 44%  |
| 5     | 82% / 66% / 88%  | 75% / 54% / 76%  |
| 6     | 96% / 80% / 92%  | 94% / 77% / 88%  |
| 7     | 100% / 96% / 97% | 100% / 94% / 94% |

## In Enhanced

`enhanced-14` is `enhanced-13` plus this retune, so its baseline matches `even-table`'s exactly, run for run ([full baseline](baseline/enhanced-14.md)). Games already started on `enhanced-12` or `enhanced-13` keep form and squad strength's goals as they were.
