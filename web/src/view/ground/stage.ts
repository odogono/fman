import type { GroundPainter } from './painter';

// The browser's WebGL for the ground (#287): one canvas the ground is
// rendered into, whether WebGL starts on it, the painter loaded once, and
// the context lost and asked back (ADR 0018).

/** What the stage needs of a canvas, so a test can stand in for one. */
export type StageCanvas = {
  addEventListener(
    type: 'webglcontextlost' | 'webglcontextrestored',
    listener: (event: Event) => void
  ): void;
  getContext(id: 'webgl' | 'webgl2', options: WebGLContextAttributes): unknown;
};

type Paint = GroundPainter['paint'];

export type GroundStage<Canvas> = Readonly<{
  /** Loads the painter, once; resolves when it has loaded. */
  load: () => Promise<void>;
  /**
   * Renders into `picture` and returns where the pitch's points fall in
   * it, or nothing while the painter loads or WebGL is lost. Starts the
   * load.
   */
  paint: (...args: Parameters<Paint>) => ReturnType<Paint> | undefined;
  /** The canvas the ground is rendered into, to copy from. */
  readonly picture: Canvas;
  /** Whether WebGL starts here; without it there are no clips. */
  usable: () => boolean;
}>;

export const createGroundStage = <Canvas extends StageCanvas>(
  options: Readonly<{
    loadPainter: () => Promise<
      (canvas: Canvas) => Pick<GroundPainter, 'paint'>
    >;
    makeCanvas: () => Canvas;
  }>
): GroundStage<Canvas> => {
  let canvas: Canvas | undefined;
  let usable = false;
  let lost = false;
  let create: ((canvas: Canvas) => Pick<GroundPainter, 'paint'>) | undefined;
  let painter: Pick<GroundPainter, 'paint'> | undefined;
  let loading: Promise<void> | undefined;

  const picture = () => {
    if (!canvas) {
      const made = options.makeCanvas();
      const attributes: WebGLContextAttributes = {
        alpha: false,
        antialias: false
      };
      const gl = (made.getContext('webgl2', attributes) ??
        made.getContext('webgl', attributes)) as
        { drawingBufferWidth?: unknown } | null | undefined;
      canvas = made;
      usable = typeof gl?.drawingBufferWidth === 'number';
      // Phones drop WebGL now and then, as an app goes into the background;
      // asking keeps the chance of getting it back.
      made.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        lost = true;
        painter = undefined;
      });
      made.addEventListener('webglcontextrestored', () => {
        lost = false;
        painter = create?.(made);
      });
    }
    return canvas;
  };

  const isUsable = () => {
    picture();
    return usable;
  };

  const load = () => {
    loading ??= options.loadPainter().then(createPainter => {
      create = createPainter;
      if (isUsable() && !lost) {
        painter = createPainter(picture());
      }
    });
    return loading;
  };

  return {
    load,
    paint: (...args) => {
      if (!isUsable()) {
        return undefined;
      }
      if (!painter) {
        void load();
        return undefined;
      }
      return painter.paint(...args);
    },
    get picture() {
      return picture();
    },
    usable: isUsable
  };
};
