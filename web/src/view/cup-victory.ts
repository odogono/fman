import type { HighlightFrame } from '../sim/highlights';
import type { Paint } from './management-layouts';

export const cupVictoryTones: HighlightFrame['tones'] = Array.from(
  { length: 9 },
  (_, i) => ({ duration: 0.2, pitch: i + 1 })
);

const trophy = [
  '            ██████              ',
  '          ██████████            ',
  '          █ ██████ █            ',
  '          ██████████            ',
  '            ██████              ',
  '             ████               ',
  '              ██                ',
  '              ██                ',
  '             ████               ',
  '            ██████              '
];

export const paintCupVictory = (put: Paint, step: number, flash: boolean) => {
  trophy.forEach((row, y) =>
    [...row].forEach((pixel, x) =>
      put(y + 1, x, ' ', {
        bright: true,
        ink: 1,
        inverse: pixel === '█',
        paper: 6
      })
    )
  );
  put(
    11,
    0,
    "!!!!!!!!!You've won the !!!!!!!!!!!!!!!!!  F.A. CUP     !!!!!!!!",
    { bright: true, ink: 1, inverse: !flash, paper: 6 }
  );
  for (let i = 0; i < step; i++) {
    put(13 + i, 0, '********************************', {
      bright: true,
      ink: 2,
      inverse: !flash,
      paper: 6
    });
  }
};
