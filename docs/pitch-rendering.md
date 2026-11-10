# Pitch and sprite pixel verification

The original pitch's three-argument DRAW produces eight rounded line segments.
The previous browser renderer approximated that marking with 48 host-trigonometry
samples. Replacing those samples with the ROM-rounded chords corrects 58 pixels
in each empty pitch at the native 256 × 176 resolution. The existing integer
straight-line rasterizer already matches the captured output and is retained.

The eight relative chords are `(2,-7), (3,-7), (4,-7), (5,-5), (5,-5), (7,-4),
(7,-3), (7,-2)`, starting at `(55,96)` for the right attack. The left marking
starts at `(201,96)` and negates each x delta. These are constants for this game's
fixed `DRAW ±40,-40,±2*PI/5`, not an implementation of arbitrary curved DRAW.
The production renderer uses these numeric chords, not captured image assets or
test fixtures. Player/ball placement, UDGs and XOR rendering required no changes.

## Original capture

```sh
bun tools/zx/capture-pitch.ts roms/zx/analysis/24-fresh-menu.z80
```

The optional capture tool uses SkoolKit 10.2 through `uv` and checks:

- Recovered BASIC SHA-256:
  `5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6`.
- The SkoolKit 48K ROM SHA-256:
  `d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`.

It controls the initial menu seed (0, 1, 42, 219, 65535) and kit colour (0, 7),
then follows the original first match. Game and ROM drawing code are unmodified.
A ROM DRAW-LINE entry hook at `0x24BA` records integer arc vertices; this is
independent of the screen-memory decoding used for pixel comparisons.
BASIC statement boundaries identify completed pitch drawing, initial placement,
completed dribble iterations and completed ball steps. The ROM BEEPER entry at
`0x03B5` records release and collision poses before their beeps, so the kicking
sprite is included before it is XOR-erased.

The screen's non-linear bitmap layout and attributes are decoded to canonical
RGBA bytes using the Spectrum's normal/bright palette. Each complete 256 × 176
buffer receives a SHA-256 hash. The committed `sim/fixtures/pitch.json` stores
those hashes, numeric entry state and curve vertices; no ROM/program, font,
or original snapshot is committed. Local compressed bitmap/attribute diagnostics
are written to `build/zx/pitch.json.pixels.json` and remain ignored.

## Regression coverage

The two empty pitches and 766 animation states across 52 attacks match the
captured pixel hashes. The animation states comprise 52 initial placements,
160 dribble states, 52 release poses, 18 collision poses and 484 completed ball
steps, covering both directions and both kit colours. Existing XOR erasure,
ball/RNG and competition tests remain in place. Before the correction, both
empty-pitch checks and all 52 attack pixel tests failed.

```sh
bun test web/src/view/pitch.test.ts
bun run check
bun run build
```

Controlled browser comparisons import the merged-main and revised renderer
modules with identical attack input/frame indices. Live browser verification
also follows normal setup, fixture and team inputs into animated highlights.
These comparisons and the running app reported no page errors.

## Scope limits

Hashes cover stable pre-outcome frames, not every intermediate BASIC printing
instruction or 50 Hz video frame. They exclude the goal banner/score overlay
and NO GOAL text, whose redrawn font has not been established as ROM-pixel exact.
Animation durations, BASIC instruction costs and beeper accuracy remain at the
previously documented provisional fidelity. Competition rules, RNG, sprite
simulation and save format are unchanged.
