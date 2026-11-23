// Where each sprite goes in the ground's atlas (#280): packed left to right
// along shelves, a pixel apart, each shelf as tall as its tallest. When the
// square fills, it starts over empty, and counts another generation.

/** A rect's top left, and whether the atlas started over to fit it. */
export type Placed = Readonly<{ restarted: boolean; x: number; y: number }>;

/** Packs rects into a square `size` pixels across. */
export const createShelves = (size: number) => {
  let x = 0;
  let y = 0;
  let shelf = 0;
  let generation = 0;
  const place = (width: number, height: number): Placed => {
    if (x + width + 1 > size) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    let restarted = false;
    if (y + height > size) {
      x = 0;
      y = 0;
      shelf = 0;
      generation++;
      restarted = true;
    }
    const placed = { restarted, x, y };
    x += width + 1;
    shelf = Math.max(shelf, height);
    return placed;
  };
  return { generation: () => generation, place };
};
