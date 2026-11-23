import { pitchLength, pitchWidth } from '../clips';

// The pitch (#263): its grass, mown in one of several patterns, and its
// markings. Each pattern says which of two greens a point of the pitch is
// mown in, measured from the centre spot, so each is the same at both ends.

/** The grass's two greens, light and dark. */
const grass = ['#2f7d32', '#2a7230'] as const;
/** The ground around the pitch. */
export const surround = '#245f28';
const line = 'rgba(255, 255, 255, 0.85)';

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

/** The pitch's markings, drawn in metres on `ctx`. */
export const markings = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = line;
  ctx.lineWidth = 0.15;
  ctx.strokeRect(0, 0, pitchWidth, pitchLength);
  ctx.beginPath();
  ctx.moveTo(0, pitchLength / 2);
  ctx.lineTo(pitchWidth, pitchLength / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pitchWidth / 2, pitchLength / 2, 9.15, 0, Math.PI * 2);
  ctx.stroke();
  for (const top of [true, false]) {
    const edge = top ? 0 : pitchLength;
    const into = top ? 1 : -1;
    for (const [width, depth] of [
      [40.32, 16.5],
      [18.32, 5.5]
    ] as const) {
      const x = (pitchWidth - width) / 2;
      ctx.strokeRect(x, Math.min(edge, edge + into * depth), width, depth);
    }
    ctx.fillStyle = line;
    for (const [x, y, r] of [
      [pitchWidth / 2, pitchLength / 2, 0.3],
      [pitchWidth / 2, edge + into * 11, 0.25]
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(
      pitchWidth / 2,
      edge + into * 11,
      9.15,
      top ? 0.2 * Math.PI : 1.2 * Math.PI,
      top ? 0.8 * Math.PI : 1.8 * Math.PI
    );
    ctx.stroke();
  }
};
