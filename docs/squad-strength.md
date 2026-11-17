# Squad strength ruleset

[#119](https://github.com/odogono/fman/issues/119). An opponent's defence, midfield and attack come mostly from its squad, and other clubs' results lean towards the stronger squad ([glossary](../GLOSSARY.md): **Squad strength**). Measured as the experimental ruleset `squad-strength`: `enhanced-12` plus this rule alone ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then part of [`enhanced-13`](enhanced-rules.md). It needs [club squads](club-squads.md), so it builds on `enhanced-12` rather than on `original`.

## The rule

A squad has 12 players, four in each playing category with the goalkeeper in defence, and skill 1–5. Each category's sum is 4–20, averaging 12, already on the attribute scale.

- **League opponent.** Defence, midfield and attack are each `INT(sum / 2) + R(3) + difficulty bonus + points/matches + form/2`, floored and clamped to 1–20, where `sum` is the squad's skill in that category, capped at 20. Energy and morale keep `enhanced-12`'s formula, with `R(14)`.
- **Cup opponent.** The same, with `R(5)` in place of the cup's `R(16)`, two more than the league's roll as the original's cup roll is. The cup's division-gap term stays: squads don't depend on division, so the gap is what makes a higher-division opponent tougher.
- **Difficulty level** stays an additive bonus, as before.
- **The whole squad counts.** Other clubs pick no team and don't tire or get injured. A club over 12 players after a signing counts each category up to 20.
- **The week's results.** Each side's goals add `(own − other squad strength) / 8`, where a club's squad strength is the mean of its three category sums: a gap of 4 is worth half a goal. Goals never go below 0.
- **Selling** a player strengthens the club that buys him, which the original draws at random. It can be the club you face next.

## Random draws

Each squad attribute still takes one draw, `R(3)` or `R(5)` in place of `R(14)` or `R(16)`, so every later draw is as under `enhanced-12`. `Game` gains no field, so the save version is unchanged.

## On screen

**Clubs**, in the game menu, lists each player's skill beside his name and position, and above another club's squad its strength: `Squad strength: defence 12, midfield 14, attack 9.` Free agents stay hidden, so the weekly offer is still a surprise. This is outside the reproduced screens, so it shows in both modes.

## Tuning

Two targets: league win rate within about 2 points of `enhanced-12` at every level and strategy, and opponents differing more from club to club than from match to match. 50-run trials against `enhanced-12`, with each attribute of each league opponent measured over 400 draws in 8 new games:

| League roll             | Win rate vs `enhanced-12` | Mean attribute | Variance between clubs | Variance between matches |
| ----------------------- | ------------------------- | -------------- | ---------------------- | ------------------------ |
| `R(14)` (`enhanced-12`) | —                         | 8.51           | 0.00                   | 16.32                    |
| `R(6)`                  | 4–14 points lower         | 10.09          | 2.04                   | 2.94                     |
| `R(4)`                  | 1–5 points lower          | 9.09           | 2.04                   | 1.24                     |
| `R(3)`                  | within about 2.5 points   | 8.59           | 2.04                   | 0.67                     |

`R(3)` keeps the mean and makes clubs differ three times as much as one club's matches do. With the cup's roll at `R(3)` too, cup opponents averaged 0.75 weaker than under `R(16)`, and balanced won about one more cup in 10 seasons at levels 1–4; `R(5)` halves that. The goal gap of 8 was not tuned further: win rates held with it.

## Result

Measured against `enhanced-12`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/squad-strength.md)). League win rate:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 37.6% → 36.8% | 83.5% → 83.8% | 73.9% → 74.4% | 63.2% → 63.5% |
| 2     | 21.2% → 20.2% | 68.1% → 67.9% | 54.7% → 53.8% | 43.0% → 42.2% |
| 3     | 17.6% → 16.4% | 61.5% → 61.1% | 48.5% → 47.5% | 36.8% → 35.8% |
| 4     | 14.2% → 12.9% | 54.3% → 54.1% | 40.7% → 40.9% | 31.3% → 30.3% |
| 5     | 12.7% → 10.9% | 49.5% → 49.7% | 38.5% → 36.1% | 27.7% → 25.2% |
| 6     | 10.9% → 9.1%  | 43.9% → 44.5% | 34.5% → 32.1% | 24.0% → 22.6% |
| 7     | 8.3% → 7.5%   | 38.2% → 35.9% | 29.3% → 28.8% | 20.9% → 18.6% |

Balanced's mean league position moves by at most 0.4 places. Balanced and rotating win about 0.4 more cups in 10 seasons at levels 1–2, and a few strategies win up to 0.3 fewer promotions. Of 630 metric means, 126 differ beyond sampling noise, most of them small changes in goals.

## In Enhanced

`enhanced-13` is `enhanced-12` plus squad strength, so its baseline matches `squad-strength`'s exactly, run for run ([full baseline](baseline/enhanced-13.md)).
