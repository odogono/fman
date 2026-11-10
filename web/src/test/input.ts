import { beeperT } from '../sim/beeper';
import { spectrumFrameT } from '../sim/frame-clock';
import type { Journal } from '../sim/journal';
import type { Session } from '../sim/session';

/** Existing gameplay tests type only once the ROM prompt has finished beeping. */
export const submitInput = (target: Session | Journal, text: string) => {
  const session = 'session' in target ? target.session : target;
  const finishSound = () => {
    const sound = session.sounds.find(
      event =>
        event.id.endsWith(':prompt') && event.startT <= session.soundTimeT
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
  finishSound();
  const effect = target.submit(text);
  finishSound();
  return effect;
};
