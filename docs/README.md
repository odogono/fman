# Docs

Start with [original-game-analysis.md](original-game-analysis.md): it maps the original BASIC's line ranges to game rules and variables. The rest record how each feature matches the original, and how its fixtures were captured.

- [spectrum-compatibility.md](spectrum-compatibility.md): Spectrum arithmetic and randomness
- [spectrum-timing.md](spectrum-timing.md): contention-aware clock, timed inputs, frame and sound traces
- [spectrum-timing-sources.md](spectrum-timing-sources.md): timing sources, independent verification and limits
- [frame-clock-and-reseeding.md](frame-clock-and-reseeding.md): exact frame cadence, timed reseed boundaries and browser scheduling policy
- [fresh-game-management.md](fresh-game-management.md): setup, club management, view timing
- [beeper-playback.md](beeper-playback.md): measured prompt/editor, highlight and cup sounds; audio-clock scheduling
- [highlight-pacing.md](highlight-pacing.md): measured execution-path timing, progressive drawing, PAUSE and save compatibility
- [pitch-rendering.md](pitch-rendering.md): pitch and pre-outcome sprite pixel verification
- [glyph-raster-fidelity.md](glyph-raster-fidelity.md): original printable/block glyph pixels, raster text and asset provenance
- [first-league-match.md](first-league-match.md): fixtures, highlights, match scoring, results, bills
- [transfer-market.md](transfer-market.md): buying players
- [first-cup-round.md](first-cup-round.md): first cup tie and replays
- [league-progression.md](league-progression.md): later league fixtures
- [cup-progression.md](cup-progression.md): all eight cup rounds
- [season-progression.md](season-progression.md): promotion, relegation, new season
- [dismissal-restart.md](dismissal-restart.md): debt-cap dismissal, NEW, reloading
- [name-editing.md](name-editing.md): club and player names
- [name-print-fidelity.md](name-print-fidelity.md): embedded name controls, graphics and PRINT reports
- [name-layout-fidelity.md](name-layout-fidelity.md): name scrolling and wrapping
- [save-load.md](save-load.md): web save files

Rulesets ([ADR-0007](adr/0007-experimental-rules-as-rulesets.md), [ADR-0009](adr/0009-enhanced-rules-by-default.md), [ADR-0011](adr/0011-rulesets-carry-starting-clubs-and-players.md), [ADR-0012](adr/0012-every-club-owns-a-squad-of-invented-players.md)):

- [enhanced-rules.md](enhanced-rules.md): choosing Original or Enhanced rules, and Enhanced versions
- [even-difficulty.md](even-difficulty.md): a gentler step between difficulty levels (Enhanced version 1)
- [grace-period.md](grace-period.md): weeks to clear a debt over the credit limit before dismissal (Enhanced version 2)
- [present-day-clubs.md](present-day-clubs.md): 2026/27 clubs and players in their own colours (Enhanced version 3)
- [lasting-skill.md](lasting-skill.md): owned players keep their skill between seasons, with skill drift (Enhanced version 4)
- [steep-difficulty.md](steep-difficulty.md): a steeper difficulty curve for lasting skill (Enhanced version 4)
- [tiring-injuries.md](tiring-injuries.md): tired players are likelier to be injured, for up to three weeks (Enhanced version 5)
- [club-squads.md](club-squads.md): every club owns a squad of invented players, with transfers from free agents (Enhanced version 6)
- [moment-highlights.md](moment-highlights.md): a match decided as a list of goals, saves and near misses, shown as a ticker in place of the pitch (Enhanced version 7)

Gameplay baseline: [gameplay-baseline.md](gameplay-baseline.md): automated runs by strategy and difficulty level, and how to compare rulesets against [the original's baseline](baseline/original.md).

Phase-two design: [mobile-play.md](mobile-play.md): touch and mobile play.

Exploration:

- [multiplayer.md](multiplayer.md): what a server-based multiplayer version could take, a proposed format, and prior art.
- [highlights-engine.md](highlights-engine.md): a new event-based highlights engine for the Enhanced rules, and the top-down sprite view chosen from mockups.

Which parity is required: [ADR-0008](adr/0008-relax-presentation-parity.md) keeps rules parity and makes presentation parity best effort.

Decisions: [adr/](adr/). Agent workflows: [agents/](agents/).
