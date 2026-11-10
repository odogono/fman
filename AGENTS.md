# AGENTS.md

## Code map

- `web/src/sim`: the headless, deterministic simulation (no DOM, seeded RNG only)
- `web/src/view`: rendering and input
- `tools/`: repo tooling (`tools/commits/`: commit and changelog checks)

Run the app with `bun run dev`; build it with `bun run build`. Reviews apply `CODING_STANDARDS.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `odogono/fman` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Commits and the changelog

PR titles follow Conventional Commits. `feat`, `fix`, `perf` and breaking changes add a changelog fragment under `changelog/unreleased/`. Before writing a PR title or releasing, read `docs/agents/commits.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Tooling

Bun is the runtime, package manager, bundler, dev server and test runner; don't add Vite or another bundler. `bun install` turns on the git hooks. Run `bun run check` before a PR.

`roms/` is gitignored; never commit anything from it.
