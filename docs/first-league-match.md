# First league match

The first playable match extends [fresh-game management](fresh-game-management.md): type `99` at the management menu, review the fixture and team strengths, adjust the picked team, then watch highlights and continue through the final score, other results, league table and weekly bills.

This increment originally ended after the first league cycle. The [first-cup increment](first-cup-round.md) now adds the following cup tie and replays. The [league-continuation increment](league-progression.md) now adds further league fixtures. The [complete cup progression](cup-progression.md) adds all eight rounds. [Season progression](season-progression.md) is now implemented. [Dismissal and reloading](dismissal-restart.md) are now implemented. [Name editing](name-editing.md) is now implemented. Saving remains unavailable. The subsequent [transfer-market increment](transfer-market.md) now continues from bills to buying players before returning to management. The season boundary follows the last league match and completion of the cup campaign.

## Pre-match selection

The first fixture is at home, against the first other club in the current division. Five opponent attributes consume five original RNG draws. Energy, Morale, Defence, Midfield and Attack are displayed using the original aggregation and 1–20 clamps. Team energy always divides the picked players' total energy by eleven, even for a depleted team.

The original first-fixture exception skips energy recovery, fatigue and injury refresh. Injuries already caused by a refused sale remain. The [first-cup increment](first-cup-round.md) now adds refresh for cup legs.

From the strength summary, `99` starts highlights; any other non-copy input opens selection, matching the BASIC fall-through. When at most eleven players are picked, only a reserve can be added. With twelve picked, a removal is required and `99` is rejected. After removal, `99` returns to the summary. The summary has no exact-eleven requirement, so a depleted team may play. This corrects the initial analysis's suggestion that a newly selected twelve-player team could proceed directly.

## Headless highlights

`sim/highlights.ts` transcribes the original left/right attacks and opportunity loop. A 24×32 logical attribute plane models the effect of `PRINT` on collision colours. Pitch plotting uses the same yellow ink/green paper throughout, so initial pitch marks do not change collision attributes. The DOM and canvas never supply match state.

Important source behaviours are retained:

- Attacker/defender coordinate arrays survive between attacks. Placement rejection checks future slots that have not yet been overwritten, so resetting those arrays each attack changes results.
- Arithmetic boolean expressions consume their random operands eagerly. Both direction draws occur on a collision even when one multiplier is zero.
- `ATTR` converts coordinates to absolute byte magnitudes and computes an XOR-based memory address; it does not enforce visible column bounds. Captured paths include negative/off-screen columns. See the ROM's [attribute lookup](https://skoolkit.ca/disassemblies/rom/asm/9600.html) and [coordinate conversion](https://skoolkit.ca/disassemblies/rom/asm/8967.html).
- Goalkeeper moves, colour restoration under the ball, mirrored goal tests and corner exclusions determine whether the ball scores. Each opportunity runs two attacks. If the opportunity loop leaves the score 0–0, one attack in each direction still runs and may score.
- Celebratory random beeps consume the same RNG draws as the original. Collision frames hold the kicking posture during both beeps before restoring the standing player.

The engine emits sprite draws, tone parameters and pause events for playback. It retains original draw order and carried positions. A diagnostic iteration bound prevents a malformed/nonterminating simulation from hanging the browser; it is not a new football rule.

## Results and finances

The completed first cycle credits the current home gate, awards points/goals, adjusts morale and the future home-gate value, pairs the other fourteen clubs and generates seven results. The table uses the original finite-pass bubble sort, including swapping completely tied neighbours. Wages include all owned players, rent depends on division, and loan interest is truncated to whole pounds. The previous-net-funds baseline is preserved for the displayed weekly balance.

The headless completion function calculates other results, ranks and bills as one transaction after continuing from the final score. The view presents those pages in the original order. The verified state boundary is the bills prompt, not every intermediate BASIC statement; persistence during this transaction does not exist yet.

## Original evidence and reproduction

`sim/fixtures/first-matches.json` contains numeric observations from five controlled original runs, using initial menu seeds 0, 1, 42, 219 and 65535. The source is the supplied fresh tape, whose BASIC matches the saved snapshot. Each run uses the original default picked team, level 1, black kit and Arsenal moved into Division 4.

Tests compare:

- All 26 captured attacks: ball coordinates/direction and RNG state at every step, final carried player coordinates, goals and final seed.
- Five whole highlight sequences: attack directions, final score and RNG state.
- Five completed cycles: cash, debt, morale, future gate, wages, weekly balance, all sixteen clubs' points/goals/ranks and final RNG state.

Recreate the original-analysis fresh checkpoints, then capture and compare the observations:

```sh
uv run --with skoolkit==10.2 tap2sna.py 'roms/zx/Football Manager.tzx' roms/zx/analysis/local-original.z80
bun tools/zx/observe.ts roms/zx/analysis/local-original.z80 roms/zx/analysis fresh
bun tools/zx/capture-match.ts roms/zx/analysis/24-fresh-menu.z80
bunx prettier --ignore-path /dev/null build/zx/first-matches.json > build/zx/formatted-first-matches.json
cmp build/zx/formatted-first-matches.json web/src/sim/fixtures/first-matches.json
bun test web/src/sim/highlights.test.ts web/src/sim/league.test.ts
```

The optional capture tool runs SkoolKit 10.2, checks the BASIC hash and fresh-state profile, patches SEED explicitly at the management prompt, and records BASIC statement boundaries. It exports observations rather than original binaries or source. Originals/checkpoints remain under gitignored `roms/`; generated scratch output stays under `build/`.

An additional 1,000-seed robustness run completed without simulation errors, using both kit colours. That run checks termination, not original-ROM parity beyond the five reference profiles. The original increment's browser test completed selection, natural highlight playback, results, table and bills; at that point another fixture was unavailable. Subsequent increments now continue the campaign.

## Presentation limits

The view uses the original fifteen UDG sprites, XOR drawing, pitch coordinates, four-row goal banner and nominal BEEP pitches/durations. Rasterization is independently tested to restore the pitch when a sprite is XOR-erased. Sound uses a quiet browser square-wave oscillator and requires a user gesture.

Exact ROM-pixel equality is not established: straight lines use Bresenham rasterization, the curved pitch marking uses host trigonometry, text uses the previously documented redrawn typeface, and the browser line editor remains. These presentation choices do not supply collision attributes or influence scores.

Animation timing remains provisional: dribbles use thirty frames per step, ordinary ball steps eighteen, and collision steps forty split around the original 0.23 seconds of beeps. End-of-attack `PAUSE 200` is honoured and a new keypress can shorten it. This preserves event order and explicit waits, but does not reproduce BASIC instruction costs, exact hardware beeper frequency quantization or cycle-accurate pacing.
