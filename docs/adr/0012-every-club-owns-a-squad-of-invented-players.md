# Every club owns a squad of invented players

Under the Enhanced version that carries `club-squads`, every present-day club owns a squad of twelve players, and the players who belong to no club are free agents, from whom every transfer offer is drawn. The clubs stay real, but every player is invented: a script in `tools/` writes the names once, from a fixed seed and a surname list we keep ourselves, to a JSON file that is frozen with its ruleset version, as ADR 0011 already freezes the clubs. Real squads would have needed a scraper, attribution under CC BY-SA, and new data whenever squads change. Names made fresh at each new game would have given every game new players, but rivals' players could never become familiar and no bad name could be fixed by hand.

## Considered Options

- Real 2026/27 squads from Wikipedia's club articles. The only free source covering all four divisions, but it is share-alike, open to vandalism, and out of date by the next transfer window.
- Bids straight from other clubs' squads. Postponed: a club could lose players until it can't field a team, which only matters once squads decide opponent strength.

## Consequences

This version is groundwork. Squads don't change how matches play: opponent strength is still rolled as in the original, and a goalkeeper counts as a defender with no rule that one be picked. So the gameplay baseline is expected to barely move. Other clubs' squads only grow by buying players the manager sells, and release their most recent signings at the season end to return to twelve, so the free agents never run out. Later versions may make opponent strength depend on squads, allow bids for other clubs' players, or let a player play away from his natural position.
