"""Execute the original ROM PRINT path; export observations, never ROM glyph bytes.

uv run --with skoolkit==10.2 tools/zx/capture-glyphs.py <snapshot> [output.json]
"""

import hashlib
import json
import sys
from pathlib import Path

from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.trace import Tracer

snapshot = Path(sys.argv[1])
sim = from_snapshot(CSimulator, Snapshot.get(str(snapshot)))
m = sim.memory
rom_hash = hashlib.sha256(bytes(m[:16384])).hexdigest()
assert rom_hash == "d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42"
assert m[23606] + 256 * m[23607] == 15360  # unmodified ROM CHARS
sim.set_tracer(Tracer(sim, 7, 0, 0, [0] * 16, 0, False))


def run(data):
    # CHAN-OPEN #2 (upper screen), then RST 10 for each printed byte.
    code = [62, 2, 205, 1, 22]
    for byte in data:
        code.extend([62, byte, 215])
    start = 49152
    m[start:start + len(code)] = code
    sim.registers[12] = 65000  # SP, away from the harness and game
    sim.registers[26] = 0  # interrupts disabled; this is a pixel probe
    result, operations = sim.trace(start, start + len(code), 2000000, 0, False,
                                   None, None, None, None, None)
    assert result == 3, (result, operations)


def rgba(x, y, width, height):
    output = bytearray()
    for row in range(y, y + height):
        address = 16384 + (row // 64) * 2048 + (row % 8) * 256 + ((row % 64) // 8) * 32
        for column in range(x, x + width):
            attr = m[22528 + (row // 8) * 32 + column // 8]
            on = m[address + column // 8] & (128 >> (column % 8))
            colour = (attr & 7) if on else ((attr >> 3) & 7)
            intensity = 255 if attr & 64 else 215
            output.extend((intensity if colour & 2 else 0,
                           intensity if colour & 4 else 0,
                           intensity if colour & 1 else 0, 255))
    return hashlib.sha256(output).hexdigest()


repertoire = list(range(32, 144))
strings = [list(b"You've ") + [96] + list(b"123  ") + [127] + list(b" 1982"),
           list(b"NO GOAL!"), list(b"LIVERPOOL   1   IPSWICH     0")]
# BASIC line 290's four goal-banner rows, expressed as Spectrum block codes.
banner = "****█    ██  ███  ██ ████ █*********█ ██▄█ ██ █ ██ █ ████ █*********█ █▄ █ ██ █ ▄▄ █ ████▄█*********█    ██  ██ ██ █    █ █*****"
blocks = " ▝▘▀▗▐▚▜▖▞▌▛▄▟▙█"
strings.extend([[128 + blocks.index(c) if c in "█▄" else ord(c)
                 for c in banner[row:row + 32]] for row in range(0, 128, 32)])
cases = []
for bright in [False, True]:
    for inverse in [False, True]:
        for ink in range(8):
            for paper in range(8):
                m[16384:23296] = [0] * 6912
                # FLAGS: screen output; TV_FLAG: upper screen. Permanent and
                # temporary attributes/masks are reset before exercising PRINT.
                m[23611] = 0
                m[23612] &= ~2
                m[23693:23698] = [paper * 8 + ink + 64 * bright, 0,
                                    paper * 8 + ink + 64 * bright, 0, 0]
                data = [18, 0, 19, int(bright), 20, int(inverse), 21, 0]
                for i, code in enumerate(repertoire):
                    data.extend([22, i // 32, i % 32, code])
                for row, string in enumerate(strings, 4):
                    data.extend([22, row, 0] + string)
                run(data)
                case = {"bright": bright, "inverse": inverse, "ink": ink,
                        "paper": paper, "rgba": rgba(0, 0, 256, 88)}
                if not bright and not inverse and ink == 0 and paper == 7:
                    glyphs = [{"code": code, "rgba": rgba((i % 32) * 8, (i // 32) * 8, 8, 8)}
                              for i, code in enumerate(repertoire)]
                cases.append(case)

overlays = []
for kind, home_ink, away_ink in [("miss", 0, None), ("goal", 2, None), ("goal", None, 1)]:
    m[16384:22528] = [0] * 6144
    m[22528:23296] = [64 + 4 * 8 + 6] * 768
    m[23611] = 0
    m[23612] &= ~2
    m[23693:23698] = [64 + 4 * 8 + 6, 0, 64 + 4 * 8 + 6, 0, 0]
    data = [18, 0, 19, 1, 20, 0, 21, 0]
    if kind == "miss":
        data += [16, 0, 17, 7, 22, 1, 10] + list(b"NO GOAL!")
        positions = [(10 + i, 1) for i in range(8)]
    else:
        data += [16, 6, 17, 2, 22, 0, 0] + [code for row in strings[3:] for code in row]
        data += [16, 0, 17, 7, 22, 4, 0]
        if home_ink is not None:
            data += [16, home_ink]
        data += list(b"LIVERPOOL".ljust(10 if home_ink is not None else 12))
        data += [23, 12, 0] + list(b"1") + [23, 16, 0]
        if away_ink is not None:
            data += [16, away_ink]
        data += list(b"IPSWICH".ljust(10 if away_ink is not None else 12))
        data += [23, 28, 0] + list(b"0")
        positions = [(i % 32, i // 32) for i in range(128)] + [(i, 4) for i in range(29)]
    run(data)
    overlays.append({"kind": kind, "homeInk": home_ink, "awayInk": away_ink,
                     "cells": [{"x": x, "y": y, "rgba": rgba(x * 8, y * 8, 8, 8)}
                               for x, y in positions]})

output = Path(sys.argv[2] if len(sys.argv) > 2 else "build/zx/glyphs.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"romSha256": rom_hash, "skoolkit": "10.2",
                             "snapshotSha256": hashlib.sha256(snapshot.read_bytes()).hexdigest(),
                             "glyphs": glyphs, "strings": strings, "cases": cases,
                             "overlays": overlays}, indent=2) + "\n")
print(f"Wrote {output}")
