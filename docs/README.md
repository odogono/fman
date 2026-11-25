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
- [clearances.md](clearances.md): defenders intercepting or blocking a chance and clearing it, as a moment of its own (Enhanced version 8)
- [match-injuries.md](match-injuries.md): injuries happen in the match, as a moment of the highlights, instead of before team selection (Enhanced version 9)
- [plain-names.md](plain-names.md): new names can't carry control codes beyond a club's colour, so no print fault can stop the game (Enhanced version 10, [ADR-0014](adr/0014-enhanced-rules-drop-print-faults.md))
- [penalties.md](penalties.md): either side can win a penalty for a foul in the box, scored as often as any chance (Enhanced version 11)
- [club-form.md](club-form.md): other clubs in the division have form from their last three league results, shown in Modern mode's table (Enhanced version 12)
- [squad-strength.md](squad-strength.md): an opponent's defence, midfield and attack come mostly from its squad, and other clubs' results lean towards the stronger squad (Enhanced version 13)
- [even-table.md](even-table.md): the other clubs' points spread no wider than before form and squad strength, and Genius eases a little, so promotion takes about as many points as it did (Enhanced version 14)
- [natural-positions.md](natural-positions.md): a picked player can play out of position, in goal or another line, counting less the further from his position (Enhanced version 15)
- [sprite-highlights.md](sprite-highlights.md): Modern mode shows moments as clips on a top-down pitch with tiny sprites ([ADR-0013](adr/0013-clips-set-their-own-length.md))

Gameplay baseline: [gameplay-baseline.md](gameplay-baseline.md): automated runs by strategy and difficulty level, and how to compare rulesets against [the original's baseline](baseline/original.md).

Phase-two design: [mobile-play.md](mobile-play.md): touch and mobile play; [full-time-screen.md](full-time-screen.md): Modern mode's final score.

Exploration:

- [multiplayer.md](multiplayer.md): what a server-based multiplayer version could take, a proposed format, and prior art.
- [highlights-engine.md](highlights-engine.md): a new event-based highlights engine for the Enhanced rules, and the top-down sprite view chosen from mockups.

Which parity is required: [ADR-0008](adr/0008-relax-presentation-parity.md) keeps rules parity and makes presentation parity best effort.

Decisions: [adr/](adr/). Agent workflows: [agents/](agents/).
