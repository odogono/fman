# 48K Spectrum timing sources and verification limits

Research for [#24](https://github.com/odogono/fman/issues/24), checked on
2026-11-10. This establishes a reproducible **SkoolKit 10.2 48K timing model**
and small, independently calculated checks. It does not establish that a game
trace is identical to a physical Spectrum. No physical-machine measurements or
external timing-test suite were run for this note.

## Evidence and provenance

The sources have different authority:

- **Hardware design evidence:** the archived early ULA logic sheet
  [SRL81C-1, 6 November 1981][logic] and Ferranti's
  [5C102 Timing Diagram 4, 5 January 1982][field]. Both one-page scans were
  downloaded from the archive's linked original Google Drive files, rendered
  and visually inspected. The early sheet's authorship is unspecified; it
  uses Ferranti cell names and differs from the production pinout. These are
  design records, not measurements of the particular machine that ran the game.
- **Manufacturer documentation:** Sinclair Research's
  [Spectrum Service Manual][service], sections 1.3.3–1.3.4, 1.5.2, 1.7–1.8
  and 1.10 (Brendan Alford's re-typeset revision 1.3), and Zilog's
  [Z80 CPU User Manual, UM008011-0816][z80], timing/interrupt chapters and
  instruction descriptions. The latter is a mirror of Zilog's document;
  Zilog's original download URL redirected to Littelfuse during this research.
- **Executable software evidence:** the bundled 48K ROM, checked by hash,
  with [Logan/O'Hara's annotated ROM disassembly][rom-map] as a readable
  locator. The ROM bytes determine software behavior; annotations are not
  independent hardware timing measurements.
- **Emulator implementation evidence:** SkoolKit 10.2's published source,
  especially [`c/csimulator.c`][c-core], [`cmiosimulator.py`][py-core],
  [`simutils.py`][simutils], [`trace.py`][trace] and [`screen.py`][screen].
  Their behavior is a primary source for SkoolKit, not hardware proof.

The ULA sheets were located through RetroTechCollection's catalogue. Its
editorial summaries were useful discovery aids, but the hardware statements
below refer to the inspected sheets themselves. The often-cited community
48K FAQ is not treated as independent primary hardware evidence here.

The exact SkoolKit tag is commit
`34b8612244f318e89c701615741de107e3548b88`. The
[PyPI 10.2 source distribution][sdist] SHA-256 is
`595fde2c3d96e3a2a0b0ab7d123a64a027e6d0ef79fd5159b99e9f01e3adafc6`.
Its `c/csimulator.c` was byte-identical to that commit's file, SHA-256
`c8ab7b69af01593b13951c6da4d7825f78d68926cb93629bbdeab6c849c5ab26`.
Inspection and probes used `uv run --with skoolkit==10.2 python ...`;
the available native class was `ccmiosimulator.CCMIOSimulator`.

## Units, frame phase and interrupts

Use integer nominal **T-states** as the reference unit. ULA stalls consume
elapsed T-states even though the CPU clock is inhibited. SRL81C-1 labels a
14 MHz oscillator, 7 MHz pixel clock, 3.5 MHz CPU clock, 15.625 kHz line rate,
50.08 Hz field rate and final divide-by-32 FLASH stage. The field sheet shows
312 lines, 192 display lines, a four-line field-sync interval and a low INT
pulse marked 9.14 microseconds at the start of that interval. Sinclair also
describes ULA clock inhibition to prioritize lower RAM access. [Hardware:
SRL81C-1][logic], [field diagram][field], [service manual §§1.3–1.5][service].

The following exact integers are the selected emulator convention, consistent
with those nominal hardware figures. They are explicit in SkoolKit's
[`simutils.py`][simutils] and native `configure()`/`set_memory()` in
[`c/csimulator.c`][c-core]:

| Quantity                          | Selected PAL 48K model                     |
| --------------------------------- | ------------------------------------------ |
| Nominal clock                     | 3,500,000 T-states/second                  |
| Scanline                          | 224 T-states, derived from 64 microseconds |
| Frame                             | 69,888 T-states = 312 × 224                |
| Frame duration in nominal seconds | 0.019968 seconds                           |
| Frame rate                        | approximately 50.080128205 Hz              |
| INT request                       | active while `0 <= T % 69888 < 32`         |
| First contention slot             | `T % 69888 == 14335`                       |

Thus 50 Hz is a useful BASIC/manual approximation, not the exact frame rate
of this model. Define absolute `T = 0` as the selected ULA INT-assertion phase,
and a frame boundary as `T = n * 69888`. This does **not** mean the top-left
visible pixel or interrupt-handler entry. The scans establish field-sync/INT
association and nominal pulse length; this research does not independently
establish the exact CPU-to-video edge phase or early/late ULA variants.

Zilog describes interrupt recognition at instruction boundaries, delayed
recognition after EI, and separate interrupt-acknowledge timing. In SkoolKit's
native `run()`/`trace()`, the instruction executes first, then IFF and the
32-T-state request window are tested. `accept_interrupt()` rejects EI and an
isolated DD/FD prefix; accepted IM 1 entry adds 13 T-states and enters `0x0038`.
IM 2 adds 19 and reads the vector at `(I << 8) | 0xFF`. The helper clears IFF
and HALT and pushes the return PC. These costs are acknowledge/entry costs,
not the ROM handler's variable execution cost. The native helper itself does
not check IFF or the request window; a custom stepping loop must do so.
[CPU timing/interrupt response][z80]; [native implementation][c-core].

The selected interrupt helper adds fixed entry costs without a separate
contention calculation for acknowledge/stack/vector accesses. Normal ULA
interrupt entry occurs in the non-display interval; do not generalize this
helper to arbitrary externally timed interrupts. Snapshot restoration also
collapses the exported interrupt state to the simulator's single IFF field;
this is not a complete electrical Z80 state model. [Implementation:
`accept_interrupt()`][c-core], [`from_snapshot()`][simutils].

Keep the ULA frame index and the ROM's 24-bit `FRAMES` at `0x5C78..0x5C7A`
as distinct trace fields. The [ROM handler at `0x0038`][rom-int] increments
FRAMES and scans the keyboard only when serviced. Disabled interrupts can
lose requests: there is no accumulated queue of missed frames. BEEPER disables
interrupts, so FRAMES can fall behind ULA elapsed time. The
[Sinclair BASIC manual, chapter 18][manual-pause] explicitly warns that BEEP
and tape operations make its software clock lose time.

## Memory and I/O contention schedule

The selected model contends all `0x4000..0x7FFF`, including system variables
and non-display RAM in that range; ROM and `0x8000..0xFFFF` are uncontended.
The service manual supports the hardware distinction between shared standard
16K RAM and the 32K extension, and CPU clock inhibition. The exact delay
schedule below is established here from SkoolKit source and checked with
small vectors, not independently measured on hardware.
[Hardware mechanism][service]; [`init_DELAYS_48K()`/`contend_48k()`][c-core].

For each display row `y = 0..191`, define `s = 14335 + 224*y`. During
`s <= phase < s+128`, the delay at an eligible access is
`[6,5,4,3,2,1,0,0][(phase-s) % 8]`; elsewhere it is zero. This is sixteen
eight-T-state groups per display row. Delays advance the clock **before**
the bus cycle, so later accesses must be evaluated at their delayed times.
The next row starts at 14559; the final row's last positive delay is at 57244. Being inside the broad display interval does not itself imply a delay.
These values follow directly from the native and Python delay-table builders.
[Native source][c-core]; [Python source][py-core].

Contention is evaluated per access/internal cycle, not once per instruction.
A NOP has a four-T-state opcode fetch. A memory operation can have additional
contended operand reads/writes. Some Z80 internal cycles expose addresses too;
the simple NOP vectors below do not verify those instruction families.
[Zilog timing and NOP description][z80]; [SkoolKit instruction patterns][c-core].

I/O uses the **full 16-bit port address**, not just the low byte. For
`IN A,(n)`/`OUT (n),A`, A supplies the high address byte. The following is
SkoolKit's four-T-state I/O-cycle model; `C(n)` means apply the current memory
contention delay, then advance n; `N(n)` means advance n without contention.
The cycles for fetching the opcode/immediate precede this table.
[Zilog I/O addressing, p. 61][z80]; [native `IOC_1..IOC_4` and
`contend_48k()`][c-core].

| Port high byte       | A0  | I/O-cycle schedule       |
| -------------------- | --- | ------------------------ |
| Outside `0x40..0x7F` | 1   | `N(4)`                   |
| Outside `0x40..0x7F` | 0   | `N(1), C(3)`             |
| Within `0x40..0x7F`  | 1   | `C(1), C(1), C(1), C(1)` |
| Within `0x40..0x7F`  | 0   | `C(1), C(3)`             |

## ULA sampling, frame captures and FLASH

The early ULA sheet shows separate bitmap and attribute latches feeding a
parallel-loaded serial shift register, with the most significant bitmap bit
first. Its attribute layout is FLASH, BRIGHT, PAPER, INK. The field sheet
enables video for 192 lines. This is evidence for a display generated from
RAM as the beam advances, rather than an atomic screen-memory snapshot once
per frame. Writes during display can affect different portions of a visible
frame differently. [SRL81C-1, lower half][logic]; [field diagram, VIDEN][field].

SkoolKit's CPU contention core does not implement a cycle-by-cycle ULA pixel
pipeline. In `trace()`, `draw_screen()` copies all 6,912 screen/attribute bytes
from current RAM after an instruction (and any accepted interrupt entry)
crosses a frame boundary. This can include writes after that boundary, and
cannot recover an earlier scanline overwritten during the preceding frame.
An instruction callback supplies no sub-instruction memory-write timestamp.
A decoded frame hash from that copy is therefore a **sampled RAM image**,
not proof of the video signal that a real ULA emitted. [Native `trace()` and
`draw_screen()`][c-core].

For capture, record the nominal frame boundary and actual sampling T-state,
whether sampling uses pre- or post-instruction memory, image dimensions,
palette, crop and FLASH phase. If sampling once per scanline or byte instead,
state the selected sampling offsets and approximation explicitly. This note
does not establish exact bitmap/attribute-fetch offsets, simultaneous
write/fetch ordering, border transitions, floating bus, snow, analogue colour
levels or display-device latency.

FLASH is generated by the ULA clock chain, independently of whether the CPU
services interrupts. The early sheet's divide-by-32 stage gives a full
normal/inverted cycle of 32 frames, with 16 frames in each state. SkoolKit's
`screen.py` selects the swap with `(frame // 16) % 2` for attributes with bit 7
set. This is a primary hardware design basis for the period and a separate
emulator convention for its phase. A snapshot's FRAMES value does not identify
the independent hardware FLASH-counter phase. An initial phase of zero must
be declared as a capture convention if no fuller history exists.
[Counter chain and FLASH XOR][logic]; [`Screen.draw()`][screen];
[Sinclair manual chapter 16, colour swapping][manual-colour].

## PAUSE: new presses, existing holds and repeats

Sinclair's [BASIC manual chapter 18][manual-pause] says PAUSE counts display
frames, zero waits indefinitely, and a key pressed after the pause starts
can shorten it. It also warns that computing before/between pauses costs
additional time. Do not replace an observed PAUSE interval with exactly
`n / 50` seconds.

The [ROM PAUSE routine at `0x1F3A` (decimal 7994)][rom-pause] fetches its
integer operand, then loops from `0x1F3D`: HALT, decrement BC, test the count,
then test bit 5 of FLAGS at `IY+1`. Completion at `0x1F4F` clears that bit.
The initial fractional-frame wait, interrupt handler and loop instructions
are real work. The zero-count path restores BC after decrementing zero;
there is no finite 65536-frame timeout for `PAUSE 0`.

The [ROM keyboard routine at `0x02BF`][rom-keyboard] owns the important
qualification: both new-key decoding **and repeat handling** reach
`K_END` at `0x0308`, which writes LAST-K and sets FLAGS bit 5. PAUSE itself
does not compare physical matrix edges. A previously held key is therefore
not equivalent to a newly detected press, but it is also unsafe to claim a
held key can never finish PAUSE. Existing FLAGS state, the two KSTATE slots,
repeat countdowns and statement-boundary behavior can affect the result.
The ordinary repeat defaults are 35 and 5 serviced interrupts (nominally
0.7 and 0.1 seconds). The actual game path must be observed.
[ROM keyboard repeat/new-key paths][rom-keyboard].

Record matrix transitions and their requested/effective T-states separately
from the ROM's detection: LAST-K, FLAGS, KSTATE, REPDEL, REPPER, FRAMES and
PAUSE entry/exit. A release and re-press may interact with the ROM's five-scan
key-state aging; do not synthesize a new key by writing LAST-K or FLAGS.
Include natural expiry, a fresh press during the wait, and a key held through
entry long enough to expose repeat behavior. The source establishes why
these probes are necessary; this note does not validate the game's held-key
outcome or host keyboard repeat policy.

## ROM BEEP timing and event boundaries

The [BASIC manual chapter 19][manual-beep] defines duration in seconds and
pitch in semitones relative to middle C. For exact observations, distinguish
the [BEEP command at `0x03F8`][rom-beep] from
[BEEPER at `0x03B5`][rom-beeper]. The command parses/calculates its arguments,
uses a semitone table and a fractional-pitch approximation, converts the
frequency/duration product and loop parameter to integers, skips zero cycles,
and decrements the cycle count before entering BEEPER. Thus nominal BASIC
arguments are not exact elapsed times or exact equal-tempered frequencies.

BEEPER receives HL as a delay parameter and DE as the remaining full-cycle
count **minus one** for the BASIC command path. It begins with DI, reads
BORDCR, and toggles bit 4 by `OUT ($FE),A` at `0x03E1`. At the end it executes
EI and RET. A valid call with DE=0 still produces one complete cycle. The
initial/final paths differ from the interior loop; contention of the BORDCR
read and even-port I/O can vary with ULA phase. Record measured entry/return
and bit-4 transition times rather than infer exact sound duration from a
nominal BEEP literal. [Actual ROM instruction paths][rom-beeper].

A useful isolated check, executed against both 10.2 cores here: enter
`0x03B5` at T=0 with HL=10, DE=1, BORDCR=0, SP=`0xFF00`, a return address
of `0x8000` and interrupts not injected by the driver. The OUT instructions
start at T=189, 347, 505 and 663; the routine returns at T=731. Bit 4
alternates 1,0,1,0. These short calls finish before display contention.
The first interval is 158 T-states: 55 for OUT and the high-half bookkeeping,
16 for two NOPs plus INC B/INC C, 59 for the four DEC C/JR iterations,
then 28 for LD C/DEC B/JP/XOR. This checks a concrete ROM path without
assigning all BEEPs an average cost. It is a synthetic emulator/ROM probe,
not a measurement of the game's audio or the physical speaker.

There are several distinct timestamps in the pinned native implementation:

- The instruction trace callback receives `(pc, disassembly, t0)` **after**
  execution and **before** interrupt acceptance. `pc` and `t0` describe the
  executed instruction's start; live registers/memory describe its end.
  Reading live HL/DE at the first instruction of a hooked routine may already
  show that instruction's effects. `exec_with_cb()` is only an RST-16 output
  callback, not a general instruction hook; `exec_frame()` is an RZX
  fetch-count API, not a ULA frame renderer. [Native callback methods][c-core].
- `write_port(registers, port, value, offset)` runs before the OUT instruction
  advances the stored clock. For `OUT (n),A`, `registers[T]` is instruction
  start and `offset` is `12 + contention_delay`; for `OUT (C),r` it is
  `13 + contention_delay`. Consequently `T + offset` is **one T-state beyond
  instruction completion**, an implementation convention used for border
  rendering. For the isolated ROM probe those values are 201, 359, 517, 675;
  instruction completion is 200, 358, 516, 674. Do not silently label the
  offset-based values physical speaker-latch edges. [Native OUT handlers][c-core].
- SkoolKit's own `Tracer._write_port()` uses the offset for its border log,
  but its speaker `audio_log` uses unadjusted instruction-start T. These are
  different contracts. A custom trace should name its chosen one and retain
  enough information to reconstruct the others. [Pinned `trace.py`][trace].
- The native IN callback receives registers and port without a bus-sample
  offset; the stored T is still instruction start. Applying keyboard events
  in instruction callbacks therefore quantizes input to instruction
  boundaries. Log the effective boundary as well as the requested time,
  and exclude sub-instruction keyboard sampling from accuracy claims.
  [Native `in_a()`/`in_c()`][c-core].

Host oscillator startup, audio buffering, browser scheduling, display refresh,
keyboard delivery latency and speaker acoustics are outside this emulator
clock. They need separate adapter measurements if compared with wall time.

## Small independent clock vectors

These expected numbers were calculated from Zilog's elementary instruction
cycles and the selected contention/pulse schedule above, without importing
SkoolKit's delay tables or using its test expectations. They then passed on
both native CCMIOSimulator and Python CMIOSimulator 10.2. Agreement between
cores is an implementation cross-check, not an independent hardware oracle.

| Setup                                                     | Expected elapsed T-states |
| --------------------------------------------------------- | ------------------------- |
| NOP at PC=`0x8000`, any tested phase, interrupts disabled | 4                         |
| NOP at PC=`0x4000`, T=14334                               | 4                         |
| NOP at PC=`0x4000`, T=14335..14342 respectively           | 10,9,8,7,6,5,4,4          |
| NOP at PC=`0x4000`, T=14559 / 57244 / 57245               | 10 / 5 / 4                |
| `OUT (n),A` at PC=`0x8000`, T=14328, port=`0x00FF`        | 11                        |
| Same, port=`0x00FE`                                       | 16                        |
| Same, port=`0x40FF`                                       | 23                        |
| Same, port=`0x40FE`                                       | 17                        |

For the I/O rows, the uncontended opcode/immediate cycles cost 4+3, placing
the I/O cycle at 14335. The odd/uncontended case then costs 4; the
even/uncontended-high case costs `1+5+3=9`; the odd/contended-high case
costs `6+1+0+1+6+1+0+1=16`; the even/contended-high case costs
`6+1+0+3=10`. This makes incorrect low-byte-only port classification visible.

For interrupt vectors below, use PC=`0x8000`, SP=`0xFF00`, I=`0xFE`, upper-RAM
stack, NOPs unless stated, and an IM 2 vector at `0xFEFF..0xFF00` containing
`0x9000`. Inspect immediately after instruction execution/acceptance, without
running the interrupt handler:

| Initial state                     | Expected result                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| T=69886, IFF=1, IM=1, NOP         | T=69903, PC=`0x0038`, SP=`0xFEFE`, IFF=0; stack return=`0x8001`                              |
| T=27, IFF=1, IM=1, NOP            | T=44, PC=`0x0038`: boundary at phase 31 accepts                                              |
| T=28, IFF=1, IM=1, NOP            | T=32, PC=`0x8001`, SP unchanged, IFF=1: phase 32 misses                                      |
| T=0, IFF=0, IM=1, NOP             | T=4, PC=`0x8001`, no acceptance                                                              |
| T=69884, IFF=0, IM=1, EI then NOP | EI ends at 69888 with no acceptance; following NOP then entry ends at 69905, return=`0x8002` |
| T=69886, IFF=1, IM=2, NOP         | T=69909, PC=`0x9000`, SP=`0xFEFE`, IFF=0                                                     |

The following standalone command reproduces these checks without originals,
new repo source files or a hand-built environment. Both cores are required;
it fails instead of silently substituting an uncontended simulator.

```sh
uv run --with skoolkit==10.2 python - <<'PY'
from skoolkit import CCMIOSimulator, VERSION
from skoolkit.cmiosimulator import CMIOSimulator

assert VERSION == '10.2' and CCMIOSimulator is not None

def make(cls, pc, t, code=(0,), **state):
    memory = [0] * 65536
    memory[pc:pc + len(code)] = code
    return cls(memory, {'PC': pc, 'SP': 0xFF00, 'I': 0xFE},
               {'tstates': t, **state},
               {'frame_duration': 69888, 'int_active': 32})

def step_with_interrupt(s):
    # Explicit driver contract; run() alone differs between the two APIs.
    pc = s.registers[24]
    s.run()
    if s.registers[26] and s.registers[25] % 69888 < 32:
        s.accept_interrupt(s.registers, s.memory, pc)

for cls in (CCMIOSimulator, CMIOSimulator):
    for t, expected in [(14334, 4), *zip(range(14335, 14343),
                        (10, 9, 8, 7, 6, 5, 4, 4)),
                        (14559, 10), (57244, 5), (57245, 4)]:
        for pc, dt in ((0x4000, expected), (0x8000, 4)):
            s = make(cls, pc, t)
            s.run()
            assert s.registers[25] == t + dt, (cls, pc, t)
    for port, dt in ((0x00FF, 11), (0x00FE, 16),
                     (0x40FF, 23), (0x40FE, 17)):
        # Check both immediate OUT and immediate IN timing.
        for opcode in (0xD3, 0xDB):
            s = make(cls, 0x8000, 14328, (opcode, port & 255))
            s.registers[0] = port >> 8
            s.run()
            assert s.registers[25] == 14328 + dt, (cls, port)
    for t, iff, im, code, end_t, end_pc, accepted in (
        (69886, 1, 1, (0,), 69903, 0x38, True),
        (27, 1, 1, (0,), 44, 0x38, True),
        (28, 1, 1, (0,), 32, 0x8001, False),
        (0, 0, 1, (0,), 4, 0x8001, False),
        (69884, 0, 1, (0xFB, 0), 69905, 0x38, True),
        (69886, 1, 2, (0,), 69909, 0x9000, True),
    ):
        s = make(cls, 0x8000, t, code, iff=iff, im=im)
        s.memory[0xFEFF:0xFF01] = (0, 0x90)
        for i in range(len(code)):
            step_with_interrupt(s)
            if len(code) == 2 and i == 0:
                assert (s.registers[25], s.registers[24]) == (69888, 0x8001)
        assert (s.registers[25], s.registers[24]) == (end_t, end_pc)
        assert s.registers[12] == (0xFEFE if accepted else 0xFF00)
        assert s.registers[26] == (0 if accepted else iff)
        if accepted:
            assert list(s.memory[0xFEFE:0xFF00]) == [len(code), 0x80]
    print(cls.__name__ + ': clock vectors passed')
PY
```

## What these checks do not validate

They check configuration, a simple contended fetch, all four port classes,
frame wrapping, interrupt-window boundaries, EI delay and IM 1/2 entry.
They do not verify all opcodes, HALT address-edge cases, IR/internal-cycle
contention, CPU silicon quirks, the exact hardware interrupt sampling edge,
or a physical machine's ULA phase. SkoolKit's own
[`test_cmiosimulator.py`][upstream-tests] has broader implementation tests;
those were inspected, not run as part of this research, and are not a second
hardware reference.

The bundled ROM SHA-256 was freshly verified as
`d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`.
The fresh-game BASIC hash documented by the existing
[pitch capture](pitch-rendering.md#original-capture) is
`5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6`;
it was not revalidated against local originals for this note. A capture must
also hash its actual input snapshot/tape and ROM, identify whether game state
was patched, and retain the starting PC/registers, snapshot T-state phase,
keyboard/ULA-output state and declared FLASH phase. A BASIC hash alone does
not identify the full starting machine state.

Deterministic replay comparisons should require exact integer T-state and
state equality under the same model and starting state. For instruction-boundary
sampling, retain the actual lateness relative to each requested frame/input
time; do not invent a fixed universal one-instruction tolerance, since costs
vary with instruction, branch, contention and interrupt entry. Hardware and
host comparisons need their own measured alignment and tolerance. No such
hardware/host tolerance, full-game timing capture, ULA-accurate video trace,
or gameplay fixture is validated by this sources note.

[logic]: https://drive.google.com/file/d/1SYWzc0BIpEyp86akh36WBN2OqO2sbteB/view
[field]: https://drive.google.com/file/d/1EvZflIfW57Yusa_6O7tgy13vky_Hfa0q/view
[service]: https://spectrumforeveryone.com/wp-content/uploads/2017/08/ZX-Spectrum-Service-Manual.pdf
[z80]: https://map.grauw.nl/resources/cpu/z80.pdf
[rom-map]: https://skoolkit.ca/disassemblies/rom/hex/maps/all.html
[rom-int]: https://skoolkit.ca/disassemblies/rom/hex/asm/0038.html
[rom-pause]: https://skoolkit.ca/disassemblies/rom/asm/7994.html
[rom-keyboard]: https://skoolkit.ca/disassemblies/rom/hex/asm/02BF.html
[rom-beep]: https://skoolkit.ca/disassemblies/rom/hex/asm/03F8.html
[rom-beeper]: https://skoolkit.ca/disassemblies/rom/hex/asm/03B5.html
[manual-pause]: https://worldofspectrum.org/ZXBasicManual/zxmanchap18.html
[manual-colour]: https://worldofspectrum.org/ZXBasicManual/zxmanchap16.html
[manual-beep]: https://worldofspectrum.org/ZXBasicManual/zxmanchap19.html
[c-core]: https://github.com/skoolkid/skoolkit/blob/34b8612244f318e89c701615741de107e3548b88/c/csimulator.c
[py-core]: https://github.com/skoolkid/skoolkit/blob/34b8612244f318e89c701615741de107e3548b88/skoolkit/cmiosimulator.py
[simutils]: https://github.com/skoolkid/skoolkit/blob/34b8612244f318e89c701615741de107e3548b88/skoolkit/simutils.py
[trace]: https://github.com/skoolkid/skoolkit/blob/34b8612244f318e89c701615741de107e3548b88/skoolkit/trace.py
[screen]: https://github.com/skoolkid/skoolkit/blob/34b8612244f318e89c701615741de107e3548b88/skoolkit/screen.py
[upstream-tests]: https://github.com/skoolkid/skoolkit/blob/34b8612244f318e89c701615741de107e3548b88/tests/test_cmiosimulator.py
[sdist]: https://files.pythonhosted.org/packages/74/fb/99b8c29c8e913d9144306841db9d0a78d16c18c9bdabcdf414adf436369f/skoolkit-10.2.tar.gz
