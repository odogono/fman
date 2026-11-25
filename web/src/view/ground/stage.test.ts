import { expect, test } from 'bun:test';

import { createGroundStage, type StageCanvas } from './stage';

type Args = Parameters<ReturnType<typeof createGroundStage>['paint']>;

// The painter only passes these through, so any stand-ins do.
const args = [{}, {}, {}] as unknown as Args;
const projection = () => [0, 0] as const;

/** A canvas whose WebGL starts or not, and can be lost and restored. */
const fakeCanvas = (webgl: boolean) => {
  const listeners = new Map<string, (event: Event) => void>();
  const canvas: StageCanvas = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    getContext: () => (webgl ? { drawingBufferWidth: 300 } : null)
  };
  let prevented = false;
  return {
    canvas,
    lose: () => {
      listeners.get('webglcontextlost')?.({
        preventDefault: () => {
          prevented = true;
        }
      } as Event);
      return prevented;
    },
    restore: () => listeners.get('webglcontextrestored')?.(new Event('x'))
  };
};

/** A stage on `canvas`, counting its loads and the painters it makes. */
const stageOn = (canvas: StageCanvas) => {
  const counts = { loads: 0, made: 0, painted: 0 };
  const { promise: loaded, resolve: release } = Promise.withResolvers<void>();
  const stage = createGroundStage({
    loadPainter: async () => {
      counts.loads++;
      await loaded;
      return () => {
        counts.made++;
        return {
          paint: () => {
            counts.painted++;
            return projection;
          }
        };
      };
    },
    makeCanvas: () => canvas
  });
  return { counts, release, stage };
};

test('the stage is usable only where WebGL starts', () => {
  expect(stageOn(fakeCanvas(true).canvas).stage.usable()).toBe(true);
  expect(stageOn(fakeCanvas(false).canvas).stage.usable()).toBe(false);
});

test('without WebGL the stage paints nothing and never loads the painter', async () => {
  const { counts, release, stage } = stageOn(fakeCanvas(false).canvas);
  expect(stage.paint(...args)).toBeUndefined();
  release();
  await stage.load();
  expect(stage.paint(...args)).toBeUndefined();
  expect(counts.made).toBe(0);
});

test('the painter loads once, however often it is asked for', async () => {
  const { counts, release, stage } = stageOn(fakeCanvas(true).canvas);
  expect(stage.paint(...args)).toBeUndefined();
  expect(stage.paint(...args)).toBeUndefined();
  const loading = stage.load();
  expect(stage.load()).toBe(loading);
  release();
  await loading;
  expect(stage.paint(...args)).toBe(projection);
  expect(counts).toEqual({ loads: 1, made: 1, painted: 1 });
});

test('a lost context is asked back, and the painter is made again when it returns', async () => {
  const gl = fakeCanvas(true);
  const { counts, release, stage } = stageOn(gl.canvas);
  release();
  await stage.load();
  expect(gl.lose()).toBe(true);
  expect(stage.paint(...args)).toBeUndefined();
  expect(stage.usable()).toBe(true);
  gl.restore();
  expect(stage.paint(...args)).toBe(projection);
  expect(counts).toEqual({ loads: 1, made: 2, painted: 1 });
});

test('a painter that loads while the context is lost waits for it to return', async () => {
  const gl = fakeCanvas(true);
  const { counts, release, stage } = stageOn(gl.canvas);
  expect(stage.usable()).toBe(true);
  const loading = stage.load();
  gl.lose();
  release();
  await loading;
  expect(counts.made).toBe(0);
  expect(stage.paint(...args)).toBeUndefined();
  gl.restore();
  expect(counts.made).toBe(1);
  expect(stage.paint(...args)).toBe(projection);
});
