---
status: accepted
---

# Clips take playhead controls; the match waits for the playhead

In Modern mode's sprite highlights, a tap on the pitch or any keypress used to end the clip on show, standing in for the original's keypress that ends a ticker pause (ADR-0006). Clips now take playhead controls instead: play/pause, rewind (to the clip's start, or the clip before) and next, beside Skip all. Taps on the pitch and other keys do nothing during clips. Pausing, and watching a clip again, hold the match the way the game menu already does, so the frames that seed the next reseed don't run on while the playhead is stopped or behind. Everything on screen shows the match as it stood at the playhead.

## Considered Options

- **Keep tap to skip and add the controls beside it.** A tap meant to pause or rewind could end the clip instead, and an accidental tap on a phone threw the moment away.
- **Let the match run on while paused or watching again.** Simpler, but the ticker's pause would end under the viewer, and how long someone looked at a clip would change the game.
- **Seek anywhere with a draggable bar.** Left for later: a display-only bar covers the need without seeking past moments the match hasn't reached.

## Consequences

Next and Skip all still end clips early, as a tap did, so the frame count can still differ between players, as ADR-0013 allows. The original's pitch and the ticker without clips keep taps and keys as keypresses under ADR-0006. The playhead is the view's alone and isn't saved: a resumed session plays on from where the match had got to.
