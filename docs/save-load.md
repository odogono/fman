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

The game menu's Import action loads a web save and
replaces the current game only after validation. Cancellation or invalid,
oversized, malformed or unsupported-version input leaves the game unchanged.
This was the first save contract. ADR 0004 replaces it: the full session is autosaved to browser storage, and a game menu offers saved games in five save slots plus export/import of format-2 files. Version-1 files stay importable and resume at the reseed boundary.

## Exact resume and the game menu (ADR 0004)

The web build keeps an autosave of the exact session: the checkpoint at the
last management menu (Game and frame counter), plus the inputs since then.
Consecutive frame advances are merged, which is exact because the clock,
timed pauses and highlight playback consume elapsed frames additively.
Restoring replays those inputs, so a reload lands on the same screen and
highlight frame, with the same RNG. The autosave is written after every
input and screen change, at most once a second during animation, and when
the page is hidden. Exports and save slots use this format (version 2).
`keep` still writes the original version-1 contract.

Escape or the Menu button opens the game menu, which freezes play. It offers
Resume, Save and Load (five slots), New game (after a confirmation), Export
and Import of a save file, and Options (sound, display size). Options are
stored per browser and kept apart from saved games. If an autosave can't be
restored, the game starts at the title screen with a notice. If storage
fails, Save is disabled and the menu suggests Export.

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

The [phase-one boundary](adr/0004-define-phase-one-fidelity-boundary.md) explicitly
accepts web file storage as a host adaptation. [Original tape interoperability](https://github.com/odogono/fman/issues/35)
is deferred; [post-save continuation presentation](https://github.com/odogono/fman/issues/32)
remains required fidelity work.
