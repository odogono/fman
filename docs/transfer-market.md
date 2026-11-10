# Transfer market

After the first match's weekly bills, the game now follows BASIC 8700–8788 into the transfer market. Type a bid followed by Enter, or `99` to decline. Copy (`h/H`), numeric validation and blank-as-zero input use the existing line-input flow.

The market repeatedly draws a pool player until finding one not owned. This happens before the sixteen-player squad check, preserving the RNG consumption even when the squad is full. No league matches means no offer. A rejected or unaffordable bid keeps the same player available; there is no reroll on retry.

An affordable bid consumes one `R(10)` draw. The original calculator evaluates `(R(10)*bid)/value`; five or more succeeds. Refusal raises the asking value to `INT(value+value/5)`. Joining deducts the bid, makes the player a reserve, leaves energy untouched and restores value to `skill*5000*(5-division)`. Declining and unaffordable bids consume no acceptance draw. Returning from the market reseeds from the explicit frame clock, corresponding to the next outer `RANDOMIZE` at line 100. Ordinary management submenus do not reseed.

## Original-runtime evidence

`web/src/sim/fixtures/transfers.json` records twenty bid trials: seeds 0, 1, 42, 219 and 65535, each with bids 0, 10000, 50000 and 999999. Each starts from the observed saved-game bills checkpoint, with fourteen owned players, Division 3, £106992 cash and £40000 debt. This progressed state is test evidence, not the fresh game's defaults.

Tests compare selected player, offer and acceptance RNG states, cash, ownership and asking values. Additional tests cover full squads, skipping before any league match, declining, invalid input, repeated refusals, reserve status, screen content and the complete bills→market→management flow. Controlled bid observations stop at the result prompt, before the outer reseed.

To reproduce after generating the saved-mode checkpoints described in [original analysis](original-game-analysis.md):

```sh
bun tools/zx/capture-transfers.ts roms/zx/analysis/10-bills.z80
bunx prettier --ignore-path /dev/null build/zx/transfers.json > build/zx/formatted-transfers.json
cmp build/zx/formatted-transfers.json web/src/sim/fixtures/transfers.json
bun test web/src/sim/transfers.test.ts web/src/sim/session.test.ts web/src/view/transfers.test.ts
```

The optional capture adapter uses SkoolKit 10.2 and checks the checkpoint's runtime BASIC hash and starting profile. The runtime bytes differ from the fresh checkpoint by one mutable `DEF FN` parameter byte; independently detokenized listings are identical. Originals and snapshots remain under ignored `roms/`; the fixture contains numeric observations only.

## Remaining scope

The [first-cup increment](first-cup-round.md) now adds the following cup tie and replays. Later fixtures, season progression, dismissal, name editing and saves remain unavailable. Completing the market returns to management; after the first cup tie, another fixture still reports that it is unavailable. Existing [presentation limits](first-league-match.md#presentation-limits), including native browser line editing, provisional pacing and unverified ROM-pixel equality, still apply. This increment does not add general numeric-overflow error handling for arbitrarily large bids.
