# Frame cadence and reseeding

[#25](https://github.com/odogono/fman/issues/25) uses the validated
[48K timing reference](spectrum-timing.md): 3,500,000 nominal T-states/second,
69,888 T-states/frame, or **19.968 ms/frame**. The browser previously used
20 ms. `frame-clock.ts` declares these constants alongside the explicit
24-bit ROM FRAMES counter. The frame counter accepts whole serviced-interrupt counts; the session accepts
whole ULA frames and withholds ticks during modeled BEEPER spans. Neither
reads a browser timestamp or wall clock. Counter advancement wraps
modulo 2²⁴. `RANDOMIZE 0` reads the low 16 bits, including zero at 65,536;
restoring a raw seed through `createRng(seed)` does not reseed.

## Timed original observations

The separate `tools/zx/inputs/frame-reseeding.json` script uses #24's pinned
tape, snapshot and contention-aware adapter. It retains the original snapshot
phase and keyboard-matrix input semantics. No RAM/register patches, tape
acceleration or timing averages are used. The compact fixture records statement
checkpoints, requested/effective input times and the actual ROM RANDOMIZE
entry (7759) and exit after its SEED store (7774). Video and tape/speaker
waveforms are deliberately omitted. The original #24 script and corpus are
unchanged.

Two keyboard-only runs establish:

- Setup reaches line 100 with raw seed 12,124 and ROM FRAMES 1,360. RANDOMIZE
  changes the seed to 1,360. A status-screen return goes through line 2000,
  preserving that seed even though FRAMES has advanced to 1,512.
- A full, unaccelerated `SAVE "football" LINE 100` preserves the seed.
  Answering `yes` reaches line 100 again at FRAMES 1,816 and reseeds to 1,816.
- A first league match, results, table, bills and declined transfer reach
  line 100 with raw seed 35,722 and FRAMES 8,554, then reseed to 8,554.

The sim tests feed the **observed ROM interrupt counts** at those boundaries
and compare pre/post RNG state. These are boundary conformance tests, not a
claim that the browser already executes every intervening BASIC statement at
the reference's T-state. Existing ROM vectors independently cover 24-bit
wrapping and low-16-bit RANDOMIZE behavior.

Reproduce with the original files linked and #24's starting snapshot prepared:

```sh
bun run zx:link
bun tools/zx/capture-timing.ts --frame-reseeding build/zx/frame-reseeding.json
bunx prettier --ignore-path /dev/null build/zx/frame-reseeding.json > build/zx/formatted-frame-reseeding.json
cmp build/zx/formatted-frame-reseeding.json web/src/sim/fixtures/frame-reseeding.json
bun test tools/zx/frame-reseeding.test.ts web/src/sim/frame-reseeding.test.ts
```

## Browser scheduling policy

`frame-sampler.ts` counts completed nominal frames from a monotonic timestamp
origin. Fractional elapsed time survives callbacks; counting from the origin
avoids repeated fractional-addition drift. Inputs sample `performance.now()`
at **dispatch**, before submitting a command or recording a key transition. Opening the
game menu and persisting on page hide also sample first. Older RAF timestamps
cannot move this clock backwards. Input delivery uses dispatch time, not the
hardware key timestamp; delayed browser event delivery remains a host limit.

Delayed callbacks, blocked JavaScript and hidden tabs catch up their **entire**
elapsed interval at the next callback or input. There is no delta cap or
background-tab freeze. Screens/audio crossed in one catch-up are not all
presented individually. Escape/the game menu deliberately freezes play;
Resume excludes that interval while preserving the in-memory fractional phase.
These are browser policies, not original game rules, and do not alter the
reference inputs or permitted reference tolerances.

The sampler counts nominal ULA cadence; the original ROM counter counts
**serviced interrupts**. BEEPER and SAVE disable interrupts, so elapsed ULA
frames and ROM FRAMES can differ. The SAVE capture makes that distinction
observable. The browser file download replaces tape SAVE; its elapsed time
is not the original cassette duration. [Measured highlight and timed-screen pacing](highlight-pacing.md) now models
BEEPER interrupt losses and keyboard scans using dispatch-edge execution
budgets. This covers the captured highlight/title/error/cup paths within stated
tolerances. Other execution paths, sound delivery (#27) and the full timed
comparison (#34) remain outside that evidence; changing cadence alone does not
establish complete session parity.

## Save compatibility

The [pacing change](highlight-pacing.md#saves-and-reproduction) bumps the journal
from version 2 to version 3 because replay timing and keyboard state changed.
[Measured beeper playback](beeper-playback.md) advances this to version 4.

- Version 1 stores Game and whole ROM FRAMES. Import restores that counter
  and executes the line-100 reseed boundary, as the accepted web-load
  adaptation. Actual tape LOAD uses the target machine's current counter.
- Version 4 restores the raw seed, ROM/ULA counters and PAUSE keyboard state,
  then replays explicit whole-frame advances and key transitions without reseeding.
- Versions 2 and 3 import only idle menu checkpoints with no subsequent
  inputs (version 2 requires the original three-field base). Active journals are rejected because their old durations cannot replay
  exactly under the new scheduler.

Fractional browser phase and time outside a closed page remain outside the
save format. A restored session starts a fresh browser phase at its stored
whole-frame boundary. Tests cover fractional time, uneven callbacks, stale RAF,
background gaps, menu freezing, counter wraps, RANDOMIZE, chunked advances and
save compatibility.
Browser checks also exercised setup, status return, input catch-up after a
240 ms blocked callback (12 frames), and game-menu freeze/resume.
