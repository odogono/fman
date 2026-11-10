# Spectrum compatibility foundation

The first implementation increment provides headless numeric operations, the original random generator and explicit frame state. It supports the [original-game analysis](original-game-analysis.md) and [ADR-0003](adr/0003-preserve-spectrum-randomness-and-arithmetic.md). The [fresh-game management slice](fresh-game-management.md) now uses this foundation; the [first league-match flow](first-league-match.md) now adds verified highlights and results. League/cup/season progression is now implemented; see the [feature index](README.md) and [remaining fidelity work](remaining-work.md).

## Numeric values

`web/src/sim/numeric.ts` represents a value as its five Spectrum bytes. This preserves the distinction between the small-integer and floating-point encodings, which can take different ROM paths even for equal mathematical values. Operations return new tuples and leave inputs unchanged.

- `fromNumber` quantizes a finite JavaScript number into the format, preferring small integers where possible. It is **not** the BASIC decimal parser. Load original constants from their extracted bytes; do not parse the readable listing and assume equivalent rounding.
- `toNumber` decodes the stored representation for observation and display. Arithmetic must use the module's operations so each intermediate step follows Spectrum precision.
- `add`, `subtract`, `multiply`, `divide` and `floor` reproduce the tested calculator paths, including small-integer shortcuts, signed addend alignment and division's missing rounding bit. Multiplication and division use `BigInt` for exact mantissa work.
- Division by zero and numerical overflow throw `RangeError('Arithmetic overflow')`. Underflow follows the captured minimum-number cases. BASIC error presentation belongs to the later interpreter/game boundary.

For example, the ROM computes `1/10` as `0.09999999997671694`, rather than rounding to the nearest available Spectrum number. An integer addition producing −65,536 can instead return malformed bytes `00 FF 00 00 00`. Subsequent operations do not treat those bytes consistently: multiplication/division as a dividend produce zero, while `INT` produces floating-point −1. The reference cases deliberately retain these behaviours. See the annotated ROM routines for [addition](https://skoolkit.ca/disassemblies/rom/hex/asm/3014.html), [multiplication and normalization](https://skoolkit.ca/disassemblies/rom/hex/asm/30CA.html) and [division](https://skoolkit.ca/disassemblies/rom/hex/asm/31AF.html).

The tuple type assumes valid byte values imported through a trusted decoder or created by these functions. It is not a validator for untrusted web saves. Other calculator functions, decimal/string conversion, trigonometry and arbitrary malformed-number behaviour are not implemented or claimed as verified.

## Random and frame state

`createRng(seed)` now restores a raw unsigned 16-bit Spectrum seed, including zero. `next()` advances `((seed+1)*75 % 65537)-1` and returns the new seed divided by 65536. Read `rng.seed` to capture the current state. Restoring seed zero does not read a clock.

`rng.randomize(argument, frames)` implements the command after its argument has already been converted to an unsigned 16-bit integer. A nonzero argument becomes the seed; zero uses the low 16 bits of the supplied 24-bit FRAMES counter. The BASIC argument parser and its fractional/negative-input conversion are outside this API. See the ROM's [RND](https://skoolkit.ca/disassemblies/rom/asm/9720.html) and [RANDOMIZE](https://skoolkit.ca/disassemblies/rom/asm/7759.html) routines.

`rng.int(min, max)` consumes exactly one draw and returns an inclusive integer. It accepts safe integer bounds spanning at most 65,536 values; in that domain, multiplying the 16-bit random fraction requires at most 32 significant bits and is exact in host arithmetic. The original game's `FN r(n)` corresponds to `rng.int(1, n)`.

`createFrameClock(frames)` restores a 24-bit counter; `.advance(elapsed)` increments it modulo 2²⁴ using an explicit nonnegative safe-integer frame count. `.frames` exposes the current counter. No simulation code reads wall-clock time. Counter wrapping is checked against the ROM [interrupt routine](https://skoolkit.ca/disassemblies/rom/asm/56.html).

This is a deterministic counter, **not** a cycle-accurate BASIC scheduler. Later work must determine the frame cost of game operations, keyboard waits, sound and pauses before timed input can reproduce complete original sessions. Advancing once per host rendering callback would not establish original pacing.

## Reference evidence and reproduction

`web/src/sim/fixtures/spectrum-rom.json` contains generated numeric observations, not ROM/game code or extracted listings. It records SkoolKit 10.2 and the bundled 48K ROM SHA-256 `d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`.

The optional Bun tool `tools/zx/capture-compatibility.ts` uses `uv` to run that ROM in SkoolKit. It executes calculator instructions on explicit byte operands, calls the RND implementation, and observes the RANDOMIZE command and frame-counter increment. Execution has an instruction limit and unexpected ROM hashes are rejected. No original game files are required.

```sh
bun tools/zx/capture-compatibility.ts
bunx prettier --ignore-path /dev/null build/zx/compatibility.json > build/zx/formatted-compatibility.json
cmp build/zx/formatted-compatibility.json web/src/sim/fixtures/spectrum-rom.json
bun test web/src/sim
```

The committed reference contains 99 arithmetic observations, five eight-draw RNG sequences, a SHA-256 fingerprint of the next seed for every possible seed, five FRAMES transitions and fifteen RANDOMIZE cases. Tests compare arithmetic bytes, verify the exhaustive RNG fingerprint, check its full period, and exercise state restoration and invalid arguments.

A separate deterministic sample of 2,000 operand pairs was also compared live: all 8,099 captured arithmetic cases matched. The inputs sampled signed values in the management-money range and small fractional divisors; this does not prove every possible floating-point input. To generate that larger evidence set without expanding the committed fixture:

```sh
bun tools/zx/capture-compatibility.ts build/zx/sampled-compatibility.json 2000
FMAN_ROM_REFERENCE=build/zx/sampled-compatibility.json bun test web/src/sim/numeric.test.ts
```

The optional final argument adds that many operand pairs, sampled with Python's fixed seed 1982. CI uses the committed observations and needs neither Python nor SkoolKit. Full gameplay parity and cycle-accurate pacing remain future acceptance gates.
