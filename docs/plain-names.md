# Plain names

Enhanced version 10 ([ADR-0014](adr/0014-enhanced-rules-drop-print-faults.md)). Without an experimental ruleset: only renamed names can fault, and the gameplay baseline's bots never rename, so `enhanced-10`'s baseline matches `enhanced-9`'s: 0 of 630 metric means differ beyond sampling noise ([enhanced-10.md](baseline/enhanced-10.md)).

## The original

The original's name editor takes Spectrum control codes typed in Extended mode: INK, PAPER, FLASH, BRIGHT, INVERSE, OVER, AT and TAB, plus comma, backspace and newline. A club's leading `INK n` (0–4) sets its name colour. Anywhere else, a control code is stored as part of the name and runs each time the name is printed. A bad colour, or an AT or TAB pointing off the screen, stops the game with a report such as `K Invalid colour` or `B Integer out of range`. That is a print fault. Depending on where it happens, the game stops in the name editor, partway through a week's results and table (with the league half-updated), or at the season end. A colour prefix with no name after it stops on `3 Subscript wrong`. [name-print-fidelity.md](name-print-fidelity.md) records all of this.

## The rule

Under `plainNames` (`web/src/sim/ruleset.ts`), a new name may not contain a byte below 32, apart from a club's leading `INK n`.

- A club name with a control code after its colour or first letter is refused with `INVALID TEAM NAME`, and a player name with `INVALID PLAYER NAME`. The editor asks for the name again, as for any other invalid name.
- A colour with no name after it is refused with `INVALID TEAM NAME` rather than stopping.
- Graphics blocks, UDGs and BASIC tokens (bytes 128–255) still make a name, as does the leading colour.

Only the name editor creates names, and starting names carry none, so no later screen, week or season end can fault. The fault code stays for the Original rules and for games started on Enhanced versions 1–9.

`web/src/sim/plain-names.test.ts` replays every name captured from the original under `enhanced-10`. 43 of those 338 edits stop the Original rules' editor. None stops version 10's.
