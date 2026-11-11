# Tiring injuries ruleset

[#98](https://github.com/odogono/fman/issues/98). Under the Enhanced rules from version 5, a tired player is likelier to be injured, an injury can last up to three weeks, and an injured player doesn't recover energy. The change was measured as the experimental ruleset `tiring-injuries` ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then became part of [`enhanced-5`](enhanced-rules.md).

## The problem in the original

Before each league match, cup leg and cup replay, the original refreshes every player (`refreshPlayers` in `web/src/sim/cup.ts`). Picked players lose 1 energy, and reserves and injured players gain 10. Then any owned player is injured when `R(20) = 20`: a flat 1 in 20, whatever their energy, for one week. A season is about 20 weeks, so a picked player barely tires, and a new game's 12 players are enough all season. Squad depth doesn't matter, so money has little use beyond 11 strong players ([#71](https://github.com/odogono/fman/issues/71)).

## The rule

Each week, under `enhanced-5` (and `tiring-injuries` before it):

- Picked players lose 1 energy and reserves gain 10, as in the original.
- An **injured player** gains no energy. Their **weeks out** count down by one, and at zero they rejoin the reserves.
- Every other owned player is injured when the original's roll lands in the top _k_ of 20, where _k_ comes from their energy after this week's change: 1 for energy 11–20, 2 for 6–10 and 3 for 1–5 (5%, 10% and 15%).
- The injury lasts as many weeks as the roll lands into the band: roll − (20 − _k_), so 1 to 3. A fit player is injured on a 20 for one week, exactly as in the original.
- At the season end every injury heals. Energy still rerolls as `R(20)`.

Nothing else changes. Turning down a sale offer still injures the player 2 times in 3, for one week. Injury never reduces skill, and injured players are still paid. The refresh draws the same `R(20)` per player as the original, unowned players included, so every later draw is the same as under `original`.

The squad screen shows an injured player's weeks out, `1`–`3`, in place of `i`, in the same colours. Its key line reads `p = picked, 1-3 = weeks injured`. Original rules show the screen as before. Weeks out are saved with the game ([save version 10](save-load.md)).

## How the numbers were chosen

The issue proposed picked players losing **3** energy a week, a curve of 5/10/15/20% for energy 16–20/11–15/6–10/1–5, and injured players still recovering 10. Measured against the baseline, that failed two of its three tests:

- **Faster tiring only makes the game harder.** Energy is one of the five equally weighted strength attributes, and opponents never tire. At 3 a week, balanced's league win rate fell 18–27 points at levels 1–5. A balanced bot that kept 18 players and rested anyone at energy 10 or below still lost 12–15. Any loss of 2 or more a week cost balanced 5–8 points at most levels.
- **Recovering while injured cancels the injury.** With tiring left at 1, an injured player came back rested. Passive was short-handed three times as often, and each short-handed match was about 7 strength points weaker, but the full matches in between were stronger by about as much. Passive's win rate didn't change, so depth didn't pay.

So tiring stays as in the original, injured players recover nothing, and the curve is gentler. The issue also expected balanced might do badly only because it sells reserves. It does: balanced sells down to 14 players and picks by skill × energy, so it keeps playing tired stars. The [rotating strategy](gameplay-baseline.md#strategies) was added to measure a manager who keeps up to 18 players and rests anyone at energy 8 or below.

## Result

Measured alone against `original`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/tiring-injuries.md)). League win rate:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 54.5% → 36.9% | 78.4% → 73.4% | 77.5% → 74.8% | 71.8% → 63.1% |
| 2     | 42.7% → 26.7% | 69.5% → 62.1% | 68.5% → 65.3% | 61.8% → 51.0% |
| 3     | 30.8% → 19.7% | 58.6% → 49.1% | 57.6% → 52.7% | 49.4% → 39.6% |
| 4     | 22.8% → 13.0% | 44.5% → 36.5% | 45.4% → 41.9% | 37.2% → 29.1% |
| 5     | 15.0% → 9.1%  | 32.1% → 23.8% | 33.1% → 30.5% | 26.0% → 20.7% |
| 6     | 9.9% → 6.0%   | 21.0% → 15.2% | 24.1% → 20.9% | 18.9% → 14.8% |
| 7     | 6.6% → 4.1%   | 13.8% → 9.9%  | 17.0% → 14.8% | 12.9% → 10.0% |

Depth, rotation and injuries (rotating's lead is its league win rate minus passive's, in points):

| Level | Rotating's lead | Passive short-handed | Injuries per season: passive, balanced, rotating, aggressive |
| ----- | --------------- | -------------------- | ------------------------------------------------------------ |
| 1     | 23.0 → 37.9     | 11.7% → 56.3%        | 10.7 → 20.4, 13.8 → 18.0, 15.8 → 18.0, 15.7 → 25.0           |
| 2     | 25.8 → 38.6     | 11.6% → 55.5%        | 9.9 → 19.4, 13.2 → 17.3, 15.2 → 17.0, 14.7 → 22.8            |
| 3     | 26.9 → 33.0     | 11.7% → 55.1%        | 9.5 → 18.8, 12.4 → 16.1, 14.3 → 15.8, 13.8 → 21.4            |
| 4     | 22.6 → 29.0     | 11.8% → 54.3%        | 9.2 → 18.3, 11.5 → 15.2, 13.1 → 14.8, 12.9 → 21.5            |
| 5     | 18.0 → 21.4     | 11.9% → 54.2%        | 9.1 → 18.0, 10.9 → 14.7, 12.4 → 14.2, 13.3 → 22.3            |
| 6     | 14.2 → 14.9     | 11.5% → 53.9%        | 8.8 → 17.8, 10.6 → 14.5, 11.9 → 13.8, 13.8 → 22.8            |
| 7     | 10.4 → 10.7     | 11.7% → 53.7%        | 8.8 → 17.5, 10.2 → 14.5, 11.7 → 13.4, 14.4 → 23.5            |

Against the issue's three tests, with rotating as the manager who acts on the rule:

1. **Depth pays.** Rotating's lead over passive grows at every level, by 6–15 points at levels 1–4. Passive, which never buys, is short-handed in more than half its matches and loses 2.5–17.6 points.
2. **It isn't a lottery.** Rotating's win rate falls 2.2–4.9 points. Balanced as it stands falls 3.9–9.5: it sells the depth it needs and plays tired stars.
3. **Rotation is real.** Balanced and rotating are injured 13–18 times a season, aggressive 21–25. Aggressive fields its strongest team whatever its energy.

Clubs that borrow to the limit suffer most. Weaker results bring more relegations, and relegation lowers the credit limit beneath their debt: aggressive is dismissed in 69.0% of runs at level 4 instead of 43.5%, and recovering in 62.5% instead of 22.5%.

## Joining Enhanced

`enhanced-5` is `enhanced-4` plus this rule. Against `enhanced-4` ([baseline](baseline/enhanced-5.md)), league win rate:

| Level | Passive       | Balanced      | Rotating      | Aggressive dismissed |
| ----- | ------------- | ------------- | ------------- | -------------------- |
| 1     | 49.9% → 34.1% | 87.7% → 84.7% | 78.5% → 75.9% | 1.0% → 5.5%          |
| 2     | 27.6% → 18.1% | 74.3% → 68.9% | 59.6% → 54.5% | 22.5% → 29.0%        |
| 3     | 23.2% → 14.1% | 68.0% → 61.1% | 51.5% → 46.7% | 27.0% → 38.0%        |
| 4     | 18.9% → 12.1% | 61.2% → 54.8% | 44.1% → 39.9% | 36.0% → 62.5%        |
| 5     | 15.5% → 9.3%  | 54.2% → 46.8% | 38.6% → 34.4% | 59.5% → 90.5%        |
| 6     | 13.4% → 8.2%  | 49.6% → 40.3% | 34.1% → 31.9% | 75.5% → 98.0%        |
| 7     | 11.4% → 7.1%  | 42.3% → 32.9% | 31.1% → 27.3% | 91.0% → 99.5%        |

The game is harder at every level: balanced loses 3–9 points and rotating 2–5. With lasting skill, balanced's cycle of buying and selling builds a better squad than rotating's deeper one, so it stays ahead of rotating despite the injuries. No difficulty adjustment joins this version. If one is wanted, it gets its own issue, as [#90](https://github.com/odogono/fman/issues/90) did for `enhanced-4`.
