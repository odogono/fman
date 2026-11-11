# Name scrolling and long-name layouts

This pass replaces fixed name-entry offsets with sequential screen output.
The name editor records what the game printed since its last page redraw;
the view replays those events through a 32-column PRINT cursor. All gameplay
validation, name storage and RNG boundaries remain unchanged. This transcript
is transient and is not part of the version-1 web save format.

The cursor preserves delayed wrapping at column 32, comma zones at columns
0/16, TAB wrapping, coloured padding and scrolling when more output reaches
the bottom of the upper display. Name INPUT prompts reserve three ROM rows;
empty or COPY retries can scroll once even though they print no new error.
Repeated errors retain earlier output, and page changes clear that history.
The browser renders the updated screen before invoking its print dialog.

Plain club names occupy twelve columns, including padding. In fixtures, two
such names wrap the final padding before the comma-separated rank display;
the home rank moves to column 16 and the away rank moves to the next row.
A twelve-column opponent in the strength header wraps before the following
newline, leaving a blank row and shifting the strength list and choices down.
Season bonus placement now follows its original commas; six three-row club
movements fit above the new-season heading and division line. The menu's
command column and coloured padding, and the bright yellow name-selection
prompt, are also corrected from the same captures.

## Reproducing the original evidence

```sh
bun tools/zx/capture-name-layouts.ts \
  roms/zx/analysis/24-fresh-menu.z80 \
  roms/zx/analysis/10-bills.z80
```

The optional tool pins SkoolKit 10.2 through `uv`. It verifies fresh BASIC hash
`5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6`
and resumed BASIC hash
`73e972eae89e3f192eff177192b8aff7cdc7d1d81f08e86947ff417c76090ac6`.
Name inputs enter the ROM editor as placeholders whose bytes are replaced
before Enter; validation and printing code are never patched. Fixture probes
set seed 219 before entering the first match. Season probes set controlled
rank/division variables and twelve-byte club array entries in the existing
bills checkpoint, then follow its normal season transition. They cover
champions/relegation, promotion/relegation and promotion-only summaries.

The committed `web/src/sim/fixtures/name-layouts.json` contains observations:
20 club/player episodes with 224 submissions and 172 recorded step snapshots,
three fixture/strength pairs and three season summaries. Identical consecutive
inputs/screens are recorded with a repeat count. The 26 regression tests
compare all 704 upper-screen text cells, colour/brightness attributes and
inverse flags at each recorded step. Fault reports also match row 23.
Attributes and inverse flags are zlib/base64 compressed; ROM font data and
original snapshots/programs are not committed. Existing single-attempt name
fixtures remain independently checked.

`bun run check` and `bun run build` verify the port. Browser checks follow the
same repeated-error sequence before and after the change, then rename both
fixture clubs and verify the wrapped fixture and strength screens. No page
errors occurred.

## Limits

This is a PRINT cursor for the covered layouts, not a complete Spectrum
terminal or BASIC interpreter. Embedded control/graphics sequences now have a separate
[bounded PRINT capture](name-print-fidelity.md). The Spectrum keyboard editor
and cursor, prompt sounds and exact execution pacing remain outside these
layout assertions. The separate [glyph raster verification](glyph-raster-fidelity.md) establishes printable/block masks and ordinary cell colours, inverse and brightness, without claiming complete name-screen pixel parity. The separate
[pitch verification](pitch-rendering.md) now establishes pitch and captured
pre-outcome sprite pixels.
The bottom ROM INPUT area is represented by the browser form, rather than
included in the 704-cell comparisons. Original competition rules and the
separate web save/load adaptations are unchanged.
