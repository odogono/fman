# Original beeper events and browser playback

Issue [#27](https://github.com/odogono/fman/issues/27) uses the shared
[PAL 48K timing contract](spectrum-timing.md): 3,500,000 Hz, integer elapsed
T-states, 69,888 T-states per ULA frame, SkoolKit 10.2 CCMIOSimulator with
memory and I/O contention. ROM FRAMES excludes interrupts lost during BEEPER.

## Original observations

`tools/zx/capture-sound.ts` and `inputs/sound.json` run the unchanged tape
snapshot through keyboard inputs. `sim/fixtures/spectrum-sound.json` records
absolute statement, input and BEEPER entry/return times, operands, OUT starts,
OUT completions, levels and RNG state. The new runs cover setup, menu, status,
squad, fixture, team selection, deletion of an empty line, text, cursor
movement, deletion, held-key repeats and ENTER. No game RAM/register patch is
used. The original [timing corpus](spectrum-timing.md) additionally covers
both attack directions and kit colours, goals, misses, release kicks,
collisions, shortened pauses and the isolated cup-victory routine. That cup
probe enters by BREAK/GO SUB through the ROM editor; it is not a normally
played final.

A separately marked **synthetic ROM-unit probe** calls BEEP with calculator
operands, workspace pointers, SP and IFF supplied by the adapter. It verifies
all 50 duration/pitch combinations reachable in the game: 36 random goal
pitches, ten prompt/cup pitches and four kick/collision/miss combinations.
It exports only operands, never original code, ROM bytes or snapshots, and
is distinct from the unmodified game runs.

| Event                  | Original source            | Operands and sequence                                                       |
| ---------------------- | -------------------------- | --------------------------------------------------------------------------- |
| Input/editor click     | ROM editor, caller PC 3911 | HL=200, DE=0; two speaker edges, normally 1,207 T-states                    |
| Continue / list prompt | BASIC 1030 / 1080          | BEEP .2,0; HL=1642, DE=51; about 689,000 T-states                           |
| Release kick           | 343 / 443                  | BEEP .15,-40; HL=16825, DE=3                                                |
| Collision              | 352 / 452                  | BEEP .15,-30 then .08,-40, with interpreter work between calls              |
| Miss                   | 346 / 446                  | BEEP .25,-50; HL=30002, DE=3, followed by PAUSE 200                         |
| Goal                   | 293                        | 5 + FN r(5) tones; each BEEP .05,FN r(36), followed by score work and PAUSE |
| Cup victory            | 5216                       | Nine BEEP .2,i calls, pitches 1 through 9, interleaved with star-row PRINTs |

Prompt calls are mapped from the BASIC call sites. Setup's manager/club/level/
colour inputs and sale acceptance have no extra prompt BEEP. Invalid main-menu
commands redraw the menu and beep again; invalid squad/selection numbers retry
INPUT without another list beep. The over-eleven-player removal prompt has no
1080 call. Copy retries of 1030 repeat its beep; copy at the management INPUT
does not. Input clicks still occur for ENTER, empty deletion and cursor keys.
The captured held `c` first repeats after 35 keyboard scans and then every five;
no BEEPER call changes SEED. Goal-loop randomness remains in the simulation:
sound rendering never draws random numbers.

## Signal and scheduling

`sim/beeper.ts` computes the initial contended BORDCR read, loop half-cycles,
contended even-port OUTs and final return. **Every OUT start, completion,
level and entry-to-RET duration equals the committed original observations
exactly at their captured entry phase.** Speaker transitions use OUT completion,
the capture's declared convention, not an electrical-latch measurement.
The same computation supplies blocking time and browser samples. The former
approximate duration calculation allowed up to 32 T-states of error; that
signal-level approximation is removed.

The browser integrates high/low pulse area over each audio sample, including
fractional edge samples, at the AudioContext's actual sample rate. It plays
quiet mono buffers instead of nominal-frequency oscillators. Tests cover
44.1, 48 and 96 kHz, pulse area and buffer duration. Output amplitude, the
browser/device's filtering and acoustic response are host properties.

Timelines forecast all remaining sound starts using a copy of the PAUSE
keyboard state. They include predictable pending/held-key pause shortening
without consuming real keyboard scans or RNG. Future BEEPER durations are
recomputed at their actual phase. AudioContext schedules the sequence ahead;
rendering and RAF never decide which events to deliver. A delayed RAF therefore
cannot drop intervening tones. Changed pause plans cancel obsolete future
sources before scheduling the revised sequence. Already expired events are
never replayed; an active event restored or unlocked late resumes at its offset.

Prompt BEEPs block submissions and keyboard scanning while ULA time continues.
The session carries unused time from highlight/cup completion into the following
prompt even in a single large advance. The trailing prompt is included in the
audio forecast before that advance. Repeated render calls do not replay sounds.
Host-menu opening, muting, hiding the page and replacing a session cancel queued
and active audio; resuming starts from the retained simulation position. New
input boundaries anchor their audio to dispatch time. A key click finishes
before the new program sound. Gesture unlocking remains mandatory: keyboard or
pointer interaction resumes AudioContext, with no historical catch-up burst.

## Comparison boundary

Natural highlights align once at line 5000. Tests compare the complete sound
operand order, start times within **two ULA frames** (39.936 ms), and final seed
for all four natural reference runs. No per-sound realignment is used. Cup
sequence comparisons use the existing routine's measured entry phase and a
one-frame bound. Exact signal equality applies at each _given_ entry phase;
the execution-path scheduler still has the documented [pacing bounds](highlight-pacing.md).

Other management screens retain atomic rendering/execution boundaries: their
prompt begins at that boundary, not at a claim of instruction-exact whole-screen
PRINT timing. Browser dispatch is sampled in whole ULA frames; device audio
latency is outside this reference. The desktop native text field produces the
measured click for host text/key events; its cursor, repeat cadence, paste/IME
and edit timing remain browser behavior under [line editing #29](https://github.com/odogono/fman/issues/29).
These limits do not justify a full-session audio timing or physical-machine
certification; [ADR-0008](adr/0008-relax-presentation-parity.md) drops that
comparison. Tape-recording sounds are not reproduced.

## Saves and reproduction

Journal **version 4** preserves a prompt in progress and the revised beeper
durations. Active v2/v3 journals are rejected because replaying their frame
counts would change timing. Idle v2/v3 menu checkpoints and v1 Game files still
import. Browser audio buffers and fractional host phase are reconstructed,
not serialized.

With originals linked and the shared timing snapshot prepared:

```sh
bun tools/zx/capture-sound.ts
bunx prettier --ignore-path /dev/null build/zx/sound.json > build/zx/formatted-sound.json
cmp build/zx/formatted-sound.json web/src/sim/fixtures/spectrum-sound.json
bun test tools/zx/sound.test.ts web/src/sim/beeper.test.ts web/src/view/sound-scheduler.test.ts
bun run check
bun run build
```

## Browser recording

The built app was exercised in Chromium with a running 48 kHz AudioContext,
unlocked by a real keyboard gesture. Setup, menu/status return, imported
mid-highlight and final-cup journals used the actual UI. A 1,200 ms synchronous
main-thread block during the cup animation left all nine scheduled rising tones
and the following prompt intact: ten sources, zero cancellations/duplicates.
Opening the host menu canceled 39 scheduled highlight sources; importing the
cup journal replaced that sequence. The run recorded no page errors. A final built-app smoke check (`index-vt5c4v07.js`)
also scheduled all ten sources once, canceled none, and restored the continue
input after the prompt, with no page errors.

The [source scheduling log](evidence/beeper-browser.json) retains buffer lengths,
start times, offsets, cancellation times and scenario markers. Its raw
[MediaRecorder audio](evidence/beeper-browser.webm) is the browser's Opus output.
The compact [listening copy](evidence/beeper-browser.ogg) resets packet timestamps
to consecutive samples with FFmpeg (`asetpts=N/SR/TB`), because the MediaRecorder
stream omits long silent gaps. It contains input clicks, prompt tones and the
cup sequence. The listening copy is **not** an elapsed-time measurement; the
source log and deterministic tests establish scheduling and signal timing.
Both recordings are lossy host audio, not reference ROM signal fixtures.

To repeat the browser check: build/serve the app, attach a
`createMediaStreamDestination()` to each created buffer source, record it with
MediaRecorder, and log `start`/`stop` calls. Import a saved journal at highlights,
open Menu to cancel it, then import a journal just before cup celebration.
Block the main thread from 450 ms to 1,650 ms after loading the cup journal.
Verify the nine cup sources and trailing prompt remain scheduled once, complete
the trophy, and that the continue input becomes available. Gesture unlocking,
menu freezing and audio cancellation remain observable host constraints.
