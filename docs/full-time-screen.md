# Full-time screen

Modern mode's form of the original's final score. Classic mode keeps the original screen under both rulesets, as ADR-0008 and ADR-0010 allow.

## The original

After the highlights, the original prints a red `**** FINAL SCORE ****` bar, both clubs and their goals on one line, and `Gate receipts £n` in a blue bar, then waits for Enter. It names no scorers.

## The screen

- **Title**: the competition, as the Home screen words it ("League match – Division 4", "F.A. Cup – Round 3").
- **Scoreboard**: the home club, the score and the away club, each club in its name colour as on the highlights' scoreboard strip, with FT under the score. Names longer than 10 characters give way to their three letters on a phone. The original's attacks have no minutes, so an Original-rules match shows no FT.
- **Goals** (moment highlights only): one column of scorers under each club, home on the left. A scorer has one row, with the minutes of each goal they scored, as `Holt 41′` or `Frost 80′, 87′`, in the order of their first goal. An opponent's goal names its scorer from the opponent's squad; without a squad it shows only its minute. Saves, clearances and near misses are left out, since the highlights showed them.
- **Replay**: a drawn cup round adds "Drawn – a replay to come". The original's `Replay-` screen still follows.
- **Injured** (match injuries only): each of the managed club's players injured in the match, and how many matches they miss, as "Injured Opoku, out for 2 matches". The tackler is left out, since the clip named them.
- **Gate receipts**: one money row, formatted as on the Home screen (£5,000).
- **Continue**: the yellow primary action, which answers Enter (`result.continue`).

An Original-rules match shows only the title, the scoreboard, the gate receipts and Continue, since the original's attacks name no scorers and nothing may be invented.

On a wide window the Home screen stays on the left, as beside Modern mode's other screens.

## The view

The session's `result` view carries the match's `moments` under moment highlights, and none when the original's attacks decided the match. `fullTimeFor` (`web/src/view/full-time.ts`) builds the screen from the view alone.

## Later

The week's results and the league table follow it as Modern screens (see [mobile-play.md](mobile-play.md)). The cup replay notice and cup result still show Classic inside the Modern frame.
