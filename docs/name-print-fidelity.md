# Embedded name PRINT controls and graphics

Names remain fixed-width Spectrum byte strings. The screen channel now decodes
those bytes instead of treating each control or token as a visible character.
The same cursor handles name confirmations, status, squad/selection, sales,
transfer offers and confirmations, fixtures, strengths, highlight scores, final
and other results, tables and season movements. PRINT statement boundaries
reset temporary attributes; apostrophes within one statement preserve them.

## Reachable repertoire and storage

The original editor and validation are separate boundaries. Validation accepts
any subsequent byte after the accepted initial character (65–122), subject to
the existing eight-byte player and ten-byte plain/twelve-byte coloured club
limits. A club's leading INK parameter must still be 0–4. Validation priority,
space padding, raw private-use encoding and the web save format are unchanged.

| Bytes      | Original keyboard entry / output                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32–127     | Printable characters; 94 is ↑, 96 is £, 127 is ©.                                                                                                                                |
| 128–143    | GRAPHICS mode number keys produce quadrant blocks; CAPS selects the complementary blocks.                                                                                        |
| 144–164    | GRAPHICS mode A–U produce UDGs. Initially these look like A–U. BASIC 260–269 replaces A–O with the fifteen game sprites before the first highlights; P–U remain alphabet glyphs. |
| 165–255    | BASIC tokens print their ROM spellings and spacing. Extended and shifted extended keys reach tokens even during LINE INPUT. They remain single stored bytes.                     |
| 16, colour | Extended mode CAPS+0–7 inserts INK.                                                                                                                                              |
| 17, colour | Extended mode 0–7 inserts PAPER.                                                                                                                                                 |
| 18, 0/1    | Extended mode CAPS+8/9 inserts FLASH.                                                                                                                                            |
| 19, 0/1    | Extended mode 8/9 inserts BRIGHT.                                                                                                                                                |
| 20, 0/1    | CAPS+3/4 inserts INVERSE during name input.                                                                                                                                      |

Extended mode is entered with CAPS+SYMBOL SHIFT; GRAPHICS mode toggles with
CAPS+9. The capture records the actual key sequences and resulting bytes,
including token keys, rather than inferring them from injected data. Desktop
browser mappings and the lower editor remain [#29](https://github.com/odogono/fman/issues/29).

The raw-buffer/save contract also accepts byte sequences which those keyboard
chords do not insert directly. The bounded screen channel supports INK/PAPER
8 (preserve the destination attribute), INK/PAPER 9 (contrast), FLASH/BRIGHT 8
(preserve), OVER 0/1, comma (6), cursor-left (8), cursor-right (9), newline (13),
AT (22,row,column), and TAB (23,low,high). TAB uses the target modulo 32 and
paints the remainder of the line when it wraps. Cursor-right updates the
current cell's attributes through an XOR space without moving the stored
cursor or changing the pixels. Other low bytes print `?`, including byte 14
in the PRINT channel. OVER preserves the old bitmap, including inverse and
UDG pixels. FLASH swaps ink/paper every sixteen ULA frames.

A control can consume padding or the next PRINT byte. No missing argument is
inserted or repaired. For example, a full-width name ending in INK consumes
the terminating newline as its colour and stops with `K Invalid colour`.
A trailing AT/TAB can consume later comma/TAB or literal bytes instead. Tests
cover those later uses in the squad, status and fixture screens.

## Reports and retained state

Prefix validation still reports `3 Subscript wrong, 9472:1` or `9473:1` before
assignment. PRINT errors happen after assignment: `K Invalid colour`,
`B Integer out of range` or `5 Out of screen`, with the original BASIC line
and statement (`9478:2` / `9575:2` for edit confirmations). Accepted name bytes,
finances, attributes and seed remain in memory. Input stops, and the report
appears on row 23. Truncated names used later likewise stop the session instead
of being stripped or escaping into the page. General BASIC command recovery
remains deferred.

At an other-match fault, the gate, own match and earlier other results remain
recorded. The failing pairing has consumed its RNG draws and marked both teams
as used, but its goals/points are not recorded; sorting and weekly bills have
not run. Season-movement faults retain the bonus, season/rating totals and
earlier club swaps, while leaving the failing swap and new-season reset undone.
Native state assertions cover these boundaries as well as the full stopped
screens.

## Reproducing observations

```sh
bun run zx:link
bun run zx:observe
bun tools/zx/observe.ts \
  'roms/zx/Football Manager - Players (1982)(Addictive Games).z80' \
  roms/zx/analysis saved
bun tools/zx/capture-name-print.ts \
  roms/zx/analysis/24-fresh-menu.z80 \
  roms/zx/analysis/10-bills.z80
bunx prettier --ignore-path /dev/null --write build/zx/name-print.json
diff -u web/src/sim/fixtures/name-print.json build/zx/name-print.json
```

The optional adapter pins SkoolKit 10.2, the 48K ROM SHA-256
`d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`,
and the fresh/resumed BASIC hashes used by the earlier name captures. The
fixture commits observations, never snapshots, program files or ROM assets.

`name-print.json` records 336 injected name attempts (including every embedded
byte value), 131 real keyboard sequences, ten combinations across nine game
screens, ten season summaries, 44 ROM PRINT probes over differently coloured
existing cells, six later-use continuations, three partial other-match stops,
five season-movement continuations, and two repeated name-list faults. Game-screen probes patch only
fixed-width catalogue entries after separately establishing accepted storage;
they do not patch validation, PRINT or competition code. The match seed is 219.
Season entry uses the same controlled division-two state as the earlier season
capture. The ROM probes exercise transparency, contrast, FLASH/BRIGHT masks,
inverse, XOR and cursor-right over existing glyphs and attributes.

Every observation includes the full 6144-byte native bitmap and all 768
attributes, zlib/base64 compressed, plus BASIC position and cursor metadata.
The 627 regression cases compare every upper-screen pixel byte and attribute,
with row-23 report comparisons on stopped runs. Lower INPUT pixels are captured
but belong to the separate editor contract. The raw numeric-marker attempt
checks storage only: its lower-editor numeric-payload redraw is outside this
PRINT implementation. Existing glyph, pitch, layout and simulation fixtures
remain independently checked.

## Bounded implementation

This is the game's screen-channel protocol, not a BASIC interpreter. Arbitrary
Unicode, printer channels, command recovery, user-modified UDG memory and the
ROM numeric-payload editor are unsupported. Deliberately token-expanded screens
which require the ROM's interactive `scroll?` pagination currently scroll to
the completed upper screen; that interaction is not reproduced here. The
native retained-state assertions cover edit confirmations, later squad/status/
fixture faults, partial other results and season movements. Complete-session and lower-screen verification
remain the gates in [#33](https://github.com/odogono/fman/issues/33) and
[#34](https://github.com/odogono/fman/issues/34).
