# fman

A web recreation of Kevin Toms' ZX Spectrum Football Manager. The first goal
is the original game's behaviour and presentation; enhancements follow later.

Currently supports setup, management, home/away league fixtures and all eight
cup rounds (including replays), with selection, highlights, tables, bills and
transfers, season bonuses, promotion/relegation and new-season resets.
Debt-cap dismissal, explicit reloading and club/player name editing are supported.
Versioned web save files can be downloaded with `keep` and loaded explicitly. Exact interpreter pacing and ROM-pixel rendering are not yet established.

```sh
bun install
bun run dev
bun run check
bun run build
```

See the [original-game analysis](docs/original-game-analysis.md),
[compatibility foundation](docs/spectrum-compatibility.md) and
[first-match verification](docs/first-league-match.md), plus
[transfer verification](docs/transfer-market.md),
[first-cup verification](docs/first-cup-round.md) and
[league continuation](docs/league-progression.md), plus
[complete cup progression](docs/cup-progression.md) and
[season progression](docs/season-progression.md) and
[dismissal/reloading](docs/dismissal-restart.md) and
[name editing](docs/name-editing.md) and [web saving/loading](docs/save-load.md).
Original game files belong under gitignored `roms/` and must never be committed.
