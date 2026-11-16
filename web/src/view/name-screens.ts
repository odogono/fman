import { clubSquads } from '../sim/ruleset';
import type { View } from '../sim/session';
import { clubName, type ClubName } from './home';

type Choice = Readonly<{ id: string; label: string }>;

/**
 * Modern mode's name editing, in place of the original's: its questions,
 * the club and player lists a page at a time, and renaming one, a club's
 * colour picked rather than typed.
 */
export type ModernNames =
  | Readonly<{ kind: 'question'; no: Choice; text: string; yes: Choice }>
  | Readonly<{
      entries: readonly Readonly<{
        club?: ClubName;
        id: string;
        name: string;
      }>[];
      kind: 'list';
      next: Choice;
      title: string;
    }>
  | Readonly<{
      /** The club's ink on the screen now, or `plain` for none of its own. */
      colour: number | 'plain';
      /** The inks a club's name may take, 0 to 4; none for a player. */
      colours: readonly number[];
      current: ClubName;
      /** The original's message for the last name it refused. */
      error?: string;
      kind: 'rename';
      /** Whether renaming loses the club's own background colour. */
      loses: boolean;
      /** The longest name with a colour of its own, and without. */
      maxLength: Readonly<{ coloured: number; plain: number }>;
      target: 'club' | 'player';
    }>;

/** A players page's title, as the original's list heads it. */
const playersPage = (page: number, squads: boolean) =>
  squads
    ? `Players ${page * 8 - 7}–${page * 8}`
    : ['Defence', 'Midfield', 'Attack'][page - 1]!;

export const namesFor = (view: View): ModernNames | undefined => {
  if (view.screen !== 'names') {
    return undefined;
  }
  const editor = view.nameEditor;
  const club = editor.kind === 'club';
  switch (editor.phase) {
    case 'question':
      return {
        kind: 'question',
        no: { id: 'names.no', label: 'Skip' },
        text: club ? 'Change club names?' : 'Change player names?',
        yes: { id: 'names.yes', label: 'Change' }
      };
    case 'more':
      return {
        kind: 'question',
        no: { id: 'names.no', label: 'Done' },
        text: 'Any more changes?',
        yes: { id: 'names.yes', label: 'Rename another' }
      };
    case 'list': {
      const { page } = editor;
      const size = club ? 16 : 8;
      const pages = club ? 4 : 3;
      const squads = clubSquads(editor.listGame.ruleset);
      const ids = Array.from(
        { length: size },
        (_, i) => (page - 1) * size + i + 1
      );
      const next = (page % pages) + 1;
      return {
        entries: ids.map(id => {
          if (club) {
            const named = clubName(editor.listGame.clubs[id - 1]!);
            return { club: named, id: `names.club.${id}`, name: named.name };
          }
          return {
            id: `names.player.${id}`,
            name: editor.listGame.players[id - 1]!.name.trim()
          };
        }),
        kind: 'list',
        next: {
          id: 'names.next-page',
          label: `Next: ${club ? `Division ${next}` : playersPage(next, squads)}`
        },
        title: club ? `Division ${page}` : playersPage(page, squads)
      };
    }
    case 'name': {
      const id = editor.selectedId;
      if (club) {
        const named = editor.game.clubs[id - 1]!;
        return {
          colour: named.ink ?? 'plain',
          colours: [0, 1, 2, 3, 4],
          current: clubName(named),
          ...(editor.error ? { error: editor.error } : {}),
          kind: 'rename',
          loses: named.paper !== undefined,
          maxLength: { coloured: 10, plain: 12 },
          target: 'club'
        };
      }
      return {
        colour: 'plain',
        colours: [],
        current: {
          ink: 0,
          name: editor.game.players[id - 1]!.name.trim(),
          paper: 7
        },
        ...(editor.error ? { error: editor.error } : {}),
        kind: 'rename',
        loses: false,
        maxLength: { coloured: 8, plain: 8 },
        target: 'player'
      };
    }
    case 'fault':
      return undefined;
  }
};
