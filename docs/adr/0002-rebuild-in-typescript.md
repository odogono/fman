# Rebuild in TypeScript with the original as a reference

Recreate the game in TypeScript, using the original running in an emulator as a behavioural reference. Embedding an emulator would provide a more direct route to reproducing the original, but rebuilding makes the planned later enhancements practical and fits the repository's separation of deterministic simulation from rendering and input.

The first milestone is analysis before gameplay implementation: extract an annotated BASIC listing and document game flow, rules, formulas, data, randomness, presentation and machine-code dependencies, recording uncertainties explicitly.
