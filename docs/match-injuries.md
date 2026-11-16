# Match injuries ruleset

[#110](https://github.com/odogono/fman/issues/110). Injuries happen during the match instead of before team selection, as a moment of the highlights ([glossary](../GLOSSARY.md): **Injury**, **Moment**). Measured as the experimental ruleset `match-injuries`: `enhanced-8` plus this rule alone ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then part of [`enhanced-9`](enhanced-rules.md). The `enhanced-9` baseline matches `match-injuries`' exactly, metric for metric ([full baseline](baseline/enhanced-9.md)).

## The rule

Under `enhanced-8`, the refresh before team selection rolls [tiring injuries](tiring-injuries.md)' curve for every owned player. Under `match-injuries` that roll moves into the match:

- **Who.** At kick-off each **picked** player rolls the same curve once, on their energy after this week's tiring: injured when the roll lands in the top _k_ of 20, with _k_ = 1, 2 or 3 for energy 11–20, 6–10 and 1–5. Reserves aren't playing, so they are never injured. Two players can be injured in one match, and the season's first match can have injuries too.
- **No effect on the match.** The injury is a moment, but the result is decided exactly as before. It costs the matches that follow.
- **Weeks out.** The injury keeps the player out of as many matches as the roll lands into the band, 1 to 3. The refresh before each match still counts injuries down, as under tiring injuries, so an injury from a match starts one week longer, at 2 to 4. The next refresh then doesn't heal it, and the player recovers no energy until they're back. The squad screen's key reads `1-4 = weeks injured`. Every injury heals at the season end.
- **The minute** falls between the player's last chance in the match (or 1′) and 90′, so no one is named after going off.
- **The tackle.** A tackle causes the injury 2 times in 3; otherwise the player pulled up. Under club squads the tackler is one of the opponent's outfield players, at random; the tackle changes nothing in the game.
- **Unchanged.** Refusing a sale offer still injures the player 2 times in 3, for one week.

## Random draws

The refresh still draws its one `R(20)` per player, unowned players included, and ignores it. The injury draws come from a stream of their own, seeded from the match's seed and never written back, as the opponent's shooters are ([moment-highlights.md](moment-highlights.md)). So every goal, save, clearance and near miss, their minutes, the score and every later draw are exactly as under `enhanced-8`. A result can only differ through who is fit to pick.

`Game` gains no field, so the save version is unchanged; under `match-injuries` a saved player can have up to 4 weeks out.

## On screen

- **Ticker.** `INJURY:` in Classic mode and `Injury` in Modern mode, naming the player and, when a tackle caused it and the whole fits, who made it: `51' INJURY: PRYCE, TACKLED BY SMITH`. Without club squads the opposing club makes the tackle.
- **Sprite highlights.** The named opponent tackles the injured player, or they pull up, and they stay down while the ball goes into touch. They are left out of the match's later clips ([sprite-highlights.md](sprite-highlights.md)).

## Result

Measured against `enhanced-8`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/match-injuries.md)). League win rate:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 36.2% → 37.2% | 84.2% → 85.3% | 76.9% → 77.7% | 64.6% → 65.6% |
| 2     | 18.0% → 20.0% | 67.1% → 70.2% | 55.7% → 58.0% | 41.0% → 42.2% |
| 3     | 14.7% → 15.4% | 60.1% → 62.2% | 47.5% → 49.1% | 34.1% → 35.1% |
| 4     | 11.8% → 12.8% | 52.2% → 54.4% | 42.3% → 42.4% | 28.4% → 30.3% |
| 5     | 10.4% → 10.9% | 45.6% → 48.9% | 36.0% → 36.5% | 25.0% → 25.3% |
| 6     | 8.4% → 9.3%   | 39.2% → 42.1% | 31.0% → 32.6% | 20.9% → 21.3% |
| 7     | 7.4% → 8.0%   | 32.1% → 35.5% | 28.4% → 28.2% | 18.4% → 19.2% |

Injuries per season:

| Level | Passive     | Balanced    | Rotating    | Aggressive  |
| ----- | ----------- | ----------- | ----------- | ----------- |
| 1     | 20.2 → 20.1 | 16.3 → 13.6 | 18.0 → 13.4 | 25.4 → 22.6 |
| 4     | 18.0 → 18.0 | 14.6 → 12.2 | 14.9 → 11.2 | 21.9 → 19.1 |
| 7     | 17.9 → 17.7 | 14.2 → 11.8 | 14.0 → 10.6 | 22.3 → 19.8 |

- **Reserves are no longer injured.** Passive, with one reserve, has as many injuries as before. Clubs with deeper squads have 2.5–4.5 fewer a season, most of all rotating, which keeps 18 players. Those were rested players at high energy, injured on the bench.
- **Fewer short-handed matches follow.** Passive is short-handed in 47–50% of matches instead of 54–57%. Win rates rise by 1–3 points, and balanced's by up to 3.4.
- **Depth still pays.** Balanced's lead over passive stays as it was (48 points at level 1), and rotating is still injured less often than aggressive.

The first version counted injuries down after each match. A player back from injury then recovered 10 energy at the next refresh, which tiring injuries had ruled out: passive's level-1 win rate rose from 36% to 52%. Counting down at the refresh, as tiring injuries do, removed that.
