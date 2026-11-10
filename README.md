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

See [docs/](docs/README.md) for how each feature matches the original.
Original game files belong under gitignored `roms/` and must never be committed.
