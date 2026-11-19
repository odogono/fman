# Modern mode drops the prompt beep

The original sounds a short beep as each prompt appears and takes no input until it ends. That suits Classic mode's typed answers, but Modern mode's screens are tapped, and a beep that holds every tap for a moment just feels like lag. So Modern mode drops it entirely: no sound and no hold. As with clip lengths (ADR-0013), the sim never learns the presentation mode. The view tells it whether to sound prompt beeps, the journal records each change, and saves replay it. Beeps stay on unless the view turns them off.

## Considered Options

- **Mute the beep in Modern mode but keep the hold.** The sim would be untouched, but Modern mode would ignore taps for a moment with nothing on screen to say why.
- **The sim learns the presentation mode.** Mode would then reach into the rules, and every mode is meant to drive the same game.
- **Drop the beep in both modes.** Classic mode reproduces the original's sound and timing, so it keeps the beep.

## Consequences

The beep stops the Spectrum's frame count while it plays, and that count seeds the next reseed. So a Classic game and a Modern game with the same answers can draw differently, as ADR-0013 already allows. Switching mode affects the prompts that come after the switch; a beep already playing ends as it would have. The match's beeps, the cup celebration's beeps and input clicks stay in both modes.
