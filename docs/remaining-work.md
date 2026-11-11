# Remaining original-experience work

The live backlog is [phase-one fidelity tracker #23](https://github.com/odogono/fman/issues/23).
GitHub issues are the source of truth for status, acceptance criteria and native
blocking dependencies; this page is the entry point, not a second task tracker.

The [completion boundary](adr/0004-define-phase-one-fidelity-boundary.md) accepts
browser web-save files and browser printing as host adaptations. Original
gameplay, observable quirks/errors, desktop input, screen behaviour, sound and
pacing remain in scope. Completion requires fixed timed original-versus-web
reference runs comparing visible frames, sound events, state and RNG, including
an uninterrupted multi-season run, with permitted differences stated explicitly.

## Required phase-one work

| Work                                                                | Issue                                            | Blocked by                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture contention-aware timing and timed reference inputs          | [#24](https://github.com/odogono/fman/issues/24) | —                                                                                                                                                                                                                                                                                                          |
| Match the Spectrum frame clock and frame-based reseeding            | [#25](https://github.com/odogono/fman/issues/25) | [#24](https://github.com/odogono/fman/issues/24)                                                                                                                                                                                                                                                           |
| Reproduce measured highlights and timed-screen pacing               | [#26](https://github.com/odogono/fman/issues/26) | [#24](https://github.com/odogono/fman/issues/24), [#25](https://github.com/odogono/fman/issues/25)                                                                                                                                                                                                         |
| Establish original glyph raster fidelity for text and graphics      | [#28](https://github.com/odogono/fman/issues/28) | —                                                                                                                                                                                                                                                                                                          |
| Reproduce the Spectrum line editor and lower input screen           | [#29](https://github.com/odogono/fman/issues/29) | [#25](https://github.com/odogono/fman/issues/25), [#28](https://github.com/odogono/fman/issues/28)                                                                                                                                                                                                         |
| Reproduce reachable name control codes and graphics PRINT behaviour | [#30](https://github.com/odogono/fman/issues/30) | [#28](https://github.com/odogono/fman/issues/28), [#25](https://github.com/odogono/fman/issues/25)                                                                                                                                                                                                         |
| Preserve original long-input numeric parsing and reachable faults   | [#31](https://github.com/odogono/fman/issues/31) | —                                                                                                                                                                                                                                                                                                          |
| Verify and reproduce the original post-save continuation screen     | [#32](https://github.com/odogono/fman/issues/32) | —                                                                                                                                                                                                                                                                                                          |
| Complete full-screen pixel verification for uncovered game screens  | [#33](https://github.com/odogono/fman/issues/33) | [#28](https://github.com/odogono/fman/issues/28), [#29](https://github.com/odogono/fman/issues/29), [#30](https://github.com/odogono/fman/issues/30), [#32](https://github.com/odogono/fman/issues/32)                                                                                                     |
| Verify timed original-experience parity through multiple seasons    | [#34](https://github.com/odogono/fman/issues/34) | [#25](https://github.com/odogono/fman/issues/25), [#26](https://github.com/odogono/fman/issues/26), [#27](https://github.com/odogono/fman/issues/27), [#29](https://github.com/odogono/fman/issues/29), [#31](https://github.com/odogono/fman/issues/31), [#33](https://github.com/odogono/fman/issues/33) |

Start with the timing reference (#24). Glyph work (#28), numeric input/fault
research (#31) and post-save presentation (#32) can also start independently.
Required tickets are labelled `ready-for-agent`; an agent should start one only
when its native blockers are closed and it is unassigned. The issues were filed unassigned; consult GitHub for their current status.
Creating the backlog does not start their implementation.

Architecture issues [#16](https://github.com/odogono/fman/issues/16) and
[#17](https://github.com/odogono/fman/issues/17) are already closed and must not
be refiled. The remaining proposals
[#18](https://github.com/odogono/fman/issues/18),
[#19](https://github.com/odogono/fman/issues/19) and
[#20](https://github.com/odogono/fman/issues/20) remain independent, rather than
blanket prerequisites for fidelity work.

## Explicitly deferred

- [#35: Original tape-save interoperability](https://github.com/odogono/fman/issues/35).
- [#36: General BASIC command recovery](https://github.com/odogono/fman/issues/36).

These are standalone investigations labelled `needs-triage`, not required
sub-issues or blockers of phase one. Intentional gameplay enhancements, touch
controls and responsive modernisation remain in the later enhancement phase
under ADR-0001.

## Already established

The [contention-aware reference capture](spectrum-timing.md) supplies the pinned
clock model, timed keyboard inputs and original frame/sound/state observations
for #25–#27. It does not establish web timing parity or beam-exact ULA video.

[Frame cadence and reseeding](frame-clock-and-reseeding.md) now have exact
19.968 ms browser sampling, input-dispatch sampling and timed original
boundary comparisons. [Measured highlight/timed-screen pacing](highlight-pacing.md)
adds execution-path budgets, progressive drawing, PAUSE keyboard state and
BEEPER interrupt losses within declared corpus tolerances. [Measured beeper playback](beeper-playback.md) adds prompt/input clicks, exact
speaker-edge calculations and audio-clock scheduling through delayed frames and
shortened pauses. Complete session timing remains outside these bounded comparisons.

[Glyph raster verification](glyph-raster-fidelity.md) establishes the printable
and block repertoire, ordinary cell colours/inverse/brightness and captured
highlight overlay cells. The [name PRINT capture](name-print-fidelity.md) adds
bounded controls, tokens, runtime UDGs and malformed-sequence reports. Full-screen
and editor parity remain separate requirements; the PRINT doc records its
pagination limit.

Management, league/cup/season progression, dismissal/NEW, name editing, web
saving/loading, captured name scrolling/wrapping and pitch/pre-outcome sprite
pixels have implementation and emulator-backed evidence. See the [feature
index](README.md). New conformance testing may reveal interactions needing fixes,
but the old analysis handoff is not a list of features still to implement.
