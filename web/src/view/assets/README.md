# Spectrum typeface

`zx-spectrum.ttf` is the redrawn ZX Spectrum Unicode Font from
[jfsebastian/zx-spectrum-unicode-font](https://github.com/jfsebastian/zx-spectrum-unicode-font),
revision `67e9c4d40d8a77ffcecf3c7eef6fde8ba977ce7f`, `build/ZXSpectrum.ttf`.
The upstream public-domain dedication is preserved in `zx-spectrum-LICENSE.txt`.
This asset was obtained from the font project, not extracted from the game tape or ROM.

`spectrum-glyphs.json` is the presentation atlas derived from that font by
`tools/zx/derive-glyphs.py` (fontTools 4.60.1). The checked source TTF SHA-256 is
`9cdd5e1027a84f71b025b3bb5cc1f71176ef3e39414af85854f9df7750812f02`.
The tool samples contour centres on the eight-pixel grid, applies four explicitly
authored corrections (`$`, `@`, `H`, `↑`), and authors the sixteen quadrant blocks
geometrically. It reads no ROM/program/snapshot files. The upstream dedication
also applies to this font-derived atlas; the corrections and block masks are
dedicated to the public domain under the same terms.

Original-ROM PRINT observations validate pixel hashes independently; they are
not the asset source. See [glyph-raster-fidelity.md](../../../../docs/glyph-raster-fidelity.md)
for capture commands, comparisons and coverage limits. The TTF is retained for
native input/caret metrics; visible game glyphs use the bitmap atlas.
