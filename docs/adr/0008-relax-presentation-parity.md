# Relax presentation parity; keep rules parity

Proving exact parity with the original is no longer a priority, so the recreation now treats the two kinds of parity differently.

Rules parity stays a requirement. The original ruleset must give the same game state, numbers and random draws as the Spectrum game for the same answers, including the original's rule bugs. ADR-0003 and ADR-0007 still hold, as do the rules, RNG and arithmetic fixtures and the gameplay baseline. Without rules parity there would be nothing to measure experimental rulesets against.

Presentation parity is now best effort. The screens, input editing, sound and timing already built stay in place, and their fixtures remain as regression tests. A change may deliberately update or retire one of those fixtures, as long as its PR says so. No new presentation behaviour has to be proved against the original. That includes whole-screen pixel checks, the Spectrum line editor, the screen shown after saving, and timed original-versus-web runs over multiple seasons.

Reachable BASIC faults count as presentation. The game refuses input the original would stop on, and the game state stays unchanged. Stops that are already reproduced remain.

This replaces the completion gate in ADR-0004 (phase-one fidelity boundary). That boundary is now met, so phase two can start. It also relaxes ADR-0001's rule that fidelity comes before enhancement: that rule now covers the rules only.

The alternative was to finish the timed reference runs in #34. They would have taken a large share of the remaining effort and blocked mobile play, while proving details that players would not notice.
