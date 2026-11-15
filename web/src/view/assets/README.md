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

# Sprite highlights artwork

`clip-sprites.ts` holds the sprites of Modern mode's sprite highlights
([#146](https://github.com/odogono/fman/issues/146),
[sprite-highlights.md](../../../../docs/sprite-highlights.md#artwork)): the
players' poses, the ball's spin and the status icons, as pixel grids of
characters. The players, the dive and the tired icon began as reference images
made for this project with ChatGPT's image tool (November 2026), prompted for
an original design that copies no existing game. A script fitted each image's
pixel grid and snapped every cell to the sprites' palette; the grids were then
cleaned up by hand, the ball removed from the kicks and the dive, and the ball's
spin drawn by hand. The run's four-frame cycles and the header's three frames were added the same way in November 2026, from strips made with the same tool against the existing sprites as a style reference, converted by a script that fits the art-pixel grid and snaps each cell to the palette, then cleaned up by hand. The celebrating run, the jump for joy, the knee slide and a redrawn header from behind followed the same way in November 2026, the run's faces redrawn by hand. The images themselves are not kept. The grids are dedicated
to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

The goals and the advertising boards in `clip-sprites.ts`
([#157](https://github.com/odogono/fman/issues/157)) were drawn to scale as
pixel grids by a script written for this project. Reference images made with
ChatGPT's image tool set their look but were not converted. The boards' panels
are plain colours and shapes, chosen to look like no flag or brand. The crowd
reuses the players' poses. These grids are also dedicated to the public domain
under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
