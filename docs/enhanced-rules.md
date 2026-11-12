# Enhanced rules

[#84](https://github.com/odogono/fman/issues/84), [ADR 0009](adr/0009-enhanced-rules-by-default.md). Players choose between two rulesets when starting a new game: **Enhanced rules**, the default, and **Original rules**, which hold rules parity.

## Choosing

The game menu's New game step offers Enhanced first, then Original, each with a line saying what it means, and a Start button. The choice is remembered per browser with the other options and pre-selected next time; a first visit, with nothing remembered, starts Enhanced. The menu shows the current game's rules under its title ("Rules: Enhanced"), and each save slot shows its game's rules. The reproduced Spectrum screens are unchanged in both presentation modes.

A game keeps its rules for good: through the autosave, save slots, save files and the original's NEW, which restarts under the rules of the game it clears. Games started before rule choice existed play Original rules ([save version 7](save-load.md)).

## Versions

Enhanced rules are released in versions, stored as `enhanced-1`, `enhanced-2` and so on, and shown to players only as Enhanced. A new Enhanced game starts with the latest version, and a game keeps the version it started with, so every released version stays playable.

| Version      | Changes from the original                                                                                                           | Measured as                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `enhanced-1` | [Smoother difficulty curve](even-difficulty.md)                                                                                     | `even-difficulty` ([#73](https://github.com/odogono/fman/issues/73))                                                                           |
| `enhanced-2` | Version 1, plus a [grace period before dismissal](grace-period.md)                                                                  | `grace-period` ([#74](https://github.com/odogono/fman/issues/74))                                                                              |
| `enhanced-3` | Version 2, plus [present-day clubs and players](present-day-clubs.md)                                                               | Against `enhanced-2` ([#91](https://github.com/odogono/fman/issues/91))                                                                        |
| `enhanced-4` | Version 3, plus [skill that lasts between seasons](lasting-skill.md) and a [steeper difficulty curve](steep-difficulty.md) to match | `lasting-skill` ([#72](https://github.com/odogono/fman/issues/72)), then `steep-difficulty` ([#90](https://github.com/odogono/fman/issues/90)) |
| `enhanced-5` | Version 4, plus [injuries that depend on energy and last](tiring-injuries.md)                                                       | `tiring-injuries` ([#98](https://github.com/odogono/fman/issues/98))                                                                           |
| `enhanced-6` | Version 5, plus [a squad of invented players for every club](club-squads.md), with transfers from free agents                       | `club-squads` ([#113](https://github.com/odogono/fman/issues/113))                                                                             |
| `enhanced-7` | Version 6, plus [matches decided as moments](moment-highlights.md), shown as a ticker in place of the pitch                         | `moment-highlights` ([#107](https://github.com/odogono/fman/issues/107), [#109](https://github.com/odogono/fman/issues/109))                   |

Starting clubs and players are part of a ruleset too ([ADR 0011](adr/0011-rulesets-carry-starting-clubs-and-players.md)). A change that leaves every rule alone, as `enhanced-3`'s, needs no experimental ruleset: its baseline must match the previous version's.

A rule change is built as an experimental ruleset holding that change alone and measured against `original` with the [gameplay baseline](gameplay-baseline.md). Once accepted, it joins Enhanced as a new version, with its own committed baseline (`docs/baseline/enhanced-<n>.*`) compared against the previous version's, and the experimental ruleset is retired. The New game description of Enhanced names what the latest version changes.

`enhanced-1` is the `even-difficulty` rule under a new name: its [baseline](baseline/enhanced-1.md) is identical cell for cell to [the one measured for #73](baseline/even-difficulty.md).
