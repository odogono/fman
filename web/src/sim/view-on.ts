import type { Screen, Session, View } from './session';

/** The session's view, narrowed to `screen`; throws when it shows another. */
export const viewOn = <S extends Screen>(
  session: Session,
  screen: S
): Extract<View, { screen: S }> => {
  const view = session.view;
  if (view.screen !== screen) {
    throw new Error(`Session shows ${view.screen}, not ${screen}`);
  }
  return view as Extract<View, { screen: S }>;
};
