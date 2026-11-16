# Penalties ruleset

[#211](https://github.com/odogono/fman/issues/211). Either side can win a penalty for a foul in the box, and it can change the result ([glossary](../GLOSSARY.md): **Penalty**, **Moment**). Measured as the experimental ruleset `penalties`: `enhanced-10` plus this rule alone ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then part of [`enhanced-11`](enhanced-rules.md). The `enhanced-11` baseline matches `penalties`' exactly, metric for metric ([full baseline](baseline/enhanced-11.md)).

## The rule

- **How often.** After a match's chances and injuries are drawn, each side, the managed club first, wins a penalty 1 time in 8, so about one match in four has one, as in league football.
- **Scored as any chance.** A penalty is a goal, save or near miss on the same d100 roll as any other chance: a goal on 55 or less, a save up to 77, a near miss above. It never ends as a clearance. A penalty goal counts in the score like any other.
- **The minute** is drawn from 1′ to 90′.
- **The taker.** For the managed club, a picked player still on the pitch, weighted as any shooter is ([moment-highlights.md](moment-highlights.md)); for an opponent with a squad, anyone in it.
- **The foul.** Where one of the managed club's players was injured by a tackle in the match ([match-injuries.md](match-injuries.md)), the club's penalty is for that tackle, the earliest by the clock: it comes in the same minute, straight after the injury, which is marked as a foul. Someone else takes it. A penalty without an injury is for a foul nobody was hurt by.

## Random draws

The penalty draws come from a stream of their own, seeded from the match's seed and never written back, as the injury draws are. Each side draws its roll, its outcome and its minute whether or not it wins a penalty, then a taker if it does. Every goal, save, clearance, near miss and injury, their minutes, and every later draw are exactly as under `enhanced-10`; only the penalties are added, and with them the score.

`Game` gains no field, so the save version is unchanged.

## On screen

- **Ticker.** `PEN GOAL!`, `PEN SAVED:` and `PEN MISSED:` in Classic mode, `Penalty goal!`, `Penalty saved` and `Penalty missed` in Modern mode. The injury a penalty was for reads `fouled by` in place of `tackled by`: `63' INJURY: PRYCE, FOULED BY SMITH`.
- **Full-time screen.** A penalty goal's minute is marked `(pen)`.
- **Sprite highlights.** A foul is a tackle in the box, and the penalty plays as a clip of its own from the spot ([sprite-highlights.md](sprite-highlights.md)).

## Result

Measured against `enhanced-10`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/penalties.md)). Each side scores about 0.07 more goals a match, as expected from 1 in 8 × 55%. Since both sides win penalties as often, the results barely move. League win rate:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 37.2% → 37.9% | 85.3% → 85.3% | 77.7% → 76.2% | 65.6% → 65.1% |
| 2     | 20.0% → 19.9% | 70.2% → 69.1% | 58.0% → 56.7% | 42.2% → 42.9% |
| 3     | 15.4% → 16.3% | 62.2% → 62.7% | 49.1% → 48.8% | 35.1% → 34.8% |
| 4     | 12.8% → 13.5% | 54.4% → 56.0% | 42.4% → 42.0% | 30.3% → 30.8% |
| 5     | 10.9% → 11.1% | 48.9% → 47.9% | 36.5% → 35.9% | 25.3% → 24.8% |
| 6     | 9.3% → 9.3%   | 42.1% → 41.8% | 32.6% → 32.4% | 21.3% → 22.1% |
| 7     | 8.0% → 8.3%   | 35.5% → 36.0% | 28.2% → 28.2% | 19.2% → 19.6% |

Of 630 metric means, 99 differ beyond sampling noise, nearly all of them goals for and against.
