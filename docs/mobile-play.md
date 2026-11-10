# Mobile play (phase two design)

Design decisions for making the game playable without a keyboard, chiefly on phones. This is phase-two work: nothing here is built until the phase-one fidelity boundary ([ADR 0004](adr/0004-define-phase-one-fidelity-boundary.md)) is met. The mockups are AI-generated references for look and layout; their wording, names and numbers are illustrative, not specs.

## Principles

- Two **presentation modes**, Classic and Modern, drive one unchanged sim. Players can switch mid-game from Settings.
- Every tap submits an answer the original `INPUT` prompt accepts ([ADR 0005](adr/0005-touch-input-submits-original-answers.md)). Nothing becomes reachable that the original would not allow at that moment.
- Modern mode keeps the original pacing and RNG behaviour. Tap to skip works wherever the original accepts "any key". A faster pace would be a later option, explicitly marked as not faithful.
- Desktop keyboard entry keeps working in both modes.
- Free text (club and player names) uses the native soft keyboard; routine play needs no typing.

## Classic mode

The original screen, scaled to fit, with a context bar of large buttons beneath it offering the current prompt's valid answers.

![Classic mode](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/classic.jpg)

## Modern mode

Style is "paper & ink": light grey paper, black text with red and blue ink rows, the yellow highlight bar as the primary action, black and blue inverse-video bars. The Spectrum pixel font is used for headings; body labels and numbers use a readable sans-serif. Flat colour only. Tap targets are at least 44px and controls carry screen-reader labels.

| Home                                                                                              | Pick team                                                                                                   | Highlights                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ![Home](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/home.jpg) | ![Pick team](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/pick-team.jpg) | ![Highlights](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/highlights.jpg) |

| Transfer bid                                                                                                      | Loan                                                                                              | Status                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ![Transfer bid](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/transfer-bid.jpg) | ![Loan](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/loan.jpg) | ![Status](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/status.jpg) |

- **Home**: club summary, next fixture with "Play next match" (the original's `99`), and the original menu actions as rows. Drop the stacked title banners seen in some mockups.
- **Pick team**: grouped by Defence, Midfield and Attack. Keep the original markers: a `p` block in magenta for picked and an `i` block in green for injured, the legend "p = picked to play, i = injured", a yellow column-header row, and D/M/A blocks and row ink by category (Defence black, Midfield blue, Attack red; the mockup wrongly shows every block black).
- **Highlights**: the original pitch rendering, unchanged and scaled to width. A scoreboard sits above it and the team-strength numbers in two columns below it, as on the original comparison screen.
- **Amounts** (bids, loans, repayments): a stepper with preset chips, plus a numeric keypad for exact values.
- **Desktop**: two panes, the home menu on the left and the selected screen on the right.

![Desktop](https://gist.githubusercontent.com/odogono/00dcc8e44efa42a79b1c8599d68c7496/raw/desktop.jpg)

## Device and platform

- Phone portrait first; wider screens show the same layout centred, or the two-pane desktop layout.
- An installable PWA that plays offline.
- The existing **autosave**, **save slots** and **game menu** ([ADR 0004](adr/0004-resume-exact-session.md)) carry over; mobile adds only touch-sized controls for them.
- The first tap unlocks sound; a mute toggle in Settings remembers the choice.
