# Lasting skill ruleset

[#72](https://github.com/odogono/fman/issues/72). `lasting-skill` is an experimental ruleset ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)): owned players keep their skill from one season to the next, with a small skill drift, instead of rerolling it. It is being measured against `original` and has not joined the [Enhanced rules](enhanced-rules.md).

## The problem in the original

At the season end every player's skill is rerolled as `R(5)` and energy as `R(20)` (original lines 8800–8890). A squad built through transfers is wiped each season, so buying has no lasting value, which is the main reason spare money has no use ([#71](https://github.com/odogono/fman/issues/71)).

## The rule

At the season end, under `lasting-skill`:

- Each **owned player** (picked, reserve or injured) keeps their skill with **skill drift**: −1, 0 or +1 with equal chance, kept within 1–5. Skill 5 stays 5 two times in three and drops to 4 otherwise; skill 1 mirrors that. Clamping at both ends pulls skill back toward the middle over time, so no downward lean is needed.
- Each **unowned player** in the pool still rerolls skill as `R(5)`, so the transfer market stays fresh. A player sold before the season end rerolls.
- **Energy** still rerolls as `R(20)` for every player.
- **Value** is recalculated for every player from the new skill and division, as in the original: skill × £5,000 × (5 − division).

Nothing else changes. The drift takes one random number where the reroll took one, so every later draw is the same as under `original`. The screens are unchanged: the squad list already shows each player's skill.

Wages are skill × £100 × (5 − division) per owned player each week, so a strong squad keeps costing more for as long as it lasts.

## Result

200 runs per level and strategy, 10 seasons ([full baseline](baseline/lasting-skill.md)). Promotions are means over runs; final division and final cash − debt are medians.

Balanced:

| Level | Promotions  | Final division | Final cash − debt |
| ----- | ----------- | -------------- | ----------------- |
| 1     | 3.01 → 3    | 1 → 1          | £1,808k → £2,419k |
| 2     | 3.03 → 3    | 1 → 1          | £1,340k → £2,203k |
| 3     | 2.92 → 3    | 1 → 1          | £831k → £1,851k   |
| 4     | 1.75 → 2.96 | 3 → 1          | £267k → £1,332k   |
| 5     | 0.62 → 2.47 | 4 → 1          | £76k → £652k      |
| 6     | 0.13 → 0.73 | 4 → 4          | £36k → £125k      |
| 7     | 0.02 → 0.07 | 4 → 4          | £12k → £15k       |

Aggressive:

| Level | Dismissed     | Promotions  | Final division | Final cash − debt |
| ----- | ------------- | ----------- | -------------- | ----------------- |
| 1     | 1.5% → 1.0%   | 2.99 → 3    | 1 → 1          | £1,501k → £1,508k |
| 2     | 8.5% → 3.0%   | 2.87 → 2.88 | 1 → 1          | £850k → £978k     |
| 3     | 29.5% → 22.5% | 2.06 → 2.06 | 2 → 2          | £192k → £231k     |
| 4     | 43.5% → 35.5% | 0.91 → 0.88 | 4 → 4          | −£125k → −£118k   |
| 5     | 87.0% → 79.5% | 0.15 → 0.21 | 4 → 4          | −£251k → −£251k   |
| 6     | 99.0% → 99.5% | 0.04 → 0.02 | 4 → 4          | −£252k → −£252k   |
| 7     | 100% → 100%   | 0 → 0       | 4 → 4          | −£252k → −£253k   |

Buying now pays. Balanced, which buys players of skill 3 or more from spare cash and sells its weakest reserves, builds a squad that lasts: its league win rate rises by 9 to 19 points at levels 1–6, it wins promotion to Division 1 by the end at levels 4 and 5 where the original leaves it in Division 3 or 4, and it ends up to £1m richer despite the higher wages. The higher wages don't outweigh the extra gate receipts, cup runs and season bonuses.

Aggressive gains little. It fills its squad early with borrowed money and never sells, so it can't keep improving it, and it stays at the credit limit. Its dismissal rate is lower at levels 2–5, but of those only level 2 is beyond sampling noise.

Passive gets slightly worse at every level (0.5 to 0.8 league places lower at levels 1–3, and fewer promotions). That isn't the rule pushing skill down. In 150 level-1 runs, the harness's start-of-game timing dealt passive's squad an average skill of 2.75, though a new game averages 3.0 over every seed. The original rerolls that away after one season; under lasting skill the weak squad keeps its skill and drifts back up only slowly (2.79 in season 2, 2.93 in season 10). A player who never buys keeps the squad they were dealt.

## Before joining Enhanced

Balanced at level 5 goes from rarely promoted to almost always reaching Division 1. The [smoother difficulty curve](even-difficulty.md) in Enhanced also helps a balanced club at high levels, so the two changes together may make the upper levels too easy. The `enhanced-3` baseline, compared against `enhanced-2`, should be checked for that.
