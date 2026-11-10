# Glyph rendering comparison (#28)

These PNGs show the web recreation, captured in Chromium at 1280 × 900,
1× device pixel ratio and the game's 3× display setting, with sound disabled.
They are presentation evidence from the app, not original-ROM screenshots.

- **Before:** `origin/main` at `e55f2a5`, using the browser-rendered TTF.
- **After:** this PR's bitmap renderer.
- `before-status.png` / `after-status.png`: the same restored status screen,
  including the manager's H glyph, currency, inverse text and colours.
- `before-goal.png` / `after-goal.png`: the same restored goal pause and score.
  Browser time is frozen; the TTF is fully loaded and the screen redrawn before
  capture, so the comparison excludes transient fallback-font output.

Both versions load identical version-3 web saves for each pair. Their accessible
transcripts are asserted equal, and neither capture reports a page error.
The synthetic manager name is H. Smith; no personal save data is included.

The app assets have the provenance recorded in
[view/assets/README.md](../../../web/src/view/assets/README.md).
Pixel equality with original PRINT output is established by the separate
[glyph fixture comparisons](../../glyph-raster-fidelity.md), not by these
before/after images.
