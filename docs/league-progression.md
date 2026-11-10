# Continued league play

After the first cup tie and its transfer market, management now continues into league matches two and three. The subsequent [cup-progression increment](cup-progression.md) now implements rounds two through eight, including the final after league match fifteen. After cup elimination, league play continues through match fifteen, then continuing through the [season transition](season-progression.md).

## Original rules retained

The schedule counter advances modulo three. Every third event is a cup tie while the club remains in the cup; elimination makes all events league fixtures without stopping that counter. The first league fixture is home, then league grounds alternate independently of cup grounds and replays. A dedicated `leagueHome` field preserves that history.

The opponent is the next division slot, with the managed club's own slot replaced by slot sixteen. Its five strengths are `clamp(INT(R(14)+level+opponentPoints/matchesPlayed))`, after incrementing the league-match count. Home receipts use the current home gate. Away receipts are `(17-opponentRank)*(5-division)*500`, using the previous table. Fixture names, ranks and scores follow home/away order; the strength summary keeps the managed club first.

Preparation retains the player-refresh rules introduced with the [first cup round](first-cup-round.md). Highlights carry positions between fixtures. Results credit goals and points to the correct sides; wins/losses adjust morale and future home gate even at away grounds. Other clubs' goals use `INT(points/matchesPlayed+RND*4)` with Spectrum calculator arithmetic.

Table calculation starts from the previous table order after the opening match. The original finite-pass bubble sort swaps even completely tied neighbours, so resetting the order to club IDs changes ranks. The resulting ranks feed the following fixture's receipts. Bills, overdrafts and transfers retain the existing flow.

## Original-runtime evidence

`web/src/sim/fixtures/league-progression.json` contains ten controlled runs: five league-entry seeds (0, 1, 42, 219, 65535) after each of two first-cup outcomes (seed 0 advancement, seed 1 elimination). Both opening matches and cup ties use the default team without selection changes or purchases. Each league entry explicitly sets SEED after the management reseed, so the observations do not depend on emulator input timing.

Nine runs capture league matches two and three; the eliminated seed-zero run captures matches two through fifteen. These thirty-two matches test opponent and ground selection, strengths, receipt values, refresh RNG/status/energy, highlight scores/seeds/carried positions, all sixteen clubs' cumulative goals/points/ranks, finances, weekly balance and final RNG state. First-league and first-cup regression observations remain in place. Session tests also exercise cup scheduling and continuation into the next season.

```sh
bun tools/zx/capture-league.ts roms/zx/analysis/24-fresh-menu.z80
bunx prettier --ignore-path /dev/null build/zx/league-progression.json > build/zx/formatted-league-progression.json
cmp build/zx/formatted-league-progression.json web/src/sim/fixtures/league-progression.json
bun test web/src/sim/league-progression.test.ts web/src/sim/schedule.test.ts web/src/sim/session.test.ts
```

The optional SkoolKit 10.2 adapter validates the fresh BASIC hash and profile and exports numeric observations. Originals and checkpoints remain ignored under `roms/`.

## Remaining scope

[Season bonuses, promotion/relegation and reset](season-progression.md) are now implemented. [Dismissal and reloading](dismissal-restart.md) are now implemented. [Name editing](name-editing.md) is now implemented. [Web saving/loading](save-load.md) is now implemented. The [complete cup progression](cup-progression.md) now keeps the final playable after league match fifteen; after the cup campaign ends, final bills continue into the season-change routine. Its zero match count skips the transfer market. Crossing the debt cap now follows the original dismissal and `NEW` sequence before transfers or season progression.

Existing [presentation and timing limits](first-league-match.md#presentation-limits) still apply. Completion remains atomic at the bills boundary while screens present the source's sequence.
