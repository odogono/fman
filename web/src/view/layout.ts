import type { Screen, View } from '../sim/session';
import type { Paint } from './grid';

/**
 * What a layout leaves for the command line below the screen, where it
 * differs from the defaults: no prompt, the label `Command`, free text and
 * no `(h=copy)` hint.
 */
export type LayoutResult = Readonly<{
  /** The screen offers the `(h=copy)` hint, unless printing has faulted. */
  copy?: boolean;
  /** The command line's accessible name. */
  label?: string;
  numeric?: boolean;
  prompt?: string;
}>;

/** Paints one of the original's screens from its view. */
export type Layout<S extends Screen> = (
  view: Extract<View, { screen: S }>,
  put: Paint
) => LayoutResult | void;

/** The layouts for some of the screens, keyed by screen. */
export type Layouts<S extends Screen> = { readonly [K in S]: Layout<K> };
