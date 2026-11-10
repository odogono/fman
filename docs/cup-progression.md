# Complete cup progression

Cup rounds two through eight now follow the existing league/cup schedule. Each round draws from the original eight-slot band, `(8-round)*8+R(8)`, rejecting the managed club. The five opponent attributes retain the original fractional club-index adjustment and clamping, then the ground draw follows. Replays keep the opponent and strengths and swap grounds; player refresh runs again.

The seventh round is labelled `Semi-Final`, the eighth `Final`. Every semifinal leg earns £50000 and every final leg £100000, overriding both ordinary home-gate and away-host receipts. Earlier rounds keep their existing receipt rules. A deciding loss ends the cup; winning the final also ends it. Cup results retain both original morale adjustments and bill once per decided tie.

## Final and season boundary

The final is scheduled after league match fifteen. Reaching fifteen league matches therefore does not stop an active cup campaign before its final. Once the final is decided, [season progression](season-progression.md) now follows bills, covering bonuses, promotion/relegation and reset. The reset match count skips that cycle's transfer market. Elimination earlier in the cup still allows the remaining league fixtures before that boundary.

Victory shows the source's ten-row trophy, two-row title and nine star rows. The nine rising `.2`-second beeps take ninety explicit 50Hz frames and cannot be skipped by a key. Afterwards the winning screen waits for continuation. Title/star flash uses the explicit frame clock; redraws retain partially typed input. The browser still uses the documented redrawn font and nominal oscillator pitches; exact pixel and interpreter-cycle equality remains unverified.

## Original-runtime evidence

`web/src/sim/fixtures/later-cups.json` contains 35 unforced ties across rounds two through eight and seeds 0, 1, 42, 219 and 65535, comprising 49 legs. The adapter starts from the verified fresh menu and patches only the round, schedule counter, league-match count and SEED. These are controlled round-entry states with the fresh team, not naturally reached campaign saves.

Two additional final scenarios explicitly patch the first leg's score at the end of highlights: one victory and one draw. Their four legs verify final completion and replay continuation separately from natural score generation. The forced score is recorded in the fixture; highlight RNG and carried positions are still compared, and subsequent replay scores are unforced. A native winning-screen capture remains under ignored `roms/` for visual analysis.

Tests compare draws, grounds, attributes, receipts, preparation RNG, all player energy/status, strengths, unforced scores, highlight RNG/carried positions, final finances, morale and cup/schedule flags. Earlier first-cup and league fixtures remain regression checks. A complete session test selects winning entry seeds through explicit frame timing and makes legal team changes, reaching the final after all fifteen league matches. This is a controlled integration test, not an original-emulator campaign trace.

```sh
bun tools/zx/capture-later-cups.ts roms/zx/analysis/24-fresh-menu.z80
bunx prettier --ignore-path /dev/null build/zx/later-cups.json > build/zx/formatted-later-cups.json
cmp build/zx/formatted-later-cups.json web/src/sim/fixtures/later-cups.json
bun test web/src/sim/later-cups.test.ts web/src/sim/campaign.test.ts web/src/view/cup-victory.test.ts
```

The optional adapter uses SkoolKit 10.2, validates the original BASIC hash before patching state and exports numeric observations only. Originals and native screenshots remain ignored. Browser verification uses a controlled preview driven by the real session and renderer; earlier match playback is advanced by explicit frames to reach the new winner screen.

## Remaining scope

[Season changes](season-progression.md) are now implemented. [Dismissal and reloading](dismissal-restart.md) are now implemented. [Name editing](name-editing.md) is now implemented. Saving remains unavailable. Result/billing calculation still uses the documented atomic bills boundary; existing browser input, timing and rendering limits remain.
