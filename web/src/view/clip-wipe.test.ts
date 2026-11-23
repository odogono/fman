import { expect, test } from 'bun:test';

import { inkColours } from './clip-match';
import {
  middleStripe,
  shotAt,
  wipeRow,
  type ClipPicture,
  type ClipStage
} from './clip-wipe';
import { kickOffFrame, wipeFrames, type ClipSide } from './clips';
import { clubGround, favouring } from './match-ground';

const home: ClipSide = { keeper: '#000', kit: '#c00', players: [] };
const away: ClipSide = { keeper: '#000', kit: '#00c', players: [] };

/** A stage whose pictures are captioned with the stage and the frame. */
const stage = (length: number, tag: number): ClipStage => ({
  length,
  picture: at => ({
    frame: kickOffFrame(home, away, `${tag}:${at}`),
    ground: clubGround(
      { club: 1, division: 1, seats: home.kit },
      favouring(home.kit, away.kit)
    ),
    kits: { away: away.kit, home: home.kit },
    sides: { attack: home, defence: away }
  })
});

const tagOf = (picture: ClipPicture | undefined) => picture?.frame.card?.text;

test('played through, each stage wipes out over its last 0.4 s and the next in over its first', () => {
  const stages = [stage(75, 0), stage(200, 1), stage(75, 2)];
  // The kick-off still has nothing before it to wipe in from.
  expect(shotAt(stages, 0, 0).wipe).toBeUndefined();
  expect(shotAt(stages, 0, 54).wipe).toBeUndefined();
  // It wipes out to the clip's first frame, held still.
  const out = shotAt(stages, 0, 55);
  expect(out.wipe?.progress).toBe(0);
  expect(tagOf(out.wipe?.to)).toEqual('1:0');
  expect(shotAt(stages, 0, 74).wipe?.progress).toBe(19 / wipeFrames);
  // The clip wipes in from the still's last frame, carrying on from there.
  const into = shotAt(stages, 1, 0);
  expect(into.wipe?.progress).toBe(0.5);
  expect(tagOf(into.wipe?.from)).toEqual('0:74');
  expect(tagOf(into)).toEqual('1:0');
  expect(shotAt(stages, 1, 19).wipe?.progress).toBe(39 / wipeFrames);
  expect(shotAt(stages, 1, 20).wipe).toBeUndefined();
  expect(shotAt(stages, 1, 179).wipe).toBeUndefined();
  expect(tagOf(shotAt(stages, 1, 180).wipe?.to)).toEqual('2:0');
  // The last stage has nothing after it to wipe out to.
  expect(shotAt(stages, 2, 74).wipe).toBeUndefined();
});

test('the stripes sweep the whole picture, left to right, the lower rows behind', () => {
  const columns = 210;
  const rows = 158;
  for (let row = 0; row < rows; row++) {
    const start = wipeRow(0, row, columns, rows);
    expect(start.stripes[0]!.to).toBeLessThanOrEqual(0);
    expect(wipeRow(1, row, columns, rows).swept).toBeGreaterThanOrEqual(
      columns
    );
  }
  const top = wipeRow(0.5, 0, columns, rows);
  const bottom = wipeRow(0.5, rows - 1, columns, rows);
  expect(bottom.swept).toBeLessThan(top.swept);
  // Ink, home, white, away, ink, edge to edge from the leading edge.
  expect(top.stripes.map(s => s.to - s.from)).toEqual([2, 10, 10, 10, 2]);
  top.stripes.slice(1).forEach((s, k) => {
    expect(s.to).toBe(top.stripes[k]!.from);
  });
  expect(top.swept).toBe(top.stripes.at(-1)!.from);
});

test('the middle stripe is white, unless a kit looks like it', () => {
  const [black, blue, red, , , , yellowKit, white] = inkColours;
  expect(middleStripe(red, blue)).toBe('#f4f4f4');
  expect(middleStripe(black, red)).toBe('#f4f4f4');
  // A white kit beside it would read as one wide stripe.
  expect(middleStripe(red, white)).toBe('#fac81e');
  expect(middleStripe(white, yellowKit)).toBe('#141414');
});
