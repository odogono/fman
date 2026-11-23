import { grass } from '../clip-canvas';
import { pitchLength, pitchWidth } from '../clips';

// The grass's mowing patterns (#263): each says which of today's two greens
// a point of the pitch is mown in. Patterns are measured from the centre
// spot, so each is the same at both ends.

export const grassPatterns = [
  'stripes',
  'across',
  'checks',
  'diamonds',
  'circles',
  'plain'
] as const;

export type GrassPattern = (typeof grassPatterns)[number];

/** How wide each mown band is, in metres. */
const band = 5;

/** Whether `n` falls in an odd band, counting either way from zero. */
const odd = (n: number) => Math.abs(Math.floor(n)) % 2 === 1;

/** Whether the point `x` across and `y` down from the centre spot is mown dark. */
const darkAt = (pattern: GrassPattern, x: number, y: number) => {
  switch (pattern) {
    case 'across': {
      return odd(x / band + 0.5);
    }
    case 'checks': {
      return odd(x / band + 0.5) !== odd(y / band + 0.5);
    }
    case 'circles': {
      return odd(Math.hypot(x, y) / band + 0.5);
    }
    case 'diamonds': {
      const size = band * Math.SQRT2;
      return odd((x + y) / size + 0.5) !== odd((x - y) / size + 0.5);
    }
    case 'plain': {
      return false;
    }
    case 'stripes': {
      return odd(y / band + 0.5);
    }
  }
};

const channels = (colour: string) =>
  [1, 3, 5].map(i => Number.parseInt(colour.slice(i, i + 2), 16));

/** The pitch mown in `pattern`, `perMetre` texels to the metre. */
export const mowPitch = (pattern: GrassPattern, perMetre: number) => {
  const width = Math.round(pitchWidth * perMetre);
  const height = Math.round(pitchLength * perMetre);
  const image = new ImageData(width, height);
  const [light, dark] = grass.map(channels);
  for (let row = 0; row < height; row++) {
    const y = (row + 0.5) / perMetre - pitchLength / 2;
    for (let column = 0; column < width; column++) {
      const x = (column + 0.5) / perMetre - pitchWidth / 2;
      const colour = darkAt(pattern, x, y) ? dark! : light!;
      image.data.set([...colour, 255], (row * width + column) * 4);
    }
  }
  return image;
};
