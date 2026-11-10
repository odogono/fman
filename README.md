# fman

A web recreation of Kevin Toms' ZX Spectrum Football Manager. The first goal
is the original game's behaviour and presentation; enhancements follow later.

Currently supports fresh setup, club management and the first league match,
including team selection, highlights, results, bills and the transfer market.
Further fixtures, name editing and saving are still in progress. Exact
interpreter pacing and ROM-pixel rendering are not yet established.

```sh
bun install
bun run dev
bun run check
bun run build
```

See the [original-game analysis](docs/original-game-analysis.md),
[compatibility foundation](docs/spectrum-compatibility.md) and
[first-match verification](docs/first-league-match.md), plus
[transfer verification](docs/transfer-market.md).
Original game files belong under gitignored `roms/` and must never be committed.
