# Club squads ruleset

[#113](https://github.com/odogono/fman/issues/113), [ADR 0012](adr/0012-every-club-owns-a-squad-of-invented-players.md). Every present-day club owns a squad of invented players, and the players who belong to no club are free agents. It is measured as the experimental ruleset `club-squads`, which is `enhanced-5` with club squads ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)). The club list and the season-end changes need present-day clubs and lasting skill, so the measurement builds on `enhanced-5` rather than on `original`, as [steep difficulty](steep-difficulty.md) built on lasting skill.

This version is groundwork. Squads don't change how matches play: opponent strength, the highlights and other clubs' results are as before.

## The players

[`tools/squads/`](../tools/squads/README.md) writes the 896 invented players to `web/src/sim/data/club-squads.json`:

- A squad of 12 for every present-day club: 1 goalkeeper, 4 defenders, 4 midfielders and 3 attackers.
- 128 free agents: 8 goalkeepers and 40 of each other position.

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

## Random draws

The Spectrum RND sequence sees exactly the draws `enhanced-5` makes. Every draw over the 24 places is the original's: the new game's loop and rolls, the weekly refresh, the transfer offer and the season end. Everything squads add draws from a second stream, the squad seed, which starts from the game's seed and is saved with the game ([save version 11](save-load.md)). Tests in `web/src/sim/club-squads.test.ts` check that a new game, a sale and a season end leave the RND sequence where `enhanced-5` leaves it.

## Result

Measured against `enhanced-5`: 200 runs per level and strategy, 10 seasons ([full baseline](baseline/club-squads.md)). 77 of 630 metric means differ beyond sampling noise, and most of them are the balanced strategy's:

- **Balanced** wins 2–5 points fewer league matches at every level, concedes 0.06–0.13 more goals a match, and from level 4 finishes 0.6–1.1 league places lower and about 0.3 divisions lower.
- **Passive, rotating, aggressive and recovering** change by at most about a point of league win rate, or by amounts within noise.

So squads don't leave the game as it was. The likeliest cause, not yet confirmed, is the mix of positions. In the original a new game's 12 players are a random draw from 8 of each playing category, and so is the transfer list. Under club squads the managed club starts with a fixed 5 defenders (the goalkeeper among them), 4 midfielders and 3 attackers, and the free agents are split 48/40/40. Balanced picks and buys by skill × energy without regard to category, and each category's strength is capped at 20, so a lopsided team wastes skill. Whether to rebalance the positions, or accept the change, is to be settled before promotion.
