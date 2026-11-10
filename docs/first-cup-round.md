# First cup round and replays

The next scheduled fixture after the opening league match is the first F.A. Cup round. This increment extends the [transfer market](transfer-market.md): finish buying or declining, then type `99` at management. The sequence follows BASIC 4000–4720, 5200–5299 and 6000–6100.

The fresh schedule counter starts at one, becomes two for the opening league match, then wraps to zero for the cup. Round one draws an opponent from club slots 57–64, rejecting the managed club. Opponent attributes retain the original fractional club-index expression before truncation and clamping. The home/away draw follows the five attribute draws.

## Player refresh and highlights

Unlike the first league match, cup preparation refreshes all twenty-four pool players. Reserves and injured players gain ten energy; picked players lose one. Energy is clamped to 1–20. Injured players first recover to reserve status, then every pool slot consumes an injury draw, including unowned players. Only owned players can become injured. Each replay performs this refresh again.

The strength summary always lists the managed club first, while fixtures, highlights and scores use home/away order. Kit colours follow the ground. The attacker and defender positions persist across matches as well as attacks; resetting these arrays at a new fixture changes original outcomes. They now live in headless game state.

## Replays, morale and money

A draw shows `Replay-`, swaps grounds and keeps the same opponent and opponent strength. It does not advance the schedule or cup round. Each leg credits its own receipts: the home gate at home, or `(5-hostDivision)*10000` away. There is no replay limit in the application.

A deciding win applies the original morale increase twice; elimination halves and clamps morale twice. Cup elimination is retained in game state. The tie leaves league goals, points and ranks unchanged. Weekly wages, rent and interest are charged once after the deciding leg, then the transfer market opens. Shared billing arithmetic preserves the earlier league-cycle reference checks.

Completion is still atomic in the headless model: on continuing from a deciding score, the result and bills are calculated together, then cup status and bills are displayed in source order. The verified final boundary is the bills prompt, not each intermediate BASIC statement.

## Evidence and reproduction

`web/src/sim/fixtures/first-cups.json` contains five controlled original-runtime ties, with cup-entry seeds 0, 1, 42, 219 and 65535. All start after the same seed-zero opening league match, default team and declined transfer offer. Three required a replay, for eight legs total; the sample includes advancement and elimination.

Tests compare opponent/home draws, attributes, receipts, preparation seeds, all player statuses and energy, strengths, scores, final highlight seeds and carried positions, then final cash/debt, morale, cup/schedule state and billing baseline. These are whole-leg observations, supplementing the earlier per-step highlight traces. Session and screen tests cover the replay continuation, ground swap and managed-club-first summary.

```sh
bun tools/zx/capture-cup.ts roms/zx/analysis/24-fresh-menu.z80
bunx prettier --ignore-path /dev/null build/zx/first-cups.json > build/zx/formatted-first-cups.json
cmp build/zx/formatted-first-cups.json web/src/sim/fixtures/first-cups.json
bun test web/src/sim/cup.test.ts web/src/sim/session.test.ts web/src/view/cup.test.ts
```

The optional SkoolKit 10.2 adapter verifies the fresh BASIC hash and state, plays the first match and declines the transfer, then explicitly sets the cup seed. It captures each leg at BASIC statement boundaries. Its twenty-leg diagnostic bound protects research runs; it is not an application rule. Originals, listings and snapshots remain ignored under `roms/`.

## Remaining scope

The [league continuation](league-progression.md) adds further league fixtures, and [complete cup progression](cup-progression.md) now adds rounds two through eight and the victory display. Season changes, dismissal, name editing and saving remain unavailable. The final is playable after league match fifteen; once the cup campaign ends, season progression stops at bills. Existing [presentation limits](first-league-match.md#presentation-limits) remain.
