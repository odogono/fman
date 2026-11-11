# Mobile play (phase two design)

Design decisions for making the game playable without a keyboard, chiefly on phones. This is phase-two work, unblocked by [ADR 0008](adr/0008-relax-presentation-parity.md). The mockups are AI-generated references for look and layout; their wording, names and numbers are illustrative, not specs.

## Principles

- Two **presentation modes**, Classic and Modern, drive one unchanged sim. Players can switch mid-game from Settings.
- Every tap submits an answer the original `INPUT` prompt accepts ([ADR 0005](adr/0005-touch-input-submits-original-answers.md)). Nothing becomes reachable that the original would not allow at that moment.
- Modern mode keeps the original pacing and RNG behaviour. Tap to skip works wherever the original accepts "any key". A faster pace would be a later option, explicitly marked as not faithful.
- Desktop keyboard entry keeps working in both modes.
- Free text (club and player names) uses the native soft keyboard; routine play needs no typing.

## Answer mapping

A view-side layer (`web/src/view/answers.ts`) reads the session view and lists each prompt's **offered answers**. Both presentation modes render their touch controls from it and submit through its `tapAnswer`.

- **Valid answers** are every input a prompt handles differently from other input, including answers that end in one of the original's error messages. Tests use this full set.
- **Offered answers** are a subset: the listed options on choice prompts; the numbers shown on screen for squad, team selection and the names lists; and free number entry where the original asks for an amount (borrow, repay, bid). Error-only answers on choice prompts, such as colour `3`, stay reachable from the keyboard.
- Each offered answer has a stable id and its answer text (for example `menu.status` → `s`). Each mode writes its own label.
- Where any input moves on, a tap submits an empty answer (plain Enter). Team selection never offers this, because an empty answer there means player 0.
- The save question and the sale offer show plain Yes and No buttons. No submits `n` with no extra confirmation, as in the original.
- Print (`h`) is not an offered answer. It moves to the game menu (#47); keyboard players can still type it.
- Taps reproduce keypresses as well as answers ([ADR 0006](adr/0006-taps-reproduce-keypresses.md)). A tap that submits an answer presses Enter and holds it until the finger lifts; a long press held into the highlights can shorten their pauses, as a held key does. During a timed pause, a tap on the game area is a keypress for as long as the finger is down. At any other time a tap presses no key.

Tests check, screen by screen, that each offered answer is valid and does what the original does. A journal test checks that a short game played by taps matches the same game typed at the same moments: same state, frames and RNG seed.

## Classic mode

The original screen, scaled to fit, with a context bar of large buttons beneath it offering the current prompt's offered answers.

- **Touch controls** in Options: Auto (the default) shows the bar on any device with a touchscreen; On and Off force it. With the bar showing and Display size on Fit window, the screen scales fractionally to the page width.
- Labels give a short wording and the original key, such as "Loan (l)". Numbered answers sit in a grid of number-only buttons; Continue, Kick off, Play, Yes, Done and Next page are full-width yellow; other choices alternate red and blue.
- A button submits as its finger goes down and holds Enter until it lifts. While nothing is offered the bar keeps its height, empty.
- Names show a "Type name" button that opens the soft keyboard; the keyboard's Go key submits, pressing Enter for at least a frame when the keyboard sends no Enter key of its own. While the bar shows, the command line is never focused on its own.
- Amounts (loan, repayment, bid) use touch entry: − and + by £1,000, chips +£10k, +£50k, +£100k and Max, and "Exact amount" for an on-screen keypad. Entry stays within what the original accepts: a loan up to the credit limit less the debt, a repayment up to the smaller of the debt and the cash, a bid up to the cash. A bid starts at the player's value; a loan or repayment at £0. Cancel (0) leaves a loan or repayment the original's way, and Pass (99) declines a bid. Typing on a keyboard can still reach the original's error messages.

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
