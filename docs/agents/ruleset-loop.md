# Ruleset loop

How a gameplay change lands, per [ADR 0007](../adr/0007-experimental-rules-as-rulesets.md) and [ADR 0009](../adr/0009-enhanced-rules-by-default.md). Two stages, in one PR or two: **measure** the change as an experimental ruleset, then **promote** it into a new Enhanced version. The process and its reasons are in [enhanced-rules.md](../enhanced-rules.md); this is the file-by-file checklist. Examples: #89 (measure `lasting-skill` alone), #88 (measure `grace-period` and promote it into `enhanced-2`).

## Measure

1. `web/src/sim/ruleset.ts`: add the name to `rulesets`, a flag to `changes` (false for every other ruleset), and an accessor such as `lastingSkill(ruleset)` with the issue number in its comment. The rule code reads the accessor, never the ruleset name.
2. The rule itself, in the sim module that owns it (`season.ts`, `management.ts`, `league.ts`, …), test first in `web/src/sim/<name>.test.ts`. Draw from the RNG as many times as the original does (`season.ts`'s skill drift draws once, as the reroll does), so every later draw matches and the baseline comparison shows the rule alone. `original`'s committed baseline must not move.
3. **Save version**, only if `Game` gains a field: bump `saveVersion` in `web/src/sim/save.ts`, accept the field in `validGame`, reject it from earlier versions in `savedGame`, and add a sentence to the version history in [save-load.md](../save-load.md). Tests compare against `saveVersion`, so they need no edit.
4. **Bots**, only if the rule adds a prompt or an answer: teach `tools/bots/strategies.ts` to answer it. A run throws on a prompt its bot cannot answer. Changing the bots changes every committed baseline, so refresh them all (step 5).
5. Baseline: `bun run baseline --ruleset <name> --out docs/baseline`, then `bun run baseline:compare docs/baseline/original.json docs/baseline/<name>.json`. A full run takes 2–3 minutes: start it with `run_in_background` and wait on its task id; try `--runs 50` (about 40 s) while tuning.
6. Docs: `docs/<name>.md` with the measured result, a line under **Rulesets** in [docs/README.md](../README.md), and any new term in `GLOSSARY.md`.
7. PR type `chore(sim)`: an experimental ruleset is not player-facing, so no changelog fragment ([commits.md](commits.md)).

## Promote

1. `ruleset.ts`: add `enhanced-<n>` with the previous version's flags plus the new one, point `latestEnhanced` at it, and remove the experimental ruleset from `rulesets` (keep its `docs/baseline/<name>.*` files). Existing versions never change.
2. `web/src/view/rules.ts`: update the Enhanced description in `rulesChoices` to name what the latest version changes.
3. Baseline `--ruleset enhanced-<n> --out docs/baseline`, compared against `enhanced-<n-1>.json`.
4. Docs: a row in the **Versions** table of [enhanced-rules.md](../enhanced-rules.md), "(Enhanced version n)" on the feature's line in [docs/README.md](../README.md), and the feature doc says which version carries it.
5. PR type `feat(sim)` with a changelog fragment ([commits.md](commits.md)).
