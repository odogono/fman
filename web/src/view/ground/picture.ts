import { pitchLength, pitchWidth } from '../clips';

// A clip's picture (#285): what the camera shows, from the one tilt behind
// the bottom goal that only the painter's side knows (ADR 0018). A clip
// says where to look and how closely (its focus) and what must never leave
// the picture (its subject); this fits the picture to the box it is drawn
// in. Seen from the tilt, the ground the picture shows (its patch) reaches
// further up the pitch than down, and is wider at the far end than the
// near. All of it is worked out here, without WebGL, so the painter, the
// overlays and the mini-map share it.

/** The camera's angle from straight down, in degrees, behind the bottom goal. */
export const tilt = 35;
/** The camera's field of view, top to bottom: narrow, so near-flat. */
export const fieldOfView = 20;

/** The ground shown beyond each goal line, at most, at the picture's top and bottom edges. */
const goalLineMargin = 8;
/** The ground shown beyond each touchline, at most, at the picture's bottom edge. */
const touchlineMargin = 6;
/** How far the subject stays inside every edge of the picture, in metres on the pitch. */
const subjectInset = 3;

/**
 * A box wider than square, as on a wide window (#255), shows no more of
 * the pitch's width than this: the pitch and a little of each touchline.
 */
const widestPatch = pitchWidth + 12;

const angle = (tilt * Math.PI) / 180;
const cos = Math.cos(angle);
const sin = Math.sin(angle);
const halfView = Math.tan(((fieldOfView / 2) * Math.PI) / 180);

/**
 * How far heights lean up the pitch: a metre of height rises a metre up
 * the screen at the tilt, as the sprites draw it (ADR 0017).
 */
export const shear = (1 - sin) / cos;

/** A point on the pitch, in metres. */
export type PitchPoint = Readonly<{ x: number; y: number }>;

/** Where a clip's camera looks, and how many metres across it shows there. */
export type Focus = Readonly<{ across: number; x: number; y: number }>;

/** A point on the pitch, `up` metres above it, in pixels from the picture's top left. */
export type Projection = (
  x: number,
  y: number,
  up?: number
) => readonly [number, number];

/** How a picture is seen: the point at its centre, its scale there, and its size. */
export type PictureView = Readonly<{
  /** The picture's size, in pixels. */
  high: number;
  /** Metres on the ground to each pixel, at the picture's centre. */
  metresPerPixel: number;
  wide: number;
  /** The point on the pitch at the picture's centre, in metres. */
  x: number;
  y: number;
}>;

/** How far the camera stands from the point it looks at, for a picture `length` metres tall at its centre. */
export const cameraDistance = (length: number) => length / 2 / halfView;

/** Where the pitch's points fall in the picture `view` describes. */
export const projection =
  (view: PictureView): Projection =>
  (x, y, up = 0) => {
    const distance = cameraDistance(view.high * view.metresPerPixel);
    const down = y - shear * up - view.y;
    const depth = distance - cos * up - sin * down;
    const scale = distance / (depth * view.metresPerPixel);
    return [
      view.wide / 2 + (x - view.x) * scale,
      view.high / 2 - (sin * up - cos * down) * scale
    ];
  };

/**
 * The patch of pitch a box shows across its centre row and from top to
 * bottom there, in metres, from the camera's width across it (`across`).
 * Down to square the width holds and the length follows the box. Wider
 * than square, the box keeps the length a square would show, closing in as
 * the camera does for a moment, and the width grows to fill it, up to the
 * pitch and a little touchline; past that, the length grows instead.
 */
export const patchFor = (across: number, width: number, height: number) => {
  const aspect = height / width;
  if (aspect >= 1) {
    return { length: across * aspect, width: across };
  }
  const wide = Math.min(across / aspect, Math.max(across, widestPatch));
  return { length: wide * aspect, width: wide };
};

/**
 * How far a picture `across` by `length` metres at its centre reaches up
 * and down the pitch from its centre, and its half-width on the ground
 * `down` metres down the pitch from its centre.
 */
const reachOf = (across: number, length: number) => {
  const distance = cameraDistance(length);
  const half = length / 2;
  return {
    down: (half * distance) / (cos * distance + sin * half),
    halfWidthAt: (down: number) =>
      ((across / 2) * (distance - sin * down)) / distance,
    up: (half * distance) / (cos * distance - sin * half)
  };
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/**
 * Where along one line of the pitch, `size` long, to put a picture's centre
 * that reaches `before` and `after` it from `at`: no more than `margin`
 * beyond either end, or, when it can't help showing more, centred on the
 * pitch.
 */
const fitAlong = (
  at: number,
  before: number,
  after: number,
  size: number,
  margin: number
) =>
  before + after > size + 2 * margin
    ? (size + before - after) / 2
    : clamp(at, before - margin, size + margin - after);

/** A clip's picture, fitted to its box. */
export type Picture = Readonly<{
  /** Metres on the ground to each of the box's pixels, at the picture's centre. */
  metresPerPixel: number;
  /** The ground the picture shows: its corners, top left, top right, bottom right, bottom left. */
  patch: readonly [PitchPoint, PitchPoint, PitchPoint, PitchPoint];
  /** Where the pitch's points fall in the box, in its pixels. */
  project: Projection;
  /** The point on the pitch at the picture's centre, in metres. */
  x: number;
  y: number;
}>;

/**
 * The picture a box `width` by `height` pixels shows of `focus`, never
 * losing `subject`: no more than the margins beyond the goal lines and
 * touchlines, unless the picture can't help it, and the subject always
 * `subjectInset` inside it, whatever the margins say.
 */
export const framePicture = (
  focus: Focus,
  subject: PitchPoint,
  box: Readonly<{ height: number; width: number }>
): Picture => {
  const patch = patchFor(focus.across, box.width, box.height);
  const metresPerPixel = patch.width / box.width;
  const { down, halfWidthAt, up } = reachOf(patch.width, patch.length);
  const y = clamp(
    fitAlong(focus.y, up, down, pitchLength, goalLineMargin),
    subject.y - down + subjectInset,
    subject.y + up - subjectInset
  );
  const nearHalf = halfWidthAt(down);
  const besideSubject = Math.max(0, halfWidthAt(subject.y - y) - subjectInset);
  const x = clamp(
    fitAlong(focus.x, nearHalf, nearHalf, pitchWidth, touchlineMargin),
    subject.x - besideSubject,
    subject.x + besideSubject
  );
  const farHalf = halfWidthAt(-up);
  return {
    metresPerPixel,
    patch: [
      { x: x - farHalf, y: y - up },
      { x: x + farHalf, y: y - up },
      { x: x + nearHalf, y: y + down },
      { x: x - nearHalf, y: y + down }
    ],
    project: projection({
      high: box.height,
      metresPerPixel,
      wide: box.width,
      x,
      y
    }),
    x,
    y
  };
};
