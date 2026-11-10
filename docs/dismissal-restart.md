# Dismissal, NEW and explicit reloading

Weekly billing now follows BASIC 8036–8060 through dismissal. Wages, rent and truncated loan interest reduce cash; a shortfall becomes extra debt and cash becomes zero. The weekly-balance baseline is recorded before that conversion. The screen retains the original `LOAN INCREASED TO PAY BILLS` message.

Dismissal is strictly `debt > 250000*(5-division)`. Being exactly at the limit is allowed, and positive cash does not cancel an over-limit debt. The check happens before the ordinary bills continuation, transfers or season bonus. The dismissal page includes the bill amounts, credit-limit text and original wrapped banner; `h/H` still requests a copy.

## What NEW does

Acknowledging the banner executes the original `NEW` branch. The native captures show an empty BASIC program and variable table, SEED reset to zero, FRAMES restarted, and a blank 24-row screen with `© 1982 Sinclair Research Ltd` on the last row. It does not automatically return to Football Manager's title.

The web session therefore enters a stopped `cleared` phase, resets the frame clock and discards every game, fixture, highlight, offer, bill and season reference. Game commands are ignored there. The browser renders all 24 rows and hides the game input.

An explicit **Load game again** button appears outside the reproduced screen. This browser adapter restores the bundled game's title and setup after `NEW`, analogous to loading the program again. Reloading is allowed only in the cleared phase, starts the fresh RNG setup from zero and preserves elapsed idle frames for the following frame-based menu reseed. It does not restore the old manager or club. General Spectrum BASIC console commands remain outside scope.

## Original-runtime evidence

`web/src/sim/fixtures/dismissal.json` contains 24 controlled billing profiles: all four divisions, debts just below/at/above the cap, and cash values yielding a £1 shortfall, zero or £1 surplus. They include dismissal caused solely by the overdraft. Tests compare amounts, weekly balance/baseline, RNG, dismissal outcome, all bill/banner text rows, and the cleared idle screen.

The optional SkoolKit 10.2 adapter starts at the verified saved-game bills checkpoint. Its research driver redirects the next `GO SUB 8100` call to `GO SUB 8000` and patches financial inputs. The billing/dismissal routine remains unchanged. After the observed prompt, it checks whether acknowledgement erased the program and variables. These are synthetic billing states, not naturally played campaign traces.

```sh
bun tools/zx/capture-dismissal.ts roms/zx/analysis/10-bills.z80
bunx prettier --ignore-path /dev/null build/zx/dismissal.json > build/zx/formatted-dismissal.json
cmp build/zx/formatted-dismissal.json web/src/sim/fixtures/dismissal.json
bun test web/src/sim/dismissal.test.ts web/src/view/dismissal.test.ts web/src/sim/session.test.ts
```

Session tests also reach dismissal through actual borrowing, signing and match commands, then verify clearing and a fresh reload. Controlled browser verification uses the production view code with a real session advanced to dismissal; the earlier match playback is advanced through explicit frames. The acknowledgement and reload controls then run normally.

## Remaining scope

Name editing and saving remain unavailable. Existing font, browser line-editor, prompt-sound and interpreter-pacing limits remain. The web clear is immediate and does not reproduce the ROM's RAM-clearing execution cost; no JavaScript or application asset is erased from the browser.
