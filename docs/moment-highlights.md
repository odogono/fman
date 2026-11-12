# Moment highlights ruleset

[#107](https://github.com/odogono/fman/issues/107). Under the Enhanced rules from version 7, each match is decided as a list of moments in place of the original's attacking sequences, and shown as a [ticker](#the-ticker) ([#108](https://github.com/odogono/fman/issues/108)). It is the first step of the [highlights engine](highlights-engine.md) exploration. The change was measured as the experimental ruleset `moment-highlights` ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then became part of [`enhanced-7`](enhanced-rules.md) ([#109](https://github.com/odogono/fman/issues/109)).

## The problem in the original

The original's highlights don't decorate a result; they make it ([original-game-analysis.md](original-game-analysis.md)). Each attack places players on the screen, and a goal happens when the ball reaches the net through collision checks on the screen's colour attributes ([`highlights.ts`](../web/src/sim/highlights.ts)). Nothing in a match can be named, timed or shown any other way, and kits can never be yellow or green.

## The rule

Under `enhanced-7` (and `moment-highlights` before it), kicking off decides the match at once ([`moments.ts`](../web/src/sim/moments.ts)):

- **Chances.** Each side gets the original's tests. For each of the five team strengths, the managed club and then its opponent win two chances when `R(100) + 5 × difference ≥ 75`. If no goal has come from them, home and then away get one more chance each. So a side gets as many chances as the original gives it attacks.
- **Moments.** Every chance becomes one **moment**, drawn in this order:
  1. **Outcome**: one `R(100)`. A goal on 55 or less, a save on 56–77, a near miss above that. Like the original's collision checks, it ignores the strengths.
  2. **Minute**: `R(90)`.
  3. **Player**, for the managed club. One of the picked players, weighted by skill × 1 for defence, 2 for midfield and 4 for attack. The moment names the player who shot, whatever its outcome. With no picked players, the managed club's moments name no one.
- **Opponent's players** ([#124](https://github.com/odogono/fman/issues/124)). Under `enhanced-7`, where every club owns a [squad](club-squads.md), an opponent's moment names one of its squad, weighted as the managed club's are, with a goalkeeper counting as defence. Other clubs don't pick a team, so the whole squad is eligible. These draws come from a stream of their own, seeded from the [squad seed](club-squads.md#random-draws) and the game's seed at kick-off, and neither seed advances. So the outcomes, minutes and every later draw are as they would be without them, and only the names change. Under `moment-highlights`, which has no squads, an opponent's moments name only the club.
- **The list** is sorted by minute. Moments in the same minute keep the order they were drawn in.
- **The score** is the number of goal moments. A drawn cup tie is replayed as now. There is no extra time and there are no penalties.

Injuries, tackles and build-up play are not moments. Injuries are still drawn before team selection, as in the original.

The match is decided at kick-off, then the [ticker](#the-ticker) shows it. The attack positions the original carries from one match to the next don't change. The engine uses the game's seeded random numbers, but it can't draw as many of them as the original's attacks do, so every later draw in the same week differs. The next management menu reseeds from the frame counter, as now; how long the ticker runs, and any key that cuts it short, change how many frames have passed by then. `Game` gains no field, so saves are unchanged.

## The ticker

In place of the pitch, the highlights screen lists the moments one at a time in minute order ([`ticker.ts`](../web/src/sim/ticker.ts), [`ticker-layout.ts`](../web/src/view/ticker-layout.ts)). It follows the ruleset, not the presentation mode: original-rules games show the original pitch in either mode.

- **Pace.** After a one-frame clear, the 0-0 header shows for one pause, then each moment appears and holds for one pause of 75 frames (1.5 s). A final hold of one more pause keeps the full list on screen before the result screen, which is unchanged. The sim runs the pauses, so resuming a saved session mid-ticker returns to the same moment ([ADR 0004](adr/0004-resume-exact-session.md)).
- **Keys.** Each pause follows the original's PAUSE: a fresh key or tap ends it, and a held key repeats, so holding one runs through the list ([ADR 0006](adr/0006-taps-reproduce-keypresses.md)). The clear forgets the Enter that kicked off, as CLS does.
- **Skip.** A Skip button in the context bar, shown during the ticker even with touch controls off, or the S key, ends every remaining moment's pause at once but keeps the final hold. It presses no key, so it can't also end the hold.
- **Lines.** Each line opens with the minute and the kind (`GOAL!`, `SAVED:`, `POST!`), then names the player who shot, or the club when no player is named. A goal ends with the score after it, home first. The score under the title counts up as goals appear.
- **Classic mode.** `MATCH HIGHLIGHTS` and the original's score line head the screen. Lines are capitals in 32 columns, newest on top from row 3; past row 21 the oldest drop off for good. A name too long for its line is cut, keeping the minute and score. `GOAL!` is red inverse video. Screen readers hear each new line alone.
- **Modern mode** isn't built yet; its highlights screen ([#45](https://github.com/odogono/fman/issues/45)) will show the ticker in its paper-and-ink style.

The ticker adds frames before the next reseed, so later draws differ from the [baseline](baseline/moment-highlights.md), which was measured with no ticker. That shifts results only as any change in pace does.

## How the numbers were chosen

With even strengths, the original averages about 5.4 attacks a match, and 55% of them end in a goal (3,000 matches with `simulateHighlights`, carrying the attack positions between them). Its outcome depends only on where the players stand, never on the strengths. With the same chances and the same goal rate, the moments should score as the original does. They do, so 55% needed no tuning. The split of the rest between saves and near misses changes no result, so it isn't measured.

## Result

Measured alone against `original`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/moment-highlights.md)). League win rate:

| Level | Passive       | Balanced      | Rotating      | Aggressive    |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 54.5% → 55.0% | 78.4% → 78.7% | 77.5% → 78.1% | 71.8% → 72.6% |
| 2     | 42.7% → 42.3% | 69.5% → 70.3% | 68.5% → 68.1% | 61.8% → 61.7% |
| 3     | 30.8% → 31.6% | 58.6% → 58.6% | 57.6% → 57.5% | 49.4% → 49.9% |
| 4     | 22.8% → 21.9% | 44.5% → 45.3% | 45.4% → 44.7% | 37.2% → 39.0% |
| 5     | 15.0% → 15.1% | 32.1% → 31.5% | 33.1% → 32.7% | 26.0% → 27.1% |
| 6     | 9.9% → 10.3%  | 21.0% → 21.0% | 24.1% → 24.0% | 18.9% → 17.4% |
| 7     | 6.6% → 6.9%   | 13.8% → 13.1% | 17.0% → 17.1% | 12.9% → 13.1% |

Goals for and against per league match:

| Level | Passive               | Balanced              | Rotating              | Aggressive            |
| ----- | --------------------- | --------------------- | --------------------- | --------------------- |
| 1     | 2.01–1.34 → 2.02–1.32 | 2.77–0.75 → 2.77–0.73 | 2.74–0.79 → 2.74–0.76 | 2.53–0.92 → 2.53–0.89 |
| 2     | 1.68–1.64 → 1.67–1.63 | 2.46–0.96 → 2.46–0.93 | 2.44–1.00 → 2.41–0.99 | 2.21–1.16 → 2.21–1.14 |
| 3     | 1.38–1.96 → 1.39–1.94 | 2.11–1.22 → 2.12–1.21 | 2.09–1.26 → 2.09–1.24 | 1.89–1.46 → 1.87–1.44 |
| 4     | 1.15–2.25 → 1.12–2.27 | 1.74–1.58 → 1.75–1.55 | 1.78–1.56 → 1.75–1.56 | 1.57–1.78 → 1.57–1.71 |
| 5     | 0.93–2.59 → 0.93–2.55 | 1.41–1.94 → 1.41–1.94 | 1.48–1.91 → 1.45–1.91 | 1.28–2.14 → 1.29–2.08 |
| 6     | 0.76–2.84 → 0.77–2.83 | 1.12–2.31 → 1.11–2.29 | 1.22–2.20 → 1.22–2.19 | 1.09–2.37 → 1.03–2.40 |
| 7     | 0.62–3.09 → 0.63–3.05 | 0.90–2.61 → 0.86–2.59 | 1.02–2.47 → 1.01–2.46 | 0.89–2.65 → 0.89–2.62 |

Against the issue's three tests:

1. **League win rate** moves by at most 1.8 points (aggressive at level 4), well within 5.
2. **Goals** for and against move by at most 0.07 for these strategies, and 0.15 for the random bot (goals against at level 2), within 0.3.
3. **Promotions and final division** move both ways from level to level, with no consistent shift.

Of 630 metric means, 43 differ beyond sampling noise, all small and in both directions. Goals against is slightly lower at most levels (by 0.02–0.07), probably because the reseeds after each match differ. `bun run baseline:compare docs/baseline/original.json docs/baseline/moment-highlights.json` reproduces the comparison.
