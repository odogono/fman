# Natural positions ruleset

[#121](https://github.com/odogono/fman/issues/121). A picked player can play out of position, in goal or in another playing category, and counts for less the further that is from his position ([glossary](../GLOSSARY.md): **Position**, **Out of position**). Measured as the experimental ruleset `natural-positions`: `enhanced-14` plus this rule alone ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)). It needs [club squads](club-squads.md), whose players have positions.

## The rule

- **Out of position, outfield**, a player counts his skill less 1 for each line away, never below 0: defence to midfield or midfield to attack is −1, defence to attack −2.
- **Goal.** The player in goal adds his skill to defence, as a goalkeeper did before. An outfielder in goal counts 1, and so does a goalkeeper outfield. With nobody in goal, defence loses 3, the average goalkeeper's skill. A goalkeeper is still never required ([#113](https://github.com/odogono/fman/issues/113)).
- **Where he plays** lasts while he is picked. A player picked by his number alone plays in his position, or in defence for a goalkeeper when goal is already filled; dropped or injured and picked again, he starts in his position. A new game puts its picked team in position, the first goalkeeper in goal.
- **It counts everywhere a category does** for the managed club: team strength and the shooter weighting in moments. Other clubs pick no team, so their [squad strength](squad-strength.md) is unchanged.

The numbers are starting values, not tuned.

## Answers

At the selection prompt, a player's number and a line letter, `G`, `D`, `M` or `A` in either case, puts him there: `14A` plays number 14 in attack. A reserve is picked there; a picked player moves. A number alone keeps the original's meaning. Moving isn't an add, so it is taken even over eleven picked, when the original only drops; a reserve is then refused with `PLAYER NOT IN TEAM`. Putting someone in goal sends whoever was there back to his position, or to defence for a goalkeeper. The sim offers every such answer ([ADR 0019](adr/0019-the-sim-offers-each-prompts-answers.md)).

`Game` gains each player's `plays`, so the save version is 16 ([save-load.md](save-load.md)). The rule draws nothing: every random draw is as under `enhanced-14`.

## On screen

- **Classic.** The squad screen still lists by position. A player out of position shows the skill he counts and his own, as `3(4)`, and in the status column the letter of the line he plays in, in red, in place of `p`. The selection prompt adds `OR No.+G,D,M,A to place him` ([ADR 0010](adr/0010-enhanced-rules-speak-on-the-original-screens.md)), and the soft keyboard has letters.
- **Modern.** The pick team screen groups the team by where each player plays: Goal, Defence, Midfield, Attack, then the reserves and injured. A player out of position has his line beside his name and the skill he counts. On the selection prompt a player is dragged to a line, or to the reserves to drop him, and each line shows what he would count there. A mouse drags at once; a finger holds for a quarter of a second first, so the list still scrolls. Tapping a player and then a line's heading does the same without dragging. Over eleven picked, Done reads `Drop 1 to continue` and waits.

The design came from a [prototype](https://github.com/odogono/fman/tree/prototype/121-natural-positions) of five ways to place a player.

## The bots

The bots play as before, with one change under this rule: they field their best goalkeeper in goal and leave other goalkeepers out unless they're needed to make eleven. They never move anyone else out of position, so this measures the rule's cost to a manager who doesn't use it, not what moving players can win.

## Result

Measured against `enhanced-14`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/natural-positions.md)). League win rate:

| Level | Passive       | Balanced      | Aggressive    | Rotating      |
| ----- | ------------- | ------------- | ------------- | ------------- |
| 1     | 37.7% → 36.6% | 84.7% → 82.8% | 64.5% → 63.0% | 75.9% → 73.6% |
| 2     | 19.3% → 19.8% | 68.8% → 66.7% | 41.9% → 42.7% | 55.5% → 52.9% |
| 3     | 15.9% → 14.7% | 62.0% → 59.4% | 35.3% → 35.1% | 46.9% → 43.9% |
| 4     | 12.6% → 12.2% | 54.9% → 50.9% | 29.4% → 28.2% | 41.7% → 38.2% |
| 5     | 10.5% → 10.6% | 47.6% → 45.2% | 25.0% → 24.7% | 36.1% → 33.5% |
| 6     | 8.9% → 8.3%   | 41.5% → 38.6% | 22.5% → 20.6% | 32.5% → 30.3% |
| 7     | 8.1% → 7.9%   | 38.0% → 35.2% | 21.0% → 20.2% | 30.2% → 28.3% |

Balanced and rotating lose 2–4 points and up to half a promotion in 10 seasons, and pick up about one more injury a season. Before, they fielded goalkeepers like anyone else, by skill × energy; now one always plays, tired or not, and his injury leaves goal empty. Of 630 metric means, 167 differ beyond sampling noise.
