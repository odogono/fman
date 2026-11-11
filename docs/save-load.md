# Saving and loading

## Contract

The original BASIC command `keep` / `KEEP` reaches `SAVE "football" LINE 100`
at line 800. Line 805 asks `Do you want to play some more?`; only `y`, `Y`,
`yes`, `YES` continue to 100, otherwise `NEW` clears the program. Line 100
reseeds from the Spectrum frame counter. A loaded tape also resumes at 100, using the target Spectrum’s current frame
counter; a BASIC tape file does not store that system variable.
These statements are verified by static reading of the recovered BASIC;
the [frame/reseed capture](frame-clock-and-reseeding.md) additionally executes
the complete ROM SAVE and post-save `yes` path under timed keyboard input,
observing preservation of SEED during SAVE and reseeding at line 100.
Tape signal interoperability and the ROM LOAD path are not yet probed.

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
This was the first save contract. ADR 0004 replaces it: the full session is autosaved to browser storage, and a game menu offers saved games in five save slots plus export/import of session journals, written at the current `saveVersion` (`web/src/sim/save.ts`). Version-1 files stay importable and resume at the reseed boundary.

## Exact resume and the game menu (ADR 0004)

The web build keeps an autosave of the exact session: the checkpoint at the
last management menu (Game, ROM/ULA counters and PAUSE keyboard state), plus
the inputs since then, including key down/up transitions.
Consecutive frame advances are merged, which is exact because the clock,
timed pauses and highlight playback consume elapsed frames additively.
Restoring replays those inputs, so a reload lands on the same screen and
highlight frame, with the same RNG. The autosave is written after every
input and screen change, at most once a second during animation, and when
the page is hidden. Exports and save slots use this format, at the current `saveVersion`.
`keep` writes the same game and frame counter fields as the version-1 contract,
at the current `saveVersion`.

Version history:

The [measured pacing change](highlight-pacing.md#saves-and-reproduction) bumps
the journal version because old frame counts would replay different animation
states. [Measured beeper playback](beeper-playback.md) advances the journal to
version 4, including prompts in progress. Version 4 restores the raw seed and timing/keyboard state. Version 5
also logs how long each keypress stays down, so a keypress that comes up by
itself replays exactly; a key held when the session was saved comes up once
the original has scanned it ([ADR 0006](adr/0006-taps-reproduce-keypresses.md)).
Version-4 journals still replay unchanged. Version 1
still imports through the reseed boundary. Version 2 imports only an idle
original three-field menu checkpoint with no subsequent inputs; active version-2
journals are rejected. Version-3 journals likewise import only idle menu checkpoints.
Version 6 adds the game's [ruleset](enhanced-rules.md) to every stored game, in
journals and `keep` files alike. Games stored before version 6 have none and
play the original ruleset. Version 7 adds the ruleset to a journal that starts
at the title screen, before any game exists, so replay sets up a new game under
the rules the player chose; earlier title-screen journals play the original.
`keep` files from version 7 hold the same as version 6. Version 8 adds a running
[grace period](grace-period.md)'s weeks left to the stored game; earlier games
have none running. Version 9 adds [present-day clubs](present-day-clubs.md)'
kits and name papers, and leaves out the chosen colour of games whose clubs
wear their own kits.
Fractional browser phase is not stored; restoring starts a fresh phase and
does not simulate time spent with the page closed.

Escape or the Menu button opens the game menu, which freezes play. It offers
Resume, Print screen, Save and Load (five slots), New game (choosing [Enhanced or Original rules](enhanced-rules.md)
first), Export and Import of a save file, and Options (sound, display
size, touch controls). Print screen closes the menu and submits the original's
`h`, pressing Enter for it as a keyboard does; it is enabled only at prompts
where the original copies the screen and that offer answers. The menu button
is an icon at the top left, beside the name of the screen on show (the
highlights name the clubs playing, home club first). Every menu control is a
tap target of at least 44px. Options are
stored per browser and kept apart from saved games. If an autosave can't be
restored, the game starts at the title screen with a notice. If storage
fails, Save is disabled and the menu suggests Export.

## Implementation and verification

Use Bun and TypeScript, with no new dependencies. Serialization and validation
belong in `web/src/sim/save.ts`; the session owns save/continue/load transitions.
The web app (`web/src/view/app.ts`) runs the game menu, save slots, autosave,
export/import and the `keep` download behind adapters for the page, storage and
downloads, so `web/src/view/app.test.ts` covers those flows with in-memory
adapters; `web/src/view/browser.ts` holds the browser ones. Save versions must increase when
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

Web file storage is an accepted host adaptation. Under
[ADR-0008](adr/0008-relax-presentation-parity.md), original tape interoperability
and an exact post-save continuation screen are not planned; the cleared display is
an accepted difference.
