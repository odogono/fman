# Fresh-game setup and club management

This increment replaces the seed-check placeholder with the original-style desktop keyboard flow. It implements the first part of the [recreation handoff](original-game-analysis.md), using the [Spectrum compatibility foundation](spectrum-compatibility.md).

## Available flow

The title waits 300 emulated frames or a new keypress, then asks for a manager name. Names longer than twenty characters show the original error and pause before retrying. Club choices are paged in groups of sixteen using `99`; a club can only be selected from the displayed page. Difficulty is 1–7, followed by black (0) or white (7) kit colours.

Every chosen club is swapped into slot 64 and starts in Division 4. Starting cash is £100,000, debt is zero, morale is 10 and completed seasons/rating are zero. Twelve distinct players are drawn from the original pool: eleven picked, one reserve. Skill, energy and value are then generated for all 24 slots in the original order. The first management-menu entry reseeds from the explicit FRAMES counter, as line 100 does; returning from a menu action does not reseed.

The original menu accepts line input followed by Enter:

| Command | Behaviour                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| `s`     | Show club/manager status and finances; Enter returns                                                           |
| `a`     | List owned players and picked/injured markers; enter a player number to obtain a sale offer, or `99` to return |
| `l`     | Borrow within the division-dependent credit limit                                                              |
| `p`     | Repay within outstanding debt and available cash                                                               |
| `level` | Change difficulty, preserving the original validation and confirmation                                         |
| `h`     | Use browser printing as the screen-copy equivalent at supported prompts                                        |

The original explicit lower- or uppercase command forms are accepted, rather than arbitrary mixed case. Numeric prompts accept digits only; blank numeric input means zero. Accepted sale offers remove ownership and increase cash. Refusing an offer consumes the original additional random draw and can injure the player. Injured players cannot be sold.

`99` from the main menu now enters the [first league-match flow](first-league-match.md). `change` now opens [club and player name editing](name-editing.md). `keep` now downloads a [web save](save-load.md) before asking whether to continue. Subsequent increments add further fixtures and seasons. The build's supported scope is also stated outside the reproduced game screen. Browser refresh starts a new game; a downloaded web save can be explicitly loaded.

## Boundaries and verification

`sim/management.ts` creates and updates immutable game state; `sim/session.ts` implements input phases, retries, pauses and clock-based reseeding. The simulation imports no DOM or clock API and draws randomness only through `rng.ts`. Sale-price arithmetic uses the Spectrum calculator helpers. Current cash/debt updates are bounded integer operations, exact in both host arithmetic and Spectrum precision for this slice.

The view paints a 32-column, 22-row main display with two input rows, preserving the original palette, fixed player columns and inverse markers. Difficulty labels reproduce `PAPER 9` contrast, including white text on black for Genius. A provenance-tracked bitmap atlas derived from the independently sourced public-domain Spectrum redraw now renders the game text; [glyph comparisons](glyph-raster-fidelity.md) establish the original printable/block repertoire at 8 × 8 pixels. Original tape/ROM files and full extracted listings remain gitignored.

The startup fixture was captured from the original, at BASIC line 8999 before the first frame-based reseed, after entering manager `alex`, club 1, level 1 and colour 0. The tape's initial seed is 0. All 24 player status/skill/energy/value records and the final seed 12124 match the TypeScript implementation. Reproduce the capture using the original-analysis fresh-mode checkpoints:

```sh
uv run --with skoolkit==10.2 tap2sna.py 'roms/zx/Football Manager.tzx' roms/zx/analysis/local-original.z80
bun tools/zx/observe.ts roms/zx/analysis/local-original.z80 roms/zx/analysis fresh
bun tools/zx/capture-setup.ts roms/zx/analysis/23-colours.z80
bunx prettier --ignore-path /dev/null build/zx/fresh-setup.json > build/zx/formatted-fresh-setup.json
cmp build/zx/formatted-fresh-setup.json web/src/sim/fixtures/fresh-setup.json
```

A targeted emulator probe also sets SEED to 219 at the fresh management menu, opens the squad list and requests player 1. The original offers £13,888 from Hull and leaves SEED at 57833; a parity test checks all three. This probe changes the seed explicitly to isolate price generation from unimplemented BASIC execution timing.

Tests cover setup/state parity, ownership counts, club swapping, loan limits, repayment errors, sale outcomes, input phases, original case handling, pause transitions, screen positions and difficulty contrast. Browser checks exercise setup, club paging, loans, status, squad listing, a completed sale and difficulty choices; rendered screens are inspected. A regression test covers animation timestamps preceding initialization, which previously could advance the simulation by a negative frame count.

## Fidelity still to establish

Later features are listed in the [docs index](README.md). Native browser line editing replaces the Spectrum's editor and mode cursor; arbitrary Unicode/control-code entry, exact long-input error behaviour and byte-for-byte screen formatting outside the name layouts in [name-layout-fidelity.md](name-layout-fidelity.md) have not been reproduced. The [glyph raster pass](glyph-raster-fidelity.md) establishes glyph shapes and ordinary cell colours, inverse and brightness; whole-screen pixel equality remains unverified. Prompt beeps and cycle-accurate BASIC execution/pacing also remain to be implemented.

View timing converts elapsed browser time into explicit frames at the validated PAL 48K cadence of 19.968 ms, including time spent in a background tab. Input dispatch samples elapsed time before applying commands; see [frame cadence and reseeding](frame-clock-and-reseeding.md) for the scheduling and save policies. [Measured highlights and timed screens](highlight-pacing.md) now estimate their interpreter paths, PRINTs and BEEPER costs. Other management/setup paths still use atomic boundaries. Player draws at setup and observed reseed boundaries are verified, but later live-input RNG seeds cannot yet be claimed to match a physical Spectrum at identical wall-clock input times.

The visual palette deliberately follows the original rather than substituting modern contrast colours. An accessible text transcript and named input expose content independently of the coloured glyphs. The browser accessibility audit reports no automatic violations; original-colour contrast remains a manual-review item.
