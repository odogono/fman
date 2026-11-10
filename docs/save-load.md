# Saving and loading

## Contract

The original BASIC command `keep` / `KEEP` reaches `SAVE "football" LINE 100`
at line 800. Line 805 asks `Do you want to play some more?`; only `y`, `Y`,
`yes`, `YES` continue to 100, otherwise `NEW` clears the program. Line 100
reseeds from the Spectrum frame counter. A loaded tape also resumes at 100, using the target Spectrum’s current frame
counter; a BASIC tape file does not store that system variable.
These statements are verified by static reading of the recovered BASIC;
tape signal timing and the complete ROM SAVE/LOAD path are not yet probed.

This increment adapts the storage medium to a downloaded `football.fman.json`
file. The format identifies this web recreation and carries version 1, the
complete headless Game and its 24-bit frame counter. It contains no original
program or ROM. It is not a TAP/TZX/Z80 file and does not claim compatibility
with emulator snapshots or original tape saves.

`keep` requests a download without changing data or RNG; after the browser
accepts that request, the original continuation question appears. A download
error keeps the menu playable. Continuing reseeds with the current frame
counter. For deterministic web restoration, loading restores the saved frame counter
and executes the reseed boundary before management. Restoring this counter is
a web storage adaptation, rather than a claim about ROM tape loading. Time spent outside the game is not simulated.
The browser cannot confirm that the user retained the downloaded file.

A file input outside the reproduced screen explicitly loads a web save and
replaces the current game only after validation. Cancellation or invalid,
oversized, malformed or unsupported-version input leaves the game unchanged.
No automatic saving or loading and no local-storage dependency are added.

## Implementation and verification

Use Bun and TypeScript, with no new dependencies. Serialization and validation
belong in `web/src/sim/save.ts`; the session owns save/continue/load transitions,
and the view owns file reading and downloads. Save versions must increase when
their stored contract changes. Tests cover full round trips, edited names,
league/cup/season state, attack carry, invalid files, atomic replacement,
continuation/clear behaviour and equivalent subsequent play. Run `bun run check`
and `bun run build`; exercise download and file loading in the browser.

Remaining limits: browser downloads replace cassette recording, and the host
file picker replaces ROM loading commands. Tape noise, border flashing,
recording delays and general BASIC error recovery are not reproduced.

Browser verification downloaded a 5,473-byte save after borrowing £40,000,
cleared through the post-save question, and restored £140,000 cash / £40,000
debt from that file. Loading also worked after a fresh page navigation.
A malformed file left the status screen and finances unchanged, with no
browser page errors. The post-SAVE ROM screen contents are not yet dynamically
verified; the web continuation screen currently displays the original question
on a cleared display.
