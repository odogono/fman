# Season progression

When fifteen league matches have been played and the cup campaign has finished, continuing from bills now runs BASIC 8100–8699 and the 8800 reset: end-of-season notice, final table, then a combined bonus/movements/new-season page. Continuing returns to management without a transfer offer because the league-match count has reset to zero.

## Bonus, movements and rating

The league bonus is `(17-finalRank)*5000*(5-oldDivision)`. It is credited before moving clubs, so promotion does not retrospectively change the rate. The rating accumulator adds `17-finalRank+cupRound*2*oldDivision`; completed seasons increases by one. Status displays `min(100,INT(total/seasons)*2)`, preserving the truncation before doubling.

The source visits the sixteen old division slots in their existing slot order. Ranks one through three swap with the next division's bottom slots when promotion is possible. Ranks fourteen through sixteen swap with the lower division's top slots when relegation is possible. The targets follow the source's rank-indexed formulas, including their reversed ordering. Division 1 announces its champion, and Division 4 has no relegation. Club names and colour attributes move together; the managed club's slot and division follow its swap.

## Reset rules

The new division determines home gate and future rent. The league table clears, league-match count and cup round become zero, the cup-finished flag clears, morale becomes ten, and the schedule starts at one with the next league fixture at home.

All twenty-four player slots get new skill, value and energy in source RNG order. Ownership, picked/reserve status and injuries are preserved. In particular, the first new-season league fixture still skips refresh under the original `ml=1 AND c=0` exception; it does not silently heal an injured player. Names, cash after the bonus, debt, manager details, carried highlight positions and the previous net-funds baseline also persist. The next week's balance therefore includes the season bonus. Returning to management reseeds from the explicit frame clock as before.

The model applies bonus, swaps and reset together when continuing from the final table, matching the verified new-season prompt boundary. Earlier screens retain the old table until then.

## Original-runtime evidence

`web/src/sim/fixtures/seasons.json` contains 100 controlled transitions from all four divisions, final ranks 1, 3, 8, 14 and 16, and seeds 0, 1, 42, 219 and 65535. The optional SkoolKit adapter starts from the verified saved-game bills checkpoint and patches division/club, final ranks/display order, league/cup completion and rating history. It includes an injured owned player. These are synthetic season-entry profiles, not claimed naturally played campaign saves.

Tests compare all sixty-four club identities after swaps, managed slot/division, cash/debt and baseline, rating total/season count/displayed rating, all player statuses/skills/values/energy, carried positions, reset league/schedule/cup flags and RNG state. Each case also captures the following opening fixture and team summary with an explicitly controlled menu seed, checking opponent selection after club movement, home ground, receipts, strengths and the skipped refresh.

```sh
bun tools/zx/capture-seasons.ts roms/zx/analysis/10-bills.z80
bunx prettier --ignore-path /dev/null build/zx/seasons.json > build/zx/formatted-seasons.json
cmp build/zx/formatted-seasons.json web/src/sim/fixtures/seasons.json
bun test web/src/sim/season-reference.test.ts web/src/sim/season.test.ts web/src/sim/campaign.test.ts
```

The adapter checks the checkpoint's runtime BASIC hash before patching and records the reset seed before the next frame-based reseed. Numeric observations are committed; originals and checkpoints remain ignored. Session tests cover both cup victory and early elimination through the transition and into the next season. Controlled browser previews use the real session and renderer, advancing earlier match playback by explicit frames.

## Remaining scope

Dismissal, name editing and saving remain unavailable. A club exceeding the debt cap still stops before the unimplemented dismissal routine, without receiving a season bonus. Existing browser line-editing, prompt-sound, interpreter pacing and ROM-pixel rendering limits remain.
