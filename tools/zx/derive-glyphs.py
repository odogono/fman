"""Derive cell masks from the independently sourced public-domain font, never a ROM.

uv run --with fonttools==4.60.1 tools/zx/derive-glyphs.py
"""

import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont

source = Path("web/src/view/assets/zx-spectrum.ttf")
assert hashlib.sha256(source.read_bytes()).hexdigest() == "9cdd5e1027a84f71b025b3bb5cc1f71176ef3e39414af85854f9df7750812f02"
font = TTFont(source)
assert font["head"].unitsPerEm == 800


def mask(character):
    glyph = font["glyf"][font.getBestCmap()[ord(character)]]
    if glyph.numberOfContours == 0:
        return [0] * 8
    points, ends, flags = glyph.getCoordinates(font["glyf"])
    assert all(flag & 1 for flag in flags), "Expected straight, on-curve contours"
    contours = []
    start = 0
    for end in ends:
        contours.append(list(points[start:end + 1]))
        start = end + 1

    def inside(x, y):
        winding = 0
        for contour in contours:
            for a, b in zip(contour, contour[1:] + contour[:1]):
                cross = (b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])
                if a[1] <= y < b[1] and cross > 0:
                    winding += 1
                elif b[1] <= y < a[1] and cross < 0:
                    winding -= 1
        return winding != 0

    # Eight 100-unit cells, baseline at the bottom of row seven.
    return [sum(128 >> x for x in range(8) if inside(x * 100 + 50, 650 - y * 100))
            for y in range(8)]


characters = [chr(code) for code in range(32, 128)]
characters[94 - 32] = "↑"
characters[96 - 32] = "£"
characters[127 - 32] = "©"
glyphs = {character: mask(character) for character in characters}
# Authored corrections to the public-domain redraw, checked against PRINT
# observations: dollar stem, @ counter, H crossbar and Spectrum's up arrow.
glyphs["$"][7] >>= 1
glyphs["@"][4] |= 16
glyphs["H"][3], glyphs["H"][4] = glyphs["H"][4], glyphs["H"][3]
glyphs["↑"] = [0] * 8
for x, y in [(4, 1), (3, 2), (4, 2), (5, 2), (2, 3), (4, 3), (6, 3),
             (4, 4), (4, 5), (4, 6)]:
    # x is counted from the right here, as in the arrow's centered stem.
    glyphs["↑"][y] |= 1 << x
# Spectrum block codes 128..143: top-right, top-left, bottom-right, bottom-left.
# Unicode equivalents, indexed by the four quadrant bits.
blocks = " ▝▘▀▗▐▚▜▖▞▌▛▄▟▙█"
for code, character in enumerate(blocks):
    glyphs[character] = [
        (15 if code & (1 if row < 4 else 4) else 0)
        | (240 if code & (2 if row < 4 else 8) else 0)
        for row in range(8)
    ]
output = Path("web/src/view/assets/spectrum-glyphs.json")
output.write_text(json.dumps({"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                             "glyphs": glyphs}, ensure_ascii=False, indent=2) + "\n")
print(f"Wrote {output}")
