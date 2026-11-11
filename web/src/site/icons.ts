import { rasterText } from '../view/glyphs';
import { encodePng } from './png';

/** The icon's art: 16×16 Spectrum pixels, "FM" above a pitch line. */
const art = () => {
  const rgba = new Uint8ClampedArray(16 * 16 * 4);
  rasterText(rgba, 16, 0, 0, 'FM', { bright: true, ink: 6, paper: 0 });
  rasterText(rgba, 16, 0, 8, '▀▀', { bright: true, ink: 7, paper: 4 });
  return rgba;
};

export type Icon = Readonly<{
  file: string;
  purpose: 'any' | 'maskable';
  size: number;
}>;

export const icons: readonly Icon[] = [
  { file: 'icon-192.png', purpose: 'any', size: 192 },
  { file: 'icon-512.png', purpose: 'any', size: 512 },
  { file: 'icon-maskable-512.png', purpose: 'maskable', size: 512 },
  { file: 'apple-touch-icon.png', purpose: 'any', size: 180 }
];

/**
 * The icon as a PNG: the art scaled by whole pixels onto black. A maskable
 * icon keeps the art inside the central circle a launcher may crop to.
 */
export const paintIcon = ({ purpose, size }: Icon) => {
  const source = art();
  const scale = Math.floor(
    (size * (purpose === 'maskable' ? 0.55 : 0.75)) / 16
  );
  const offset = Math.floor((size - 16 * scale) / 2);
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - offset) / scale);
      const sy = Math.floor((y - offset) / scale);
      const out = (y * size + x) * 4;
      if (sx >= 0 && sx < 16 && sy >= 0 && sy < 16) {
        rgba.set(
          source.subarray((sy * 16 + sx) * 4, (sy * 16 + sx + 1) * 4),
          out
        );
      } else {
        rgba[out + 3] = 255;
      }
    }
  }
  return encodePng(rgba, size);
};
