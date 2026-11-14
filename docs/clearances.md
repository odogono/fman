# Clearances

[#150](https://github.com/odogono/fman/issues/150). Under [moment highlights](moment-highlights.md), a chance that isn't a goal can also be a **clearance** ([glossary](../GLOSSARY.md)): a defender stops it before it reaches goal, by intercepting the final pass or blocking the shot, and clears the ball. Measured as `clearances` against `enhanced-7`, then part of `enhanced-8`.

## How the original's misses end

The original's attacks end when the ball leaves play after bouncing off the players' colour cells ([original-game-analysis.md](original-game-analysis.md)). Across 3,000 matches of `simulateHighlights` with even strengths, the 7,220 missed attacks were classified by the last thing the ball touched before leaving play. A second seed agreed to within 0.2 points.

| Last touched by | Share of misses | Reads as  |
| --------------- | --------------- | --------- |
| A defender      | 37.5%           | Clearance |
| The keeper      | 25.3%           | Save      |
| Nothing         | 34.2%           | Near miss |
| An attacker     | 3.0%            | Near miss |

Only 2.2% of misses hit the post; almost every untouched miss goes wide.

## The rule

The outcome roll stays one `R(100)`. A goal on 55 or less, as before. Then a save on 56–66, a clearance on 67–83 and a near miss on 84–100, close to the split above. Before, a save was 56–77 and a near miss above that.

A clearance names the attacker the chance fell to, with the same draw a save or near miss makes. The defender who clears isn't named, since naming one would take an extra draw from the game's random numbers.

The goal rate and every draw are unchanged, so no result moves: the `clearances` baseline matches `enhanced-7`'s exactly, metric for metric (`docs/baseline/clearances.md`), and so does `enhanced-8`'s.

## On screen

- **Ticker.** `CLEARED:` in Classic mode and `Cleared` in Modern mode. Near misses now read `MISSED:` / `Missed` in every ruleset with a ticker, in place of `POST!`, since few hit the post.
- **Sprite highlights.** The defender cuts out the final pass, or steps into the line of the shot and blocks it, evenly as the clip's seed picks. The clip reaches its moment when the defender meets the ball, then the defender clears long upfield or into touch ([sprite-highlights.md](sprite-highlights.md)).
