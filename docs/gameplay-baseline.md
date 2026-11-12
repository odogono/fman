# Gameplay baseline

[#57](https://github.com/odogono/fman/issues/57). The baseline shows how the game plays across many automated runs, so a rule change can be measured against it. It is a statistical profile, not an exact-replay check; the fidelity fixtures already do that. Rule changes are built as experimental rulesets beside `original` ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)), then join the [Enhanced rules](enhanced-rules.md) as a new version ([ADR 0009](adr/0009-enhanced-rules-by-default.md)). Each Enhanced version has its own baseline, such as [baseline/enhanced-1.md](baseline/enhanced-1.md), compared against the version before it with `bun run baseline:compare`. Retired experimental rulesets keep theirs, such as [baseline/even-difficulty.md](baseline/even-difficulty.md).

The committed reference is [baseline/original.md](baseline/original.md), with the per-run values in `baseline/original.json`. It covers all seven levels, so `compare` has every cell for a ruleset's baseline.

## Running

```sh
bun run baseline                       # levels 1–7 × 6 strategies × 200 runs
bun run baseline --out docs/baseline   # refresh the committed reference
bun run baseline --levels 7 --strategies passive,balanced --runs 50
bun run baseline:compare docs/baseline/original.json build/baseline/original.json
```

Options: `--ruleset`, `--levels` (default all seven), `--strategies` (`all` or a comma list), `--runs`, `--seasons` (the season limit, default 10), `--seed` (harness seed, default 1), `--out` (default `build/baseline`) and `--workers` (default: every core). Raw runs always go to `build/baseline/<ruleset>-runs.jsonl`, which is gitignored.

The default grid takes about 2½ minutes on 10 cores, and a 10-season run costs about 0.25 s of CPU. For a quick check before a full run, `--runs 50` takes about 40 seconds. On the same rules, its intervals are about 1.5× wider: roughly ±2 points of league win rate and ±0.3 league places. `--levels 1,3,5,7` takes about 1½ minutes; the in-between levels matter when a change touches opponent strength or its 1–20 clamp, so a ruleset's baseline uses all seven.

Most of a run's time goes on building each match's highlights at kick-off, then on the bots' own decisions and on reading the view. Stepping through frames costs little, because a pause is advanced 50 frames at a time.

The output is deterministic. The same seed, options and code give byte-identical files, whatever the worker count. A PR that changes play under the `original` ruleset therefore changes `baseline/original.json` too, and refreshes it on purpose.

## What a run is

A run (`tools/bots/run.ts`) plays the headless session from `createSession`, starting at the title screen. It uses the same calls the browser makes: `setKey` for each key down and up, `submit` for each answer, and `advance` for elapsed frames. It does not call rule functions directly. This means fixture order, bills, cup replays, season ends, dismissal and every frame-based reseed happen just as they do in real play.

Every run picks club 1 and, where the game asks, black kit at the chosen difficulty level. It ends at dismissal or once the season limit is reached. A bot gives only offered answers. If the game rejects an answer (an error message, a selection error, or no change at all) or play stops moving, the run throws.

**Timing.** The game's luck comes from when the manager answers (ADR 0003), so every bot uses the same timing model, drawn from the run's own seed:

- Before each answer it waits 50–300 frames (1–6 s), then presses Enter for 3–8 frames while submitting. A real Enter press sets the ROM's pending-key flag (ADR 0006).
- During each timed wait (title, timed messages, highlights, cup celebration), it has a 50% chance of pressing Space 1–150 frames in, held for 3–8 frames. That can end a PAUSE early.
- While a pause runs, it checks every 50 frames. After a pause ends, play can therefore idle up to 49 frames before think time starts.

Bots never choose frames to get outcomes they want, as `winningCampaign()` in the sim tests does.

Run _i_ uses the same seed in every level × strategy cell. Cells therefore share their timing draws and differ only by what is being compared. A strategy's own coin-flips come from a separate stream derived from the same seed.

## Strategies

Strategies are defined in `tools/bots/strategies.ts`. None of them changes the difficulty level.

| Strategy   | Team                                                                                  | Money                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| random     | A random walk through team and selection answers                                      | Uniform among the menu answers `s`, `a`, `l`, `p` and `99`, with random amounts, sales, replies and bids                                                                                               |
| passive    | The 11 available players with the most energy                                         | Never buys, sells or borrows                                                                                                                                                                           |
| balanced   | The 11 available players with the highest skill × energy                              | Keeps four weeks of bills in hand. Bids a player's value for skill ≥ 3 out of the surplus, sells its weakest reserve above 14 players, repays debt with the rest. Never borrows                        |
| aggressive | The available team with the highest total team strength                               | Borrows to the credit limit. Bids twice the value, up to three times, for any player of skill ≥ 3. Never sells                                                                                         |
| recovering | As aggressive                                                                         | As aggressive while within the credit limit. Over it, as after a relegation, it stops buying, repays from its cash and sells its weakest reserves (down to eleven players) until back within the limit |
| rotating   | As balanced, but rests players at energy 8 or below while enough others are available | As balanced, but sells reserves only above eighteen players                                                                                                                                            |

Total team strength is the sum of the five attributes the original compares, each clamped to 1–20. Morale is the same for every choice, so it is left out. The issue had Balanced borrowing "only to avoid dismissal". A loan can't do that: dismissal is judged on debt, and a loan adds to it. So Balanced never borrows.

## Metrics

Each run records its end, its peak debt, its final cash, debt and division, and league W/D/L and goals. For each completed season it records division, position, points, W/D/L, goals, cup round reached and cup win, cash, debt, morale before the season's settlement, and whether the club was promoted or relegated.

It also counts new injuries and short-handed matches. A new injury is an owned player becoming injured, whether from the pre-match draw or from turning down a sale offer; a player who stays injured through another draw is not counted again. A short-handed match is a league match or cup leg, replays included, played with fewer than 11 picked.

The summary reduces each run to these numbers: dismissed, seasons completed, best and final division, promotions, relegations, mean league position, league win rate, goals for and against per league match, cup wins, peak debt, final cash minus debt, injuries per season (new injuries divided by seasons completed) and short-handed matches (their share of all matches played). Rates and counts show the mean over runs. The others show the median and interquartile range.

Under `original`, each owned player who isn't already injured has a 1-in-20 chance of injury before every match, so a 12-player squad starts at about 0.6 new injuries a week. Passive, which keeps its 12 players, measures about 0.55 a week, since a player already injured can't be injured again; squads that buy more players see more injuries a season.

`compare` matches cells by level and strategy. For each metric, it bootstraps a 95% interval for the change in the mean (2,000 resamples, seeded). It flags only changes whose interval excludes zero. With 15 metrics in 42 cells, 630 comparisons, about 32 false flags at 95% are expected even with no real change. Treat an isolated flag as a lead, not a result.

Recovering was added for #74 to measure a grace period before dismissal: aggressive never sells or repays, so a grace period can help it only if gate money happens to clear its debt. Recovering shows what the rule offers a manager who acts on it. Adding it added rows to every baseline and left the existing ones unchanged.

Rotating was added for #98 to measure lasting injuries: balanced sells down to fourteen players and picks by skill × energy, so it keeps playing tired stars and has few players to cover injuries. Rotating shows what the rule offers a manager who keeps a deeper squad and rests tired players. It was added to the rulesets in play (`original` and every Enhanced version); retired rulesets' baselines keep the strategies they were measured with. Adding it left the existing rows unchanged.

## Findings worth knowing

- Aggressive's dismissals mostly follow a relegation: it borrows to its division's credit limit, and relegation lowers the limit beneath its debt. Under `enhanced-1`, 44 of 44 dismissals at level 3 and 54 of 56 at level 5 came straight after one (#74).
- The difficulty level just adds its value (1–7) to each of an opponent's five strength attributes (`web/src/sim/league.ts`, `web/src/sim/cup.ts`). The manager's choices are the same at every level.
- Borrowing never prevents dismissal, and interest is 1% of the debt per week. Aggressive at Genius is dismissed in every run.
- Win rate, league position and goals change evenly with level, but Aggressive's dismissal rate rises steeply between levels 3 and 6 (about 30%, 44%, 87%, 99%), and Balanced stops winning promotion between 3 and 5. Above level 5 every strategy's median finish is the bottom division.
