# Define the original-experience completion boundary

Phase one retains the original gameplay, observable quirks/errors, desktop
keyboard behaviour, screen presentation, sound and pacing required by ADR-0001,
within the TypeScript rebuild chosen in ADR-0002. Browser file save/load and
browser printing are accepted host adaptations; original TAP/TZX interoperability
and a general BASIC command console are separate deferred investigations, while
game-reachable faults and the visible post-save continuation remain in scope.

Completion requires a fixed set of timed original-versus-web reference runs
comparing visible screen frames, sound events, game state and RNG, including an
uninterrupted multi-season run. Permitted differences must be explicit: stable
screenshots or similar-looking average pacing alone cannot establish completion,
particularly because frame/input timing affects reseeding (ADR-0003).
