# Original-game tooling

Research tools that run the original ZX Spectrum game to capture behaviour. They are not app dependencies; CI uses the committed fixtures in `web/src/sim/fixtures/`.

## Setup in a worktree

1. `bun run zx:link`: symlink the gitignored `roms/` from the main checkout. Everything below reads and writes there, so `roms/zx/analysis/` is shared across worktrees.
2. `bun run zx:extract`: decode the supplied snapshot into `roms/zx/analysis/` (`listing.bas` is the original BASIC listing, `basic.json`, `ram.bin`).
3. `bun run zx:snapshot && bun run zx:observe`: build a fresh-game snapshot from the tape, then play scripted steps, writing numbered snapshots (`23-colours.z80`, `24-fresh-menu.z80`, `10-bills.z80`, …) that the capture tools start from.

Python tools run through `uv run --with skoolkit==10.2 <tool>.py`, never a hand-built virtualenv.

## Capture tools

Each writes `build/zx/<name>.json`; format it with Prettier and compare it to its fixture, as each feature doc shows.

| Tool                       | Starts from                            | Fixture                   |
| -------------------------- | -------------------------------------- | ------------------------- |
| `capture-setup.ts`         | `23-colours.z80`                       | `fresh-setup.json`        |
| `capture-match.ts`         | `24-fresh-menu.z80`                    | `first-matches.json`      |
| `capture-cup.ts`           | `24-fresh-menu.z80`                    | `first-cups.json`         |
| `capture-later-cups.ts`    | `24-fresh-menu.z80`                    | `later-cups.json`         |
| `capture-league.ts`        | `24-fresh-menu.z80`                    | `league-progression.json` |
| `capture-names.ts`         | `24-fresh-menu.z80`                    | `names.json`              |
| `capture-name-layouts.ts`  | `24-fresh-menu.z80` and `10-bills.z80` | `name-layouts.json`       |
| `capture-transfers.ts`     | `10-bills.z80`                         | transfer fixtures         |
| `capture-seasons.ts`       | `10-bills.z80`                         | `seasons.json`            |
| `capture-dismissal.ts`     | `10-bills.z80`                         | `dismissal.json`          |
| `capture-compatibility.ts` | (none; optional sample count)          | `spectrum-rom.json`       |
