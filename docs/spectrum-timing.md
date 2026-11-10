# Contention-aware execution reference

[#24](https://github.com/odogono/fman/issues/24) supplies a reference clock,
portable input scripts and original-execution observations for the later
frame-clock, pacing and sound work. It does not change web gameplay or make
the deterministic [frame counter](spectrum-compatibility.md#random-and-frame-state)
a BASIC scheduler.

The selected reference is **SkoolKit 10.2 `CCMIOSimulator`, PAL 48K**, with
memory **and I/O** contention enabled, a 3,500,000 Hz nominal clock,
69,888 T-states/frame and a 32-T-state interrupt request at phase zero.
No instruction-loop, tape or game acceleration runs during captures.
The [primary-source research and independent vectors](spectrum-timing-sources.md)
describe the clock's evidence, bus-cycle schedule, interrupt behavior and limits.
These checks validate the declared emulator configuration; they are not a
physical-machine certification or an exhaustive Z80 conformance test.

## Originals and starting state

[The input script](../tools/zx/inputs/timing.json) pins the tape and complete
starting snapshot by SHA-256. The capture rejects a different tape, snapshot,
ROM, BASIC program or machine type. The ROM hash is
`d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`;
the initial BASIC hash is
`5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6`.
Every run also records initial RAM SHA-256 and the simulator's full register
array, including PC, SP, IFF, interrupt mode and T-state phase. Register indices
are the pinned [SkoolKit contract](spectrum-timing-sources.md): PC=24, T=25,
IFF=26, IM=27, HALT=28, MEMPTR=29.

The starting snapshot is made from the tape using contention and real tape
sampling, with fast loading and all accelerators disabled. It stops at the
first statement dispatch after tape end, at BASIC line 8, before title drawing.
Snapshot serialization preserves the phase within a frame, rather than the
loader's absolute elapsed T-state count. Capture time starts from that restored
phase, **34,943**, and never resets the machine's FRAMES or RNG.
Loading duration is outside this reference; the exact preparation command is
part of its provenance.

The adapter never writes RAM or registers after restoring the snapshot.
The ROM naturally writes into DEF FN parameter workspaces inside BASIC;
`finalBasicSha256` retains that result rather than forbidding the interpreter's
own writes. `patches: []` means no adapter patches, not constant machine state.
Original tape/snapshot/ROM/code bytes stay under gitignored `roms/`.
The committed fixture contains generated observations and rendered pixels.

## Capture and independent verification

From the repo root, with Bun and `uv` available:

```sh
bun install
bun run zx:link
uv run --with skoolkit==10.2 tap2sna.py \
  --sim-load-config cmio=1 --sim-load-config fast-load=0 \
  --sim-load-config finish-tape=1 --start 6952 \
  'roms/zx/Football Manager.tzx' roms/zx/analysis/timing-start.z80
bun run zx:timing
bunx prettier --ignore-path /dev/null build/zx/timing.json > build/zx/formatted-timing.json
cmp build/zx/formatted-timing.json web/src/sim/fixtures/spectrum-timing.json
bun test tools/zx/timing.test.ts
```

The capture uses Python through `uv run --with skoolkit==10.2`, with bytecode
caching disabled. Python and originals are optional research dependencies;
ordinary CI reads the committed fixture. The Bun wrapper only orchestrates
the Python adapter and writes valid JSON after successful completion.
An unresolved anchor, time limit or identity mismatch fails the command.

The small clock verification needs **no original game files**:

```sh
bun run zx:timing:clock
```

Both native `CCMIOSimulator` and Python `CMIOSimulator` must pass 38 independently
calculated cases each: contended/uncontended NOP fetches, all four 16-bit I/O
port classes for IN and OUT, frame wrapping, interrupt-window edges, disabled
interrupts, EI delay, and IM 1/2 entry. A separate ROM BEEPER case checks
HL=10, DE=1: OUT starts at T=189,347,505,663 and RET ends at T=731.
These expectations do not import SkoolKit's delay tables. Each game capture
runs these checks first and includes their result. The sources note contains
the arithmetic and a standalone verification command.

## Input script and trace schema 1

All times and durations are integer **elapsed T-states**, including contention
stalls. Divide by 3,500,000 for nominal seconds, or 69,888 for ULA frames.
An event's `t` is in the restored snapshot's clock domain. Subtract `originT`
for elapsed run time; do not subtract the initial phase before calculating
ULA frame boundaries. The ULA frame number is `floor(t/69888)`.
`romFrames` is the separately observed 24-bit ROM counter. Neither value is
host time. Sound disables interrupts, so the counters can diverge.

The JSON script has shared `defaults` and ordered `runs`; per-run fields
override defaults. An action's `when` anchors to entry of a BASIC line at ROM
statement dispatch (`line`), PAUSE's HALT loop (`pause`), or PAUSE loop exit
(`pause-exit`). Anchors are observed **before** the instruction executes.
They are encountered in script order, once per action. They are synchronization
points, not an assumption that all work on a line has completed.

`afterFrames` schedules a delay from the later of that anchor and the preceding
action's input completion. `text` types its individual matrix keys followed by
ENTER, with four frames down and six released by default. `down` sets the
complete held-key set, optionally releasing it after `holdFrames`. `sequence`
gives explicit `{down, frames}` transitions, including chords. `stop` ends the
capture at its scheduled boundary. There is no host keyboard repeat or
write to LAST-K/FLAGS. The ROM scans the persistent matrix, including combined
row selections, and owns repeats and debounce.

The output retains these distinct observations:

| Field/event            | Meaning                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `anchor`               | Script action name, BASIC line and actual entry time                                                           |
| `keyboard`             | Requested transition `requestedT`, first effective instruction boundary `t`, complete `down` set               |
| `checkpoint`           | BASIC line/statement, SEED, ROM FRAMES, keyboard state and selected game variables, before statement execution |
| `pause-enter`          | At PC=7997, first HALT-loop entry, with BC frame count and keyboard state                                      |
| `pause-exit`           | At PC=8015, loop finished, before the ROM clears FLAGS bit 5; `enteredT` pairs it with entry                   |
| `beep-enter`           | BEEPER PC=949 before DI, HL delay, DE cycle count minus one, caller PC and state                               |
| `beep-enter.returnedT` | Exact end of BEEPER's RET instruction, before possible interrupt acceptance                                    |
| `beep-enter.edges`     | `[OUT start T, OUT instruction end T, full port, bit-4 level]` for each speaker transition                     |
| `beep-exit`            | Caller actually resumes; `enteredT` pairs it with entry. An ISR after RET can delay this                       |
| `ear`                  | Speaker transition outside a BEEPER call, using the same tuple                                                 |
| `video`                | One `[ULA frame, actual sample T, image index, border colour]` per completed frame boundary                    |
| `imageHashes`          | Per-run image index → SHA-256 of row-major 256×192 RGBA bytes                                                  |
| `pixels`               | Shared SHA-256 → base64 of zlib-compressed rendered RGBA; no executable/snapshot bytes                         |
| `sampling`             | Maximum observed input/video lateness, derived from the retained individual samples                            |

Keyboard state includes LAST-K, FLAGS, both KSTATE slots and repeat settings.
The register array and RAM hash identify the complete input checkpoint; later
checkpoints deliberately export selected game variables, not executable memory.
No per-statement or per-frame execution cost is averaged into the trace.

### Video and speaker timestamp limits

Video is a **whole-screen RAM sample**, taken after the first instruction
ending at or beyond a nominal ULA frame boundary. The instruction callback
runs before interrupt acceptance; an interrupt entry that crosses a boundary
can defer sampling until the next instruction. The individual sample time
makes that lateness explicit. Pixel decoding uses Spectrum bitmap addressing,
attributes, 215/255 channel intensities and alpha=255; all 192 lines are kept.
FLASH uses the elapsed ULA frame counter with the script's declared initial
phase zero. The snapshot does not restore a hardware FLASH counter or the
EAR latch; EAR initially low and border from the snapshot are capture conventions.
The border field records the sampled colour, not a rasterized border signal.

This captures full decoded frames for reproducible screen comparison, but it
does **not** reconstruct the beam's earlier bitmap/attribute fetches. Tearing,
floating bus, snow, exact simultaneous write/fetch ordering and border raster
timing are not validated. These frame images must not be called cycle-exact
ULA video. A future beam-level comparison needs a separately validated ULA
pipeline; moving a whole-screen sample by a constant cannot establish that.

The native OUT callback's supplied offset is one T-state beyond instruction
completion, a border-rendering convention. This adapter subtracts one to record
OUT completion and also retains OUT start. Neither is claimed as a separately
measured electrical speaker-latch edge. It preserves full 16-bit ports so I/O
contention is reproducible. Duration is `returnedT - beep-enter.t`, while caller
resumption includes any intervening interrupt service. Key clicks also call
BEEPER and remain in the trace.

## Observed cases and variable costs

All session cases run the tape's unmodified autostart and use only matrix
inputs: manager `alex`, club `1`, level `1` or `7`, and kit `0` or `7`.
No RNG, FRAMES, score, direction, lineup or colour variable is patched.

- `black-natural` / `white-natural`: title, setup and first match with natural
  pauses. The first level-1 match happens to contain only rightward highlights.
- `black-level7` / `white-level7`: both highlight directions in each kit,
  dribbles, release kicks, both collision routines, goals and misses. The
  tests require those actual statement and BEEPER observations.
- `black-new-key`: the same level-1 prefix, with SPACE pressed 20 frames after
  entering the first highlight pause, then released after ten frames.
- `black-held-key`: SPACE pressed before the first miss BEEP and held for
  200 frames. The preceding goal's pause expires before this press. The
  targeted miss pause starts with the key held and FLAGS bit 5 already set;
  it exits after 16,348 T-states. A later pause also exits within a frame,
  even after release, with a pending flag from the hold/repeats. This preserves
  observable FLAGS/KSTATE behavior rather than assuming a hold is inert.
- `colour-error`: invalid colour `1`, natural `PAUSE 200`, then correction to `0`.
- `title-new-key` / `title-held-key`: press during the title wait versus hold
  from before title drawing. Both shorten the title pause, with different costs.
- `cup-victory-probe`: **isolated entry**, explicitly marked in `entry`.
  BREAK during the main-menu drawing, then `GO SUB 5213` typed through the
  original ROM editor. The original trophy/FLASH screen and all nine tones
  execute without a code or RAM patch. This establishes that screen's cost,
  not reaching a cup victory through normal play or a complete final-match path.

Some exact intervals demonstrate why averages or `PAUSE n / 50` are insufficient:

| Interval                                            |                                  Observed elapsed T-states |
| --------------------------------------------------- | ---------------------------------------------------------: |
| Natural title PAUSE loop                            |                                                 20,908,136 |
| Title PAUSE with pre-existing SPACE hold            |                                                  2,176,971 |
| First natural level-1 highlight PAUSE loop          |                                                 13,948,293 |
| Same pause with new SPACE after 20 frames           |                                                  1,438,790 |
| Subsequent natural highlight pauses in the same run | 13,924,457; 13,921,321; 13,919,953; 13,940,545; 13,938,921 |

The fixture retains every sample, sound edge, BEEPER call cost and checkpoint;
the table is illustrative, not a production timing lookup. Different branch,
geometry, keyboard-repeat state and ULA phase have different execution costs.
This capture has 42,092 video samples, 2,446 unique rendered images and 94
distinct measured BEEPER durations. Maximum observed video lateness is 20
T-states; maximum input lateness is 27 T-states (the isolated cup probe).

## Alignment, tolerances and exclusions

Reproduction with the same pinned model, snapshot and script requires **exact
integer equality**, including requested/effective input times, ULA samples,
BEEPER edges, ROM FRAMES, state and RNG. Compare decoded JSON to ignore
formatting; the commands above format it for a byte comparison too. Align at
the snapshot's `originT` and named anchors. Keep the original frame phase;
never realign each highlight, sound or RNG checkpoint independently to hide
drift. Frame-based reseeding uses observed ROM FRAMES, not ULA elapsed frames.

Input delivery and video sampling have no arbitrary universal one-instruction
tolerance. Their individual requested/sample timestamps are retained, along
with observed maximum lateness for each run. They bound this adapter's
quantization, not physical hardware accuracy or permitted web pacing drift.
The [highlight/timed-screen comparison](highlight-pacing.md) declares its
scheduling/sampling mapping and tolerances; future comparisons must do likewise. A hardware comparison must establish machine/ULA phase and
electrical measurements first; no numeric hardware tolerance is claimed here.

Host keyboard dispatch, OS/browser frame scheduling, monitor scanout, audio
buffering, speaker acoustics, browser file dialogs and browser printing are
outside this clock. Web save/print adapters remain the accepted boundary in
[ADR-0004](adr/0004-define-phase-one-fidelity-boundary.md). Tape loading and
general command-console parity are not inferred from the isolated probe.
These observations provide reference evidence for #25–#27.
[Measured pacing](highlight-pacing.md) now compares the covered web paths,
including BEEPER interrupt losses. [Beeper playback](beeper-playback.md) establishes
the covered speaker signals and event scheduling. Complete-session pacing/audio and
uninterrupted multi-season comparisons remain #34's work.

The separate [frame/reseed capture](frame-clock-and-reseeding.md) now observes
setup, status return, match return and full SAVE/continuation boundaries using
this same clock. It does not modify this script or reference corpus.
