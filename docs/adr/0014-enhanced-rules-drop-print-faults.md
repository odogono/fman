# Enhanced rules drop print faults

From Enhanced version 10, a name renamed with Spectrum control codes no longer stops the game partway through printing it. The Original rules keep print faults, and so do games started on Enhanced versions 1–9, because a game keeps the version it started with.

ADR-0008 counted reachable BASIC faults as presentation and kept the stops already reproduced. But a print fault is more than a screen glitch: it ends the manager's game and can leave the league table half-updated. Under the Enhanced rules, a rename shouldn't be able to end a game. The Original rules still need the stops for rules parity, and anyone who wants the original's bugs can choose them.

## Considered Options

- **Drop faults for every ruleset.** This deletes the most code, but the Original rules would no longer match the Spectrum game for the same answers.
- **Keep faults everywhere and let only Modern screens ignore them.** The game would still stop, and Modern mode would show a screen that the game state no longer supports.

## Consequences

The change ships as a new Enhanced version, not a fix to the existing ones. Faults depend on renamed names, which the gameplay baseline's bots never use, so no experimental ruleset measures it first. Screens that can fault must still handle a fault for the Original rules and older Enhanced versions.
