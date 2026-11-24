import { fitClipCanvas, paintClip } from './clip-canvas';
import { celebrationFrame } from './cup-celebration';
import type { CupReplay, CupResult } from './cup-screens';
import { cell, clubLabel, continueRow } from './paint-parts';

/** Modern mode's replay notice: the round, Replay, and the replay's fixture. */
export const paintCupReplay = (pane: HTMLElement, replay: CupReplay) => {
  const title = document.createElement('h2');
  title.className = 'league-title';
  title.textContent = replay.title;
  const word = cell('cup-banner replay', 'Replay');
  const sides = document.createElement('p');
  sides.className = 'cup-fixture';
  sides.append(clubLabel(replay.home), ' v ', clubLabel(replay.away));
  pane.replaceChildren(title, word, sides, continueRow(replay.done));
};

/**
 * Modern mode's cup result: through, out, or the cup won. Winning plays
 * the cup celebration on the pitch, paced by the original's timed
 * celebration, before Continue. `scene`: the scene can be painted; without
 * WebGL (ADR 0018) the cup won shows its banner instead.
 */
export const paintCupResult = (
  pane: HTMLElement,
  result: CupResult,
  scene: boolean
) => {
  const celebration = scene ? result.celebration : undefined;
  const title = document.createElement('h2');
  title.className = 'league-title';
  title.textContent = result.title;
  const parts: HTMLElement[] = [title];
  if (celebration) {
    const canvas = document.createElement('canvas');
    canvas.className = 'cup-scene';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'The players lift the F.A. Cup on the pitch'
    );
    parts.push(canvas, cell('cup-won', result.headline));
  } else {
    parts.push(cell(`cup-banner ${result.outcome}`, result.headline));
  }
  if (!celebration || result.done.enabled) {
    parts.push(cell('cup-tie', result.tie), continueRow(result.done));
  }
  pane.replaceChildren(...parts);
};

/**
 * The cup celebration's frame on the scene `paintCupResult` built, and
 * whether it is still playing. `still`: under reduced motion it shows the
 * lift from the start.
 */
export const paintCupScene = (
  pane: HTMLElement,
  result: CupResult,
  scene: boolean,
  still: boolean
) => {
  const celebration = scene ? result.celebration : undefined;
  pane.classList.toggle(
    'celebrating',
    Boolean(celebration) && !result.done.enabled
  );
  const canvas = pane.querySelector<HTMLCanvasElement>('canvas.cup-scene');
  if (celebration && canvas) {
    paintClip(
      canvas.getContext('2d')!,
      celebrationFrame(
        celebration.sides,
        celebration.progress,
        celebration.clock,
        still
      ),
      { attack: celebration.sides.winners, defence: celebration.sides.losers },
      celebration.ground,
      fitClipCanvas(canvas)
    );
  }
};
