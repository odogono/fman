# Club squads ruleset

[#113](https://github.com/odogono/fman/issues/113), [ADR 0012](adr/0012-every-club-owns-a-squad-of-invented-players.md). Under the Enhanced rules from version 6, every present-day club owns a squad of invented players, and the players who belong to no club are free agents. The change was measured as the experimental ruleset `club-squads`, which was `enhanced-5` with club squads ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then became [`enhanced-6`](enhanced-rules.md). The club list and the season-end changes need present-day clubs and lasting skill, so the measurement builds on `enhanced-5` rather than on `original`, as [steep difficulty](steep-difficulty.md) built on lasting skill.

This version is groundwork. Squads don't change how matches play: opponent strength, the highlights and other clubs' results are as before.

## The players

[`tools/squads/`](../tools/squads/README.md) writes the 896 invented players to `web/src/sim/data/club-squads.json`:

- A squad of 12 for every present-day club: 1 goalkeeper, 3 defenders, 4 midfielders and 4 attackers.
- 128 free agents: 8 goalkeepers, 35 defenders, 43 midfielders and 42 attackers.

That is four players to each playing category in a squad, with the goalkeeper among the defence, and the free agents as near even as 128 allows. The original draws a new game's 12 players and its transfer list evenly from the three categories, and a more realistic mix measured worse (below).

A player's **position** belongs to him. A goalkeeper counts as a defender, in team strength and anywhere else a playing category is used, and no rule says one must be picked.

## The 24 places

The original has 24 players, and a player's number 1–24 is his place in the list, his NO. on screen, the answer the manager types, and his playing category (1–8 defence, 9–16 midfield, 17–24 attack). Under club squads the managed club still sees those 24 numbered places. They hold its squad and the **transfer list**: free agents, in the places the squad doesn't fill. Everyone else, in the other 63 squads or among the remaining free agents, is outside the places.

So the NO. column, every prompt and error message, and the bots' answers stay as they were. Only the playing category changes: it comes from the player's position, not his number.

## The rule

- **New game.** The original's loop draws 12 of the 24 places. The managed club's 12 players go into them in place order, so the reserve, the 12th place drawn, can be any of them. Free agents are drawn into the other 12 places.
- **Transfer offers** come from the transfer list, as from the unowned players in the original. A player bought keeps his place.
- **Selling.** The buyer is drawn from all 64 clubs as in the original. The player joins that club's squad, and a free agent from outside the places is drawn into his place. If the draw is the managed club itself, the original's quirk, he stays in his place as a listed free agent and can be offered back.
- **Season end**, in this order:
  1. Other clubs with more than 12 players release their most recent signings to the free agents. The managed club's squad is never trimmed.
  2. The transfer list's free agents return to the free agents, and new ones are drawn into their places.
  3. The original's draws over the 24 places, with lasting skill as in `enhanced-5`.
  4. Players in other clubs' squads drift as the managed club's do, and the other free agents reroll.
- Other clubs' players are never injured, and their energy isn't kept.

## On screen

- The squad and transfer screens tag each player by his position: `D█`, `M█` and `A█` as before, and `G█` for a goalkeeper, in defence's ink.
- The squad screen lists the squad by position, goalkeeper first, then defence, midfield and attack, and by number within each, since a bought player can take any place.
- The name editor renames the 64 clubs and the 24 places. Its player pages are titled `Players 1-8`, `Players 9-16` and `Players 17-24`, since positions no longer follow the numbers. Other clubs' players can't be renamed.
- **Clubs**, in the game menu, lists any club's squad by name and position, without skill. It opens on the managed club. Free agents aren't listed, so the weekly offer is still a surprise.

## Random draws

The Spectrum RND sequence sees exactly the draws `enhanced-5` makes. Every draw over the 24 places is the original's: the new game's loop and rolls, the weekly refresh, the transfer offer and the season end. Everything squads add draws from a second stream, the squad seed, which starts from the game's seed and is saved with the game ([save version 11](save-load.md)). Tests in `web/src/sim/club-squads.test.ts` check that a new game, a sale and a season end leave the RND sequence where `enhanced-5` leaves it.

## Result

Measured against `enhanced-5`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/club-squads.md)). 81 of 630 metric means differ beyond sampling noise, most of them small and in both directions:

- **Balanced** wins 1–2 points fewer league matches at some levels (within noise at others), concedes 0.04–0.06 more goals a match, and finishes up to half a league place lower.
- **Rotating** does slightly better: about 2 points more league wins at levels 3 and 5, and more promotions at levels 4 and 5.
- **Passive** scores and concedes about 0.05 fewer goals a match. Aggressive and recovering change by amounts at the edge of noise.

The first measurement used a realistic mix: 1 goalkeeper, 4 defenders, 4 midfielders and 3 attackers in a squad, and free agents of 8 goalkeepers and 40 of each other position. With that mix balanced won 2–5 points fewer league matches at every level and finished up to 1.1 places lower. Balanced picks and buys by skill × energy without regard to category, and each category's strength is capped at 20, so a team heavy in defence wastes skill. The even mix halves that gap and keeps the game closest to `enhanced-5`, as groundwork should.

### Balanced's remaining gap

[#122](https://github.com/odogono/fman/issues/122) found the cause of the rest of balanced's gap. It comes from positions, not from how sold players move.

For the 24 places, `enhanced-6` differs from `enhanced-5` in only two ways. A player's category comes from his position instead of his place, and a sold player is replaced in his place by a free agent. Both rulesets reroll a listed place's skill, energy and value from the RND sequence at the season end. So relisting changes only names and positions. Balanced was measured over 1,000 runs per level, with each difference switched off in turn:

| Balanced, all levels                       | `enhanced-5` | `enhanced-6` | sold players stay listed | category by place | both  |
| ------------------------------------------ | ------------ | ------------ | ------------------------ | ----------------- | ----- |
| League win rate                            | 55.4%        | 54.0%        | 53.8%                    | 55.7%             | 55.4% |
| Picked skill per week                      | 44.5         | 44.6         | 44.5                     | 44.6              | 44.5  |
| Skill above a category's cap of 20, a week | 1.58         | 2.40         | 2.26                     | 1.62              | 1.58  |
| Weakest category's strength                | 12.1         | 11.1         | 11.1                     | 12.1              | 12.1  |

With both switched off, the runs match `enhanced-5` exactly. Keeping sold players on the list doesn't help. Taking a player's category from his place closes the whole gap, at every level.

Balanced fields as much skill as before, but more of it lands in a category that is already full. In the original the transfer list is the places the club doesn't own, so its categories mirror the squad's: a squad short of attackers has more attackers' places on the list. At level 4, 55% of offers fall in the squad's thinnest category under `enhanced-5`, against 43% under `enhanced-6`. The squad's spread between its largest and smallest category grows from 2.35 to 2.95 players. A free agent's position doesn't depend on the squad, so club squads lose this balancing. Balanced buys by skill without regard to category, so it feels the loss most. Aggressive picks the strongest team by category and doesn't lose.

The gap is accepted. The balancing was an accident of the original's numbering, not a rule, and a manager who buys with positions in mind keeps it. A later Enhanced version could draw a listed free agent of his place's category, so that a defender's place gets a defender, but that would need measuring as an experimental ruleset first.
