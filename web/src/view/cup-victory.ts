import type { Paint } from './management-layouts';

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

export const paintCupVictory = (
  put: Paint,
  step: number,
  flash: boolean,
  progress?: { stars: number; text: number; trophy: number }
) => {
  trophy.forEach((row, y) =>
    [...row].forEach((pixel, x) => {
      if (y * 32 + x >= (progress?.trophy ?? Infinity)) {
        return;
      }
      put(y + 1, x, ' ', {
        bright: true,
        ink: 1,
        inverse: pixel === '█',
        paper: 6
      });
    })
  );
  put(
    11,
    0,
    "!!!!!!!!!You've won the !!!!!!!!!!!!!!!!!  F.A. CUP     !!!!!!!!".slice(
      0,
      progress?.text ?? Infinity
    ),
    { bright: true, ink: 1, inverse: !flash, paper: 6 }
  );
  for (let i = 0; i < step; i++) {
    put(
      13 + i,
      0,
      '********************************'.slice(
        0,
        Math.max(0, (progress?.stars ?? Infinity) - i * 32)
      ),
      {
        bright: true,
        ink: 2,
        inverse: !flash,
        paper: 6
      }
    );
  }
};
