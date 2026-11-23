---
status: accepted
---

# The 3D ground replaces the 2D painter

Modern mode's sprite highlights are drawn by the 3D painter of ADR-0017 alone, and the 2D painter is deleted. Where WebGL won't start, Modern mode plays the highlights as it does under reduced motion: the ticker without clips, at the original's 75 frames a moment (ADR-0013). The camera looks at the ground from one fixed tilt, behind the bottom goal, that only the painter knows: a clip is the same whatever draws it, and nothing in a clip directs the tilt.

## Considered Options

- **Keep the 2D painter as a frozen fallback for when WebGL won't start.** Free to keep at first, but it would draw every club's ground the same and fall further behind the 3D ground with each change, for the very few browsers without WebGL.
- **Keep both painters, chosen in a setting.** Every change to the grounds would be made twice.

## Consequences

A browser without WebGL shows no clips and no cup celebration; its matches run at the reduced-motion pace, which ADR-0013 already allows. If WebGL is lost during a match, the painter tries to get it back; failing that, the pitch stays blank while the ticker plays on, since the clips' lengths were handed to the match at kick-off. The clip debugger draws with the 3D painter, so it no longer compares two painters.
