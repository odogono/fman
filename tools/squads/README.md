# Invented squads

`bun run squads` writes `web/src/sim/data/club-squads.json`: a squad of 12 for every present-day club (1 goalkeeper, 3 defenders, 4 midfielders, 4 attackers) and 128 free agents (8 goalkeepers, 35 defenders, 43 midfielders, 42 attackers). These are the players of `club-squads` (#113, [ADR 0012](../../docs/adr/0012-every-club-owns-a-squad-of-invented-players.md)).

Every name is an initial and a surname from [surnames.ts](surnames.ts), drawn from a fixed seed, so running the script again gives the same file. `generate.test.ts` fails if the checked-in file and the script disagree.

To change a name, don't edit the JSON file. Add `"drawn name": "new name"` to [overrides.json](overrides.json) and run `bun run squads` again; only that player changes. To change the mix of names, edit the surname list and rerun, which redraws every player. Make either change before the file's Enhanced version ships. After that, the file is frozen (ADR 0011).
