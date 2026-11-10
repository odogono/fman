# Original game analysis

The supplied snapshot contains 706 recoverable BASIC lines and a playable saved game. A comparison with an archived original-release tape found **all 33,142 BASIC bytes identical**. The tape supplies fresh arrays and scalar values as saved BASIC variables, explaining why initialization is absent from the listing. Both continued play and fresh-game setup have now been exercised in an emulator. The filename’s “Players” label remains unexplained, but no BASIC-program variant was found in this comparison.

The agreed target is a faithful TypeScript recreation before enhancements: [experience](adr/0001-preserve-original-experience.md), [implementation approach](adr/0002-rebuild-in-typescript.md), [randomness and arithmetic](adr/0003-preserve-spectrum-randomness-and-arithmetic.md). This report is the first milestone's analysis and implementation handoff; no gameplay has been implemented.

## Reproduce the extraction and observations

From the repository root, provide the original locally and run:

```sh
bun tools/zx/extract.ts 'roms/zx/Football Manager - Players (1982)(Addictive Games).z80'
bun tools/zx/observe.ts 'roms/zx/Football Manager - Players (1982)(Addictive Games).z80'
```

The worktree initially had no originals. This investigation read the file from the main checkout's `roms/zx` directory using an absolute input path; neither command requires copying or modifying it. Both tools write under gitignored `roms/zx/analysis/` by default. Run `bun install` for repository checks; the optional observer also requires `uv` and obtains pinned `skoolkit==10.2` in an isolated environment. The observer is a Bun entry point driving SkoolKit's Python CPU/ROM emulator, not an application dependency.

Extraction produces `ram.bin` (48K, address origin 16384), `listing.bas`, `basic.json` and `metadata.json`. The JSON preserves every BASIC line's address and raw bytes, plus each embedded number's address, five bytes and decoded value. The text listing expands tokens and names display controls; it is an analysis rendering, not directly loadable BASIC. Original files and full extracted listings remain untracked under `roms/`.

The decoder deliberately supports only v1 48K Z80 snapshots. Unsupported extended snapshots, malformed runs, incorrect RAM lengths and invalid BASIC boundaries are rejected. Synthetic tests cover compressed data, a literal ED byte, malformed input, Spectrum numeric representations, quoted bytes, display-control parameters and visible/stored number disagreement without requiring the original.

## Input and integrity

| Evidence                  | Value                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| Input                     | `Football Manager - Players (1982)(Addictive Games).z80`           |
| Input bytes               | 36,902                                                             |
| Input SHA-256             | `e774842966587779cbdabc94b234f0c80c681c09585b10f3dcebdeeb30395976` |
| Format                    | Compressed v1 Z80 snapshot, 48K RAM                                |
| CPU PC                    | 56 (`0x0038`, ROM interrupt handler)                               |
| RAM SHA-256               | `c3801493dd040f82f3d2fd3221f61e0251e33fa0081981ae9fdd7c416bf6a4d2` |
| PROG / VARS               | 23755 / 56897; 33,142 program bytes                                |
| Recovered source          | 706 increasing lines, numbered 8–9599                              |
| Embedded numeric payloads | 1,840                                                              |
| Saved BASIC position      | Line 2180, statement 2: main-menu input                            |
| Saved RNG seed            | 219                                                                |
| RAMTOP / UDG              | 65367 / 65368                                                      |

SkoolKit independently decoded all 49,152 RAM bytes identically and recovered the same sequence of 706 line numbers. A separate numeric audit found no visible decimal literals differing materially from their stored numeric values (relative/absolute tolerance `1e-8`); this is not a proof of identical decimal rounding. Preserve stored numbers regardless.

The `.z80` is a machine snapshot rather than a tape or ROM image; its header does not establish the original tape's loader or edition. The [snapshot-format reference](https://worldofspectrum.org/faq/reference/z80format.htm) describes the v1 header and compression. The [Spectrum manual's memory chapter](https://worldofspectrum.org/ZXBasicManual/zxmanchap24.html) and [system-variable table](https://worldofspectrum.org/ZXBasicManual/zxmanchap25.html) ground the addresses used here.

## Snapshot identity and tape-provided initialization

The source opens with the Football Manager title and K. J. Toms 1982 credit (line 8), and includes original team/player DATA (9030, 9230–9260). Saved variables instead contain manager `THE BOSS`, club `Denny Utd.`, Division 3, skill level 1, one completed season, cash £107,392, debt £40,000, 14 owned players and 11 picked. Club names and slots differ from the DATA, consistent with name editing and promotion/relegation during play. This establishes a saved session, not how or by whom the file was produced.

There are no `DIM`, `CLEAR` or `RUN` tokens in the recovered executable BASIC. Setup at 9000 immediately assigns indexed player-name entries, so it relies on already allocated arrays. A normal BASIC `RUN` clears variables; the recovered listing alone therefore cannot constitute a complete fresh-start program. Missing initial cash, debt, rating accumulators and initial array construction must not be inferred from the saved values. A restart failure has not been dynamically verified; tape loading, rather than issuing `RUN`, is the verified fresh-start path.

The [World of Spectrum archive entry](https://worldofspectrum.net/item/0001823/) identifies `FootballManager.tzx.zip` as an original release. Its downloaded `Football Manager.tzx` has SHA-256 `7fb5e9d4b8115bd4835ce9f1479ed498f05b52f2c435f40f089403ccadc72763`. It contains a BASIC header with auto-start line 8 and a 35,557-byte program/variables payload. The 33,142-byte BASIC portion exactly matches the supplied snapshot, SHA-256 `5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6`. The remaining 2,415 bytes carry initial variables and their terminator, not additional executable BASIC.

The tape supplies blank string arrays, zeroed numeric arrays and scalars including cash £100,000, debt 0, completed seasons 0, displayed rating 0, previous balance baseline 0 and cumulative managerial score 0. This closes the fresh-initialization gap without borrowing defaults from the saved session. It also explains why simply exporting the BASIC text would lose part of the original program's effective starting state.

The subsequently identified local `roms/zx/Football Manager.tzx` in the main checkout is 35,628 bytes and **byte-for-byte identical to the entire archived TZX**, with the same SHA-256 above. Its BASIC and complete initial-variable payload also match. Use this supplied tape as the primary fresh-game input; the archive is corroborating provenance, and no download is needed when the local tape is available. It is a clean starting copy compared with the progressed `.z80`, rather than a different BASIC revision. The fresh-setup observations below apply to this identical file.

**Reference assessment:** use the supplied snapshot for continued-play fixtures and the hash-identified tape for fresh-state evidence. The archive attribution is not proof of every historical release, but byte equality establishes that this saved session has the same recovered BASIC as the compared tape. No claim is made about other releases or the filename label.

To reproduce fresh setup using the supplied tape, run the following from a checkout containing it, or pass its absolute path from this worktree:

```sh
uv run --with skoolkit==10.2 tap2sna.py 'roms/zx/Football Manager.tzx' roms/zx/analysis/local-original.z80
bun tools/zx/observe.ts roms/zx/analysis/local-original.z80 roms/zx/analysis fresh
```

To reproduce the independent archive comparison, download the linked archive into gitignored `roms/zx/analysis/`, extract its `Football Manager.tzx` as `archived-original.tzx`, verify the hash above, then run:

```sh
uv run --with skoolkit==10.2 tapinfo.py roms/zx/analysis/archived-original.tzx
uv run --with skoolkit==10.2 tapinfo.py -b 3 roms/zx/analysis/archived-original.tzx
uv run --with skoolkit==10.2 tap2sna.py roms/zx/analysis/archived-original.tzx roms/zx/analysis/archived-original.z80
uv run --with skoolkit==10.2 snapinfo.py -v roms/zx/analysis/archived-original.z80
bun tools/zx/observe.ts roms/zx/analysis/archived-original.z80 roms/zx/analysis fresh
```

The tape payload comparison used SkoolKit's `parse_tzx`: block 3 data excluding its flag/checksum begins with the exact BASIC bytes at snapshot RAM addresses 23755–56896. The fresh observer independently checks that BASIC hash before driving setup.

## Annotated routine map

All 706 recovered lines fall within the following ranges. References throughout this document are original BASIC line numbers, not file offsets. `basic.json` supplies addresses and byte evidence for each line.

| Lines     | Responsibility and important calls                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------- |
| 8–10      | Title, manager name (maximum 20 characters), DATA setup (9000) and team selection (8900)                |
| 98–99     | Player-category helper and inclusive random integer helper                                              |
| 100–199   | Reseed; management menu; save branch or fixture; bills; season transition; transfer offer; repeat       |
| 260–269   | Read 120 sprite bytes from DATA and write 15 UDG characters                                             |
| 270–281   | Two mirrored goalkeeper movement routines                                                               |
| 290–295   | Goal banner, random beeps and score display                                                             |
| 300–379   | Attack towards the left: pitch, player placement, dribble, ball collisions, goalkeeper, goal test       |
| 400–479   | Mirrored attack towards the right, with its own coordinates and goal test                               |
| 800–810   | BASIC tape save with resume at 100; continue or `NEW`                                                   |
| 1000–1189 | Money/status rows, prompts, numeric input, picked/owned counts, attribute clamps, player/score displays |
| 2000–2299 | Main-menu commands and computed exit branch                                                             |
| 2400–2555 | Squad listing, sale offer, acceptance/refusal, player-row rendering                                     |
| 2800–2840 | Borrow within division-dependent credit limit                                                           |
| 2900–2945 | Repay debt within cash and outstanding debt                                                             |
| 3000–3040 | Club, manager, rating, level, finances, morale and league-progress screen                               |
| 3200–3260 | Change difficulty level (1–7)                                                                           |
| 4000–4029 | Advance schedule counter and select cup/league fixture                                                  |
| 4100–4380 | Opponent and strengths; venue; selection; highlights; receipts; cup replay; results; morale             |
| 4499–4530 | Fixture return and cup-round label                                                                      |
| 4600–4720 | Cup and league gate-receipt calculation                                                                 |
| 5000–5110 | Generate highlight opportunities and derive final score from animated attacks                           |
| 5200–5299 | Cup elimination/progression, trophy display and morale                                                  |
| 6000–6499 | Energy recovery/fatigue, injuries, squad selection and continue                                         |
| 6500–6640 | Aggregate picked players into the five team-strength attributes                                         |
| 7000–7099 | Update the user's league fixture, points and future home gate                                           |
| 7500–7705 | Pair other clubs, generate seven results and update their records                                       |
| 7710–7850 | Sort and display the league table; store rankings                                                       |
| 8000–8099 | Wage/rent/interest bill, overdraft-to-debt conversion and dismissal                                     |
| 8100–8499 | Season eligibility, success bonus, rating accumulation, promotion/relegation, new season                |
| 8500–8579 | Promote top three via club-name swaps; announce champions in Division 1                                 |
| 8600–8699 | Relegate bottom three via club-name swaps, except in Division 4                                         |
| 8700–8788 | Choose unowned player, bid, raise asking price or complete purchase                                     |
| 8800–8890 | Reset league/cup state, regenerate all player skills/values/energy, set rent and gate                   |
| 8900–8999 | Choose club, move it to Division 4, choose difficulty/colours, pick initial squad                       |
| 9000–9299 | Player and team DATA; labels, difficulty names and status glyphs                                        |
| 9400–9499 | Team-name editor, including embedded colour handling                                                    |
| 9500–9599 | Player-name editor                                                                                      |

No numeric `USR` calls or explicit game machine-code entry points were found. The sole executable `USR` is `USR "a"` at 266, which obtains the UDG address for sprite writes; it does not call game machine code. The only `POKE` writes those graphics bytes. There are no executable `PEEK`, `IN`, `OUT` or `LOAD` tokens. Z80 disassembly of the entire RAM would mostly misinterpret BASIC and data; any further machine-code work should target the ROM services on which compatibility depends. This does not establish that an absent tape loader contained no additional routines.

## State and terminology

BASIC permits a scalar, numeric array and string array with the same letter; these are separate values. Do not merge them when translating.

| Original state                     | Meaning                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `t$(64,12)`                        | Club names with fixed-width padding and embedded colour bytes                                        |
| `p$(24,8)`                         | Player names; slots 1–8 defence, 9–16 midfield, 17–24 attack                                         |
| `p(24)`                            | Status: 0 unowned, 1 available reserve, 2 picked, 3 injured                                          |
| `r(24)`, `y(24)`, `v(24)`          | Skill, energy and asking/player value                                                                |
| `a(5)`, `u(5)`                     | User/opponent Energy, Morale, Defence, Midfield, Attack                                              |
| `z(17)`, `b(16)`, `c(16)`, `t(16)` | Points, goals for, goals against and ranks/temporary pairing flags; `z(17)=-1` sentinel              |
| `u$(16)`                           | League-table order as one-byte club indexes                                                          |
| `s(2)`, `x(2)`                     | Home/away scores and home/away club indexes                                                          |
| `m`, `l`, `xp`                     | Cash, debt and previous net-cash baseline for displayed weekly balance                               |
| `d1`, `d2`, `lt`, `t1`             | Division, financial multiplier `5-d1`, division offset `(d1-1)*16`, managed club index               |
| `l1`, `tco`                        | Difficulty (1–7), user kit colour (black 0 or white 7)                                               |
| `ml`, `ma`, `lc`, `c`, `fa`        | League matches played, schedule counter, fixture type (1 cup/2 league), cup round, cup finished flag |
| `g`, `x`, `h1`                     | Future home gate, ground rent and preceding league venue                                             |
| `s`, `s1`, `s5`                    | Accumulated managerial score, displayed rating and completed seasons                                 |
| `f(3,2)`, `g(3,2)`, `d(4)`, `k(3)` | Highlight attackers/defenders, ball position/direction and goalkeeper                                |

## Rules and formulas recovered from source

These are static-source findings unless marked as observed below. `R(n)` means original `FN r(n) = INT(RND*n+1)`; `clamp` means the 1–20 clamp at 1040–1043. Preserve original expression evaluation and random-draw order.

### Setup, progression and opponents

- Four divisions of 16 clubs, a 24-player pool and seven difficulty levels. Team selection browses all clubs, then swaps the chosen name into slot 64 and starts in Division 4 (8900–8953). Twelve distinct pool slots are chosen: eleven picked, one reserve (8970–8987). Starting finances are provided by tape variables: £100,000 cash and no debt.
- Season reset computes `d2=5-d1`, clears the current division's results, sets morale to 10, home gate to `5000*d2`, rent to `500*d2`, schedule counter to 1 and previous league venue to away (8800–8890). Every player's skill is regenerated as `R(5)`, value as `5000*d2*skill`, and energy as `R(20)`. Owned/picked/injured statuses persist through this routine.
- Each management cycle advances `ma`; every third counter event is a cup fixture while still in the cup. The first fixture after reset is league. After elimination all fixtures are league (4000–4010).
- League schedule visits each of the other 15 division slots once, substituting slot 16 when the sequential opponent would be the managed club (4121–4130). It is not a 30-game home-and-away season. League venue alternates, starting at home.
- Cup round increments before drawing opponent `(8-c)*8+R(8)`, retrying if it is the user's club. Round 7 is labelled Semi-Final, round 8 Final. The initial venue is random; draws replay with reversed venue until resolved (4110–4119, 4190, 4330–4338).
- Each opponent attribute is independently clamped. League: `INT(R(14)+l1+z(opponent)/ml)`. Cup: `INT(R(16)+l1+(t1-1)/16-((v1-1)/16+1))`. Retain the fractional slot arithmetic rather than replacing it casually with division numbers (4140–4160).

### Selection, energy and morale

- Except at the first league fixture before a cup round, reserves and injured players gain 10 energy, picked players lose 1, and energy is clamped to 1–20. Injured players recover to reserve status before a fresh random injury test; owned players can then become injured with probability 1/20 (6000–6100). Energy zero is not a trigger in this source.
- Team energy is `clamp(INT(sum(picked energy)/11))` regardless of how many players are picked. Defence, midfield and attack are clamped sums of skill in their eight-slot categories. Morale is retained and clamped (6500–6630).
- The selection screen offers adding when the picked count is **at most 11**; it forces removal only above 11 (6200–6330). Adding a twelfth player therefore switches to forced removal; the removal prompt does not accept `99`. A depleted team can still proceed from the summary, which has no exact-eleven check. The [first-match implementation](first-league-match.md) corrects the earlier interpretation that a newly selected twelve-player team could proceed directly.
- After any fixture, a win adds `INT((20-morale)/2)` and a loss halves morale. Cup progression or elimination applies another morale adjustment before the general result adjustment (4350–4374, 5204–5237). Drawn cup replays return to selection and can trigger recovery/injuries again.

### Highlights determine the score

For each of the five attribute pairs, test `R(100)+5*(user-opponent) >= 75`; a success runs two user attacks. Then test the reverse difference and, on success, run two opponent attacks. If the score remains 0–0 after all tests, run one attack in each direction; these attacks can score, so this is not a guaranteed goalless fallback (5000–5101).

Each attack places three attackers, three defenders, a goalkeeper and a ball using rejection sampling. Players move towards the central region while dribbling; a ball then advances through colour-attribute collision checks. Left/right routines are similar but separate, with different coordinate tests and explicit corner exclusions for a goal (300–479). A goal increments the corresponding home/away score and triggers random-length/random-pitch celebratory beeps (290–295). There is no precomputed score to decorate with animation.

`ATTR` samples the logical screen: grass normally has attribute 102 (bright yellow ink on green paper), and player-colour cells use `96+ho` or `96+aw`. Drawing, ink changes, erasing and XOR `OVER` operations influence subsequent collisions. Replacing this with ordinary geometric hit-testing or a cosmetic replay would change outcomes. The headless simulator needs an equivalent logical display/attribute model; the DOM must not become the source of match state.

### League table and season end

- League wins award 3 points, draws 1; goals update for both clubs (7000–7099). After a loss future home gate falls by `INT(g/10)`, with a £1,000 floor; after a win it rises by `INT((10000*d2-g)/10)`. Draws leave it unchanged.
- Other clubs are randomly paired without replacement. Each score is `INT(points/ml + RND*4)`; these are generated separately from the user's highlights (7500–7705).
- Table sorting uses descending points, goal difference, then goals scored. Completely tied neighbours are still swapped. Preserve the finite-pass bubble-sort behaviour and prior order, rather than using a stable alphabetical tie-break (7710–7801).
- Season ends only when `ml>=15` and the cup is finished. Let `success=17-rank`: award `success*5000*d2` and add `success+c*2*d1` to cumulative managerial score. The rating shown later is `min(100, INT(score/completedSeasons)*2)` (8100–8230, 3007–3009).
- Top three are promoted unless already in Division 1; bottom three are relegated unless in Division 4. This swaps club-name strings into adjacent division slots and updates the managed index; the other divisions do not have full simulated league tables (8500–8699). Then reset the season, including all skills/energy/values.

### Money and transfers

- Loan cap is `250000*d2`. Repayment may exceed neither debt nor cash. Numeric input accepts only digits, with empty input yielding zero; `h/H` requests a screen copy (1170–1179, 2800–2945).
- Sale offer is `INT((RND*5+8)*value/10)` and names a random club. Injured players cannot be sold. Acceptance removes ownership and adds the offer; refusing leaves the player injured on two of three `R(3)` outcomes (2480–2536).
- Buying offers a random unowned pool player, but only if there has been a league match. Sixteen owned players blocks purchases. With sufficient cash, accept if `R(10)*bid/value >= 5`; otherwise asking value increases by `INT(value+value/5)`. Success deducts the bid, makes the player a reserve and resets value to `skill*5000*d2` (8700–8788).
- League home receipts use the gate value before the result; league away receipts are `(17-opponentRank)*d2*500`. Cup home receipts use the gate, away receipts `(5-hostDivision)*10000`, overridden to £50,000 in a semi-final and £100,000 in a final. Replays earn receipts again (4600–4720, 4322–4325).
- Every outer management cycle bills `sum(owned skill)*100*d2`, rent and `INT(debt/100)` interest. Negative cash becomes extra debt and cash becomes zero; debt beyond the cap causes dismissal and `NEW`. The displayed weekly balance is `cash-debt-xp`; `xp` is then updated before overdraft conversion, a detail worth retaining (8000–8060). Cup replays finish before this one billing cycle.

## Spectrum compatibility and presentation

The [Spectrum BASIC reference](https://worldofspectrum.org/ZXBasicManual/zxmanappc.html) specifies five-byte numbers and the RND family. The seed recurrence is `next=((seed+1)*75 mod 65537)-1`, with `RND=next/65536`. This is incompatible with the mulberry32 scaffold originally present. The [compatibility foundation](spectrum-compatibility.md) now supplies the tested RNG, arithmetic subset and explicit frame state. Spectrum intermediate arithmetic, conversion/rounding, `INT`, one-based arrays, fixed-width string assignment and numeric/string `AND`/`OR` semantics also need compatibility tests. Do not translate conditional expressions into JavaScript short-circuit operators: expressions such as line 6070 and ball-direction formulas contain random draws whose evaluation matters.

Line 100 executes argumentless `RANDOMIZE` on each main-cycle entry, using the machine's FRAMES clock. Consequently, identical seed and text inputs alone are insufficient across reseeding points: parity also requires equivalent input timing/frame state. The seed saved in this snapshot is an intermediate state, not a universal new-game seed. The [manual's randomness chapter](https://worldofspectrum.org/ZXBasicManual/zxmanchap11.html) describes frame-based reseeding. The replay script fixes simulated waits and input cadence; changing them can change results.

Management uses the 32-column Spectrum display, embedded colour/inverse controls, fixed-width text and line-editor input. Commands include `a`, `s`, `l`, `p`, `level`, `change`, `keep` and `99`; accepted cases are usually explicitly lower- or uppercase, not arbitrary mixed case. Selection and transfers also use `99`. Team-name editing allows ten visible characters or twelve bytes including a colour prefix; player names allow eight. The first-character check permits codes 65–122, including punctuation between `Z` and `a` (9400–9599).

Highlights use a 256×176 graphics area, fifteen DATA-defined UDGs, a green/yellow perspective pitch and black/white opposing kits. `PRINT AT`, `PLOT`, straight/curved `DRAW`, `OVER`, attribute changes and beeper calls are behaviourally relevant. `PAUSE 200` and `300` nominally represent four and six seconds on a 50Hz machine, but newly pressed keys can end pauses early; BASIC execution and audio take additional time. See the [manual's motion chapter](https://worldofspectrum.org/ZXBasicManual/zxmanchap18.html). The observer's generous waits are not pacing measurements.

`SAVE "football" LINE 100` saves BASIC plus its variables for tape-style resume; it is not a web save schema. `COPY` is exposed through prompts. Browser equivalents and the versioned web save representation still need design when those features are implemented.

## Emulator observations

The observer uses SkoolKit 10.2's native `CSimulator`, its bundled 48K ROM (SHA-256 `d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42`), maskable interrupts and an emulated 3.5MHz clock. This core does not model memory/I/O contention; it verifies execution and state, not cycle-accurate pacing. It resumes the original registers/RAM without changing game data and sends keyboard-matrix events with a four-frame delay. See [SkoolKit's command documentation](https://skoolkit.ca/docs/skoolkit/commands.html) for the underlying simulation and snapshot utilities; the adapter uses its Python interfaces.

Each step saves screen text, variables and a Z80 checkpoint. The observer asserts that its input hash is the studied snapshot, extraction agrees with the independent decoder, queued keys have been consumed and BASIC has reached the expected input line. Screen text is recovered from ROM glyphs and is approximate: UDGs and the line-editor cursor need the actual screen image.

| Checkpoint         | Input and simulated wait | Observed outcome                                            |
| ------------------ | ------------------------ | ----------------------------------------------------------- |
| `00-menu`          | None, 30s                | Main menu at 2180                                           |
| `01-score`         | `s`, Enter; 30s          | THE BOSS, Denny Utd., season 1, £107,392 cash, £40,000 debt |
| `02-menu`          | Enter; 30s               | Return to menu                                              |
| `03-squad`         | `a`, Enter; 30s          | 14 owned, 11 picked; skills, energy and values displayed    |
| `04-menu`          | `99`, Enter; 30s         | Exit squad listing                                          |
| `05-fixture`       | `99`, Enter; 30s         | Denny Utd. home to Bradford in Division 3                   |
| `06-team`          | Enter; 30s               | User attributes 11/10/7/14/15; opponent 5/14/4/13/5         |
| `07-highlights`    | `99`, Enter; 600s        | Final score 2–1; gate receipts £10,000                      |
| `08-other-matches` | Enter; 60s               | Seven other fixtures and results                            |
| `09-table`         | Enter; 60s               | Denny Utd. fourth with 3 points, 2 goals for, 1 against     |
| `10-bills`         | Enter; 30s               | Wages £9,000, rent £1,000, interest £400                    |
| `11-transfer`      | Enter; 30s               | Cash £106,992; unowned K. Keegan offered at £40,000         |
| `12-menu`          | `99`, Enter; 30s         | Transfer declined; next management menu                     |

A second run loads the archived tape through the emulated ROM, stopping at PC 7997 after loading while the title pause is active. Fresh-mode checkpoints `20-name` through `25-fresh-score` then use 30 simulated seconds per step: wait for the name prompt, enter `alex`, select club `1` (Arsenal), level `1`, colour `0` (black), and request `s` from the menu. The observed status is Arsenal in Division 4 with £100,000 cash, £0 debt, morale 10, zero completed seasons and rating 0. These checkpoints and `fresh-observations.log` remain local under `roms/zx/analysis/`. This verifies startup from the tape’s saved variables rather than assuming a bare BASIC listing can be run independently.

Cash reconciles: `107392 + 10000 - 9000 - 1000 - 400 = 106992`. The unusually large displayed weekly balance (£69,600) is consistent with the snapshot's old `xp=-2608` and the original formula; it is not the same as cash change.

Local evidence lives in `roms/zx/analysis/observations.log`, numbered checkpoint files and `07-highlights.z80`. To render any checkpoint with the same toolkit:

```sh
uv run --with skoolkit==10.2 sna2img.py roms/zx/analysis/07-highlights.z80 roms/zx/analysis/final-score.png
```

Rendered final-score and squad images were inspected. They preserve the original colours, padding and prompts; the source's control-byte notation should not be mistaken for displayed text.

## Coverage gaps and implementation handoff

Static reading covers the complete recovered BASIC program and identifies all explicit machine-code interfaces. Dynamic coverage is fresh setup and one resumed league-cycle path, not every branch. Cup rounds/replays/final, promotion/relegation, sale acceptance/refusal, bid acceptance/refusal, loan errors, dismissal, name editing, printing and tape-save/reload have not been exercised. Highlight corner cases, the twelve-player selection quirk, tied sorting and exact numerical rounding need focused emulator probes before their ports are accepted.

Proceed in this order:

1. **Encode the verified fresh state.** Use the compared tape’s blank/zero arrays and scalar defaults, then follow its auto-start at line 8. Keep the tape provenance and byte-equality evidence alongside the fixture; do not use the progressed snapshot’s finances or club names as defaults.
2. **Establish compatibility primitives.** Implement and test the Spectrum RNG in the permitted simulation RNG module, five-byte/intermediate arithmetic as required, string/array semantics and a deterministic emulated frame clock. Keep frame timing/input events in replay fixtures; document the numeric fidelity actually established.
3. **Model the original match engine headlessly.** Preserve a logical attribute plane, relevant plotting/erasing behaviour, mirrored attack paths, random consumption and score generation. Produce display/audio events for the view. This fits the repo's headless boundary without pretending the graphics are merely decorative.
4. **Port management systems incrementally.** Start from the known saved state as a fixture, compare selection and one complete league cycle, then add transfers/loans, cup/replays, league sorting and season transitions. Add meaningful parity tests per subsystem, then reproduce the observed end-to-end cycle.
5. **Recreate the view and persistence.** Preserve desktop keyboard prompts, screen formatting, audio and waits; settle browser equivalents for COPY and tape saves and version the web save format. Verify pacing separately with a contention-aware emulator and recorded input timing.

The costly parts are numerical/timing parity and the interaction between graphics and scoring. A small conventional football simulator with a cosmetic highlight renderer would not satisfy the agreed fidelity. Later enhancements should build on an explicitly verified reference implementation.
