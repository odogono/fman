# Feature loop

How each fidelity feature lands, one PR per feature:

1. Find the behaviour in `roms/zx/analysis/listing.bas`, using the line map in `docs/original-game-analysis.md`. Setup: `tools/zx/README.md`.
2. Capture the original's behaviour with a `tools/zx/capture-*.ts` tool, and commit the formatted output as a fixture in `web/src/sim/fixtures/`.
3. Make the sim reproduce the fixture, test first (`web/src/sim/*.test.ts`), then wire the view.
4. Write or update the feature's doc in `docs/`, add it to `docs/README.md`, and remove every "not yet" note the feature closes.
5. `bun run check`, then a changelog fragment and PR title per `docs/agents/commits.md`.
