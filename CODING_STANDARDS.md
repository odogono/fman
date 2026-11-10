# Coding standards

Read at review. Lint, Prettier and `tsc` enforce the mechanical rules (`bun run check`); these are the judgement calls they cannot.

- **The sim stays headless and deterministic.** `web/src/sim` imports nothing from `web/src/view` or the DOM, and draws randomness only from the seeded RNG (`web/src/sim/rng.ts`). A view-only choice, such as a message wording, may use `Math.random`.
- **Use the glossary's terms** (`GLOSSARY.md`) in names, comments and messages, not their _Avoid_ synonyms.
- **Saves are versioned.** Once saves exist, a change to what they store bumps the save version.
- **New behaviour comes with a test** in the sim when it is sim behaviour; the view is tested where it holds logic, such as hit-testing or timing.
- **Docs track closed gaps.** A PR that implements something a README or `docs/` note calls missing ("not yet", "remain to be", "still to establish") updates or removes that note, and a new feature doc is added to `docs/README.md`.
