# Spectrum glyph raster fidelity

Text screens, lower-screen prompt/input characters and highlight overlays now
use authored/derived 8 × 8 cell masks and opaque RGBA buffers. Canvas ImageData
sets the native pixels directly; integer CSS scaling uses `image-rendering:
pixelated`. Neither browser font metrics nor font antialiasing determines those
pixels. The simulation remains unchanged and headless.

## Repertoire and provenance

The atlas covers all 96 Spectrum printable codes 32–127, including the up arrow
at 94, £ at 96 and © at 127, plus all sixteen quadrant-block codes 128–143.
Unicode equivalents identify the masks in `view/assets/spectrum-glyphs.json`.
Spectrum ASCII aliases and the name decoder's private-use block codes select
the same masks. Unsupported characters display a deterministic `?`; accessible
text retains the supplied character.

The printable masks derive from the existing independently sourced public-domain
ZX Spectrum Unicode Font. `tools/zx/derive-glyphs.py` samples its straight-line
contours at the centres of the 8 × 8 grid, without a font rasterizer. Its four
authored corrections fix differences found in the redraw: the dollar's final
stem pixel, the @ counter pixel, the H crossbar row and the up-arrow shape.
Quadrant blocks are authored from four rectangular regions. See the
[asset provenance](../web/src/view/assets/README.md) for the upstream revision,
source hash and retained dedication. No atlas bytes are read from a ROM.

```sh
uv run --with fonttools==4.60.1 tools/zx/derive-glyphs.py
bunx prettier --write web/src/view/assets/spectrum-glyphs.json
```

The existing fifteen player/ball UDG masks remain in `pitch.ts`; their original
BASIC DATA provenance and pre-outcome pixel comparisons are recorded in
[pitch-rendering.md](pitch-rendering.md).

## Original observations

```sh
bun run zx:link
bun tools/zx/capture-glyphs.ts roms/zx/analysis/local-original.z80
bunx prettier --ignore-path /dev/null --write build/zx/glyphs.json
diff -u web/src/sim/fixtures/glyphs.json build/zx/glyphs.json
```

The capture uses SkoolKit 10.2 and a locally loaded original-game snapshot
prepared by `bun run zx:snapshot`. It verifies the 48K ROM SHA-256
`d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`
and the unmodified ROM CHARS pointer. A scratch Z80 harness opens screen channel
2 and calls the actual ROM RST 10 PRINT path for each character/control byte.
This isolates glyph output from game layout and interpreter timing. Interrupts
are disabled for the probe; no ROM instructions or glyph data are patched.

Screen memory and attributes are independently decoded into canonical RGBA
using intensity 215/255 for normal/bright colours. The committed fixture contains
112 individual glyph hashes and 256 repertoire/string-buffer hashes, covering
every INK/PAPER pair with both INVERSE and BRIGHT states, including black and
equal foreground/background colours. Strings include currency/copyright,
`NO GOAL!`, a score and all four goal-banner rows from BASIC line 292.
Additional PRINT observations cover goal/miss overlays and score text with
explicit and inherited club inks. Only hashes, representative input values and
capture metadata are committed. ROM, program, snapshot and extracted originals
remain under gitignored `roms/`; generated local observations live in `build/`.

`glyphs.test.ts` compares every fixture hash with rasterized cells.
`pitch.test.ts` also compares the production overlays with captured cell hashes,
including partial banner, miss and score printing and untouched cells. Highlight
text retains BRIGHT 1 from the pitch; score numbers and TAB spaces inherit each
club name's ink. The tests preserve the existing pre-outcome pitch corpus.

```sh
bun test web/src/view/glyphs.test.ts web/src/view/pitch.test.ts
bun run check
bun run build
```

Live Chromium checks exercise setup, typing, the management menu and animated
highlights, verify opaque 256 × 176 native buffers, and confirm changing the
browser font leaves the screen pixels unchanged. Accessible screen content still
comes from the live text transcript; prompt labels and the real input remain
available to assistive technology. Canvas presentation is aria-hidden.

## Coverage limits

These comparisons establish glyph shapes and ordinary cell INK/PAPER,
INVERSE and BRIGHT rendering. They do not establish whole-screen or frame-by-frame
parity. Full layouts/animation integration remain in #33. The existing browser
editor still handles caret, selection, composition, scrolling and editing;
Spectrum mode cursors and lower-screen behaviour remain in #29. The TTF remains
only for native editor/caret metrics, with visible prompt/input text painted by
the bitmap renderer.

Arbitrary control/token streams, runtime UDG printing in names, transparent or
contrast INK/PAPER controls, OVER and FLASH attribute semantics are not established
by this probe; reachable control/graphics PRINT behaviour remains in #30. Pitch
sprite XOR drawing and the existing cup flash presentation have their own bounded
tests. No claim is made for arbitrary Unicode, other ROM revisions, beam timing,
font-independent native caret placement or all browser accessibility combinations.
