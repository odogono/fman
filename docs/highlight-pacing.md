# Measured highlight and timed-screen pacing

[#26](https://github.com/odogono/fman/issues/26) replaces the initial one-frame
placement, 30-frame dribble, 18-frame ball and split collision holds with
execution-path budgets. The simulation remains headless and seeded. Timing
follows the statements, branches, rejection-sampling loops and PRINTs actually
executed by each attack; production never selects a duration by captured seed.

## Evidence and model

`tools/zx/inputs/pacing.json` extends the unchanged [#24 reference
script](spectrum-timing.md) with manager-name and changed-level validation
errors. Its twelve runs cover both kit colours, levels 1 and 7, natural waits,
fresh/held SPACE, the title, colour validation and the isolated cup-victory
probe. The cup probe uses BREAK and `GO SUB 5213` through the ROM editor; it
measures the routine without claiming a normally played final-match trace.

`capture-pacing.py` uses the same pinned SkoolKit 10.2, PAL 48K model,
contention-aware adapter, tape and starting snapshot as #24. It patches no RAM,
registers or code. It records BASIC dispatch (PC 6952), printable characters
(PR-ALL, PC 2943), DRAW-LINE entry (`0x24BA`), BEEPER entry/return and PAUSE
entry/exit. The committed `sim/fixtures/spectrum-pacing.json` contains numeric
observations, hashes and configuration; no original program, ROM or snapshot.

`pacing-costs.ts` removes explicit PAUSE/BEEPER spans and takes the median of
each dispatch edge's total interpreter cost and PRINT/DRAW offsets. Input-wait
edges are excluded. `sim/execution-costs.json` is the resulting production
budget table. An uncaptured edge first uses the same source statement with a
matching jump/fall-through shape, then its mirrored attack statement. The
forced second attack uses the equivalent ordinary second-attack call. A wholly
unmeasured statement fails explicitly. These fallbacks generalize branches;
they do not certify timing for every possible operand.

The scheduler exposes each sprite PRINT separately, draws straight lines and
the eight arc chords progressively, and prints outcome text, goal banner and
score incrementally. Character completion is approximated at PR-ALL entry plus
3,000 T-states. Line progress is interpolated within measured DRAW-LINE spans
and sampled at most one ULA frame apart. This retains visible intermediate
drawing without emulating every bitmap write or the beam. Semantic checkpoints
identify initial placement, dribble, release, collision and ball states for
[pixel regression](pitch-rendering.md), independently of their durations.

BEEP durations use quantized ROM operands and a BEEPER loop/port-contention
model. BEEPER disables interrupts: playback advances ULA time while withholding
those ROM FRAMES ticks and keyboard scans. The browser still uses nominal
oscillator audio; sound event delivery and audible parity remain
[#27](https://github.com/odogono/fman/issues/27).

## PAUSE and timed screens

The integer T-state timeline scans keys only on serviced interrupts. A fresh
key sets the pending flag; releasing it does not clear that flag. CLS clears
it. A held key repeats after 35 scans and then every five scans. PAUSE tests
the flag after HALT, so a pending flag can shorten a later pause even after
release. Browser key down/up transitions feed this state; they cannot skip
pitch drawing, PRINTs or BEEPs. The explicit `skipPause` testing API acts only
inside PAUSE; for title/errors it also completes the short interpreter tail.
It cannot skip the cup animation.

The title prints before `PAUSE 300`. At the captured initial phase, natural
completion takes 304 browser advances; SPACE newly pressed at frame 24 finishes
at 25, while SPACE held from program entry finishes at 36. Manager-name and
colour errors include printing and `PAUSE 200`; changed-level errors include
`PAUSE 300`. At phase zero they take 205, 205 and 305 browser advances. Cup
victory prints its ten-row trophy, two-row title and nine star rows interleaved
with nine rising tones. It takes 134 browser advances at phase zero, including
about 89 ULA boundaries with interrupts disabled, and has no skippable PAUSE.
FLASH follows ULA time rather than the sound-reduced ROM counter.

## Comparison and permitted differences

Tests align each match **once at line 5000**, using its observed seed, carried
positions, strengths and initial ULA phase. They never realign per attack or
sound. The four natural matches compare all dispatch paths, pitch-statement
completions, sprite/outcome/score PRINTs and the final line-5110 transition.
Two further matches replay the original fresh/held-key transition times.
Score, final RNG seed and carried positions remain equal. All 766 previously
captured stable animation pixel states and both empty pitches remain equal.

The following bounds apply to this corpus, measured in the simulation clock:

| Comparison                                          |     Test bound |                          Measured difference |
| --------------------------------------------------- | -------------: | -------------------------------------------: |
| Natural-match sprite completion times               | < 2 ULA frames |                         maximum 0.414 frames |
| Natural-match final transition                      | < 2 ULA frames |  −0.015 frames at level 1; −0.313 at level 7 |
| Pitch-statement, outcome and score completion times | < 2 ULA frames | within bound across the four natural matches |
| Fresh/held-key sprite times and final transition    | < 2 ULA frames |              within bound across both traces |
| Lost ROM interrupt ticks over each highlight run    |      ≤ 2 ticks |        natural runs differ by at most 1 tick |
| BEEPER entry-to-RET duration                        |  ≤ 32 T-states |                          maximum 25 T-states |
| Natural title routine                               |  < 1 ULA frame |                                   +1 T-state |
| Manager / colour / changed-level error routines     |  < 1 ULA frame |                      +69 / +66 / −6 T-states |
| Cup-victory routine                                 |  < 1 ULA frame |                                −306 T-states |
| Fresh/held-key title completion                     |  < 1 ULA frame |                            both within bound |

One frame is 69,888 T-states, 19.968 ms; two frames are 39.936 ms. Signed
differences are model minus reference. PRINT comparisons use the declared
3,000-T-state completion offset. Timed-screen routines use the captured entry
phase; browser whole-frame counts round their completion up to the next call.
The corpus also calibrates the medians: this is a reproducible model comparison,
not independent physical-hardware certification. One thousand additional seeds
exercise defined, nonnegative attack scheduling, without claiming reference
timing parity for those seeds.

Operand sizes, PRINT contents and ULA contention produce variation around the
medians. Edited names and arbitrary operands outside the corpus are not timing
certified. This is an approximate execution-path model, not instruction-exact
BASIC execution, beam-exact video, exact audio or complete-session timing.
[Glyph fidelity #28](https://github.com/odogono/fman/issues/28),
[line editing #29](https://github.com/odogono/fman/issues/29) and
[uninterrupted multi-season comparison #34](https://github.com/odogono/fman/issues/34)
remain separate work. Other management and result screens still use atomic
simulation boundaries.

## Saves and reproduction

The journal is now **version 3**. Menu checkpoints retain ROM FRAMES, ULA time
and PAUSE keyboard state; subsequent inputs include key transitions. Replaying
restores mid-drawing, held/released-key and interrupt-loss behavior. Version-1
Game files still import through the reseed boundary. Version-2 files import only
when they contain an idle three-field menu checkpoint and no subsequent inputs.
Active version-2 journals are rejected because replaying old frame counts with
new animation durations would silently change their state. Browser fractional
phase and time spent with the page closed remain outside the save contract.

With the original files linked and #24's starting snapshot prepared:

```sh
bun tools/zx/capture-pacing.ts build/zx/pacing.json
bun tools/zx/pacing-costs.ts build/zx/pacing.json
bunx prettier --write web/src/sim/execution-costs.json
bunx prettier --ignore-path /dev/null build/zx/pacing.json > build/zx/formatted-pacing.json
cmp build/zx/formatted-pacing.json web/src/sim/fixtures/spectrum-pacing.json
bun test tools/zx/pacing.test.ts web/src/sim/pacing.test.ts web/src/view/pitch.test.ts
bun run check
bun run build
```

The provenance test checks script/ROM/BASIC hashes, model configuration and
exact regeneration of the production budgets. Browser DOM/canvas checks exercised
setup, invalid-colour correction, highlights and held/released SPACE with no
page errors. Screenshot capture timed out, and the alternate controller reported
no available browser; visual screenshot inspection was therefore unavailable.
