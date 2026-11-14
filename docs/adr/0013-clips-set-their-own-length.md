# Clips set their own length; the sim holds it

Modern mode's sprite highlights play each moment as a clip whose build-up is made up by the view, so only the view knows how long the clip runs. At kick-off the view works out every clip from that moment's own seed and hands the sim one length per moment, in frames. The sim builds the ticker's timeline from those lengths in place of its fixed 75-frame pause, and saves them with the session. The sim still doesn't know which presentation mode is on: Classic mode, and Modern mode under reduced motion, hand over nothing and keep 75 frames.

## Considered Options

- **One longer pause for every moment, in both modes.** It keeps both modes on the same frames, but cuts every clip to a fixed length and slows Classic's ticker for no reason.
- **The sim learns the presentation mode.** It would pick the pause itself, but the mode would reach into the rules, and every mode is meant to drive the same game.
- **The view says when a clip has finished**, like a keypress. Simpler to wire up, but resuming mid-clip would restart the clip, and the frames counted would depend on how fast the browser draws rather than on the clip's script.

## Consequences

The frames before the next reseed now depend on the view's clips, so a Classic and a Modern game with the same answers can draw differently after a match. That is already true of two players who press keys at different times. Saves carry the clip lengths, so changing how clips are scripted only changes matches played after the change; a match resumed mid-clip keeps the lengths it started with.
