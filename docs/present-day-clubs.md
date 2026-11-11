# Present-day clubs and players

[#91](https://github.com/odogono/fman/issues/91), [ADR 0011](adr/0011-rulesets-carry-starting-clubs-and-players.md). Under the Enhanced rules from version 3, a new game starts with the 2026/27 clubs and the England squad of November 2026 instead of the original's 1982 set, and every club plays in its own colours. The Original rules, `enhanced-1` and `enhanced-2` keep the 1982 clubs and players, and a game keeps whatever names it already has.

## The clubs

Four divisions of 16, one for each 2026/27 tier: Premier League, Championship, League One and League Two. Each keeps the tier's 16 highest finishers of 2025/26 across the whole pyramid: clubs relegated into the tier rank above clubs staying in it, who rank above clubs promoted into it, each by finishing position. So the Premier League's three promoted clubs (Coventry, Ipswich, Hull) and 17th-placed Spurs are left out. In League Two, Accrington take the last place over Gillingham, level on 53 points, on table order. As in the original, the clubs are alphabetical within each division, and the chosen club moves to the bottom of Division 4.

Names follow the original's short style in up to ten characters (`Man.City`, `Sheff.Wed`, `Southamptn`), keeping the original's own `Notts.F.` and `Derby Co`.

Sources: the 2025/26 [Premier League](https://en.wikipedia.org/wiki/2025–26_Premier_League), [Championship](https://en.wikipedia.org/wiki/2025–26_EFL_Championship), [League One](https://en.wikipedia.org/wiki/2025–26_EFL_League_One) and [League Two](https://en.wikipedia.org/wiki/2025–26_EFL_League_Two) tables, matching [ESPN's standings](https://www.espn.com/soccer/standings/_/league/eng.1/season/2025) position for position, and the [2026 EFL play-offs](https://en.wikipedia.org/wiki/2026_EFL_play-offs) (Hull, Bolton and Notts County promoted; Southampton expelled from the Championship play-offs).

## The players

24 players from the [England squad announced on 6 November 2026](https://www.englandfootball.com/articles/2026/Nov/06/england-senior-mens-squad-announcement-for-croatia-spain-games-20261106), eight in each of the original's categories: defence (with one goalkeeper, as the original's Parkes), midfield and attack. Alexander-Arnold moves up to midfield, and Saka, from the [World Cup](https://www.englandfootball.com/articles/2026/May/22/england-mens-world-cup-2026-squad-named-by-thomas-tuchel-20262205) and [September](https://www.englandfootball.com/articles/2026/Sep/18/england-mens-senior-squad-announcement-september-october-20261809) squads, fills the eighth attacking place. Names are an initial and surname in up to eight characters, or the surname alone, with long names shortened by hand (`T.Arnold`, `Gibbs-W.`, `Jude B.`).

## Colours

Each club has a **name colour** and a **kit** ([glossary](../GLOSSARY.md)):

- The name colour is printed wherever the original prints the club's name. Most are an ink on the screen's white, as in the original. Clubs whose colours are white or yellow have their name on a coloured paper (Fulham white on black, Wolves black on yellow), with white or black ink where a club's own two colours don't contrast. After the name, the rest of the line returns to the screen's colours.
- Each club has a home kit and a change kit, both Spectrum inks. In the highlights the home side wears its home kit and the away side its home kit, or its change kit when the two would match.

Kits are not cosmetic. The highlights tell players from grass, and the two sides apart, by each cell's screen attribute ([original-game-analysis.md](original-game-analysis.md)): grass is attribute 102, yellow ink on green paper, and a player is `96 + ink`. So a kit is never yellow (players would read as grass) or green (invisible on the pitch), and the two sides never share an ink. Within those limits, any pair of kits plays a match exactly as black against white: the tests replay every recorded original match with other pairs and compare.

With kits of their own, new `enhanced-3` games skip the original's black-or-white colour question, and the status screen names the managed club's home kit (`Colours = Red`). Renaming a club keeps its kit; its name colour then follows the original's name editor, so any paper goes.

## Measuring it

The rules are `enhanced-2`'s, so `enhanced-3`'s [baseline](baseline/enhanced-3.md) was compared with [`enhanced-2`'s](baseline/enhanced-2.md).

- With the colour question still asked (a temporary build), the `enhanced-3` baseline was identical to `enhanced-2`'s cell for cell: the clubs, players and kits change no result.
- Without it, each run skips one answer and the think time the bots spend on it, so every later reseed lands on a different frame and each run draws different luck. `compare` flags 33 of 455 metric means.
- Re-running `enhanced-2` itself with a different harness seed (`--seed 2`), which re-draws the luck the same way, flags 23 of 455. In both, the flags gather in the same high-variance cells, level 3 aggressive and recovering. The 33 are re-drawn luck, not a change in play.
