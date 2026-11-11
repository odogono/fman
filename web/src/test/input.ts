import { beeperT } from '../sim/beeper';
import { spectrumFrameT } from '../sim/frame-clock';
import type { Journal } from '../sim/journal';
import type { Session } from '../sim/session';

/** Advances past the prompt's beep, if it is still sounding. */
export const finishPrompt = (target: Session | Journal) => {
  const session = 'session' in target ? target.session : target;
  const sound = session.sounds.find(
    event => event.id.endsWith(':prompt') && event.startT <= session.soundTimeT
  );
  if (sound && session.view.paused) {
    target.advance(
      Math.ceil(
        (sound.startT +
          beeperT(sound.hl, sound.de, sound.phaseT) -
          session.soundTimeT) /
          spectrumFrameT
      )
    );
  }
};

/** Existing gameplay tests type only once the ROM prompt has finished beeping. */
export const submitInput = (target: Session | Journal, text: string) => {
  finishPrompt(target);
  const effect = target.submit(text);
  finishPrompt(target);
  return effect;
};
