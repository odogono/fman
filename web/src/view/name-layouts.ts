import { clubInk, clubText } from '../sim/names';
import type { Session } from '../sim/session';
import type { Paint } from './management-layouts';

export const paintNames = (session: Session, put: Paint) => {
  const editor = session.nameEditor!;
  const club = editor.kind === 'club';
  const size = club ? 16 : 8;
  let label = 'Continue';
  let prompt = '';
  let numeric = false;
  if (editor.phase === 'question') {
    prompt = club
      ? 'Do you want to change any team  names (y/n)?'
      : 'Do you want to change any playernames (y/n)?';
    label = club ? 'Change club names, y or n' : 'Change player names, y or n';
  } else {
    const offset =
      editor.phase === 'list'
        ? 0
        : editor.phase === 'fault' || (!club && editor.phase === 'more')
          ? -2
          : -3;
    const listPut: Paint = (row, column, text, style) =>
      put(row + offset, column, text, style);
    listPut(
      0,
      0,
      club
        ? `Division ${editor.page}`
        : ['Defence', 'Midfield', 'Attack'][editor.page - 1]!
    );
    listPut(1, 0, 'NUMBER', { ink: 1 });
    listPut(1, 16, 'NAME', { ink: 1 });
    for (let i = 0; i < size; i++) {
      const id = (editor.page - 1) * size + i + 1;
      listPut(i + 2, 0, String(id));
      if (club) {
        listPut(i + 2, 16, clubText(editor.listGame.clubs[id - 1]!), {
          ink: clubInk(editor.listGame.clubs[id - 1]!)
        });
      } else {
        listPut(i + 2, 16, editor.listGame.players[id - 1]!.name.padEnd(8));
      }
    }
    const row = size + 2;
    listPut(
      row,
      0,
      club
        ? 'Type no. of team to be changed  OR 99 for more choice           '
        : 'Type no. of player to be changedOR 99 for more choice',
      { bright: !club, inverse: club, paper: 6 }
    );
    if (editor.phase === 'list') {
      label = club
        ? 'Club number, or 99 for more choice'
        : 'Player number, or 99 for more choice';
      numeric = true;
    } else {
      const previousRow = 22 + offset;
      put(previousRow, 0, club ? 'Present team is ' : 'Present player is ');
      put(previousRow, club ? 16 : 18, editor.previousName, {
        ink: editor.previousInk
      });
      if (editor.phase === 'more') {
        const name = club
          ? clubText(editor.game.clubs[editor.selectedId - 1]!)
          : editor.game.players[editor.selectedId - 1]!.name.padEnd(8);
        put(previousRow + 1, 0, club ? 'New team name ' : 'New player name ');
        put(previousRow + 1, club ? 14 : 16, name, {
          ink: club ? clubInk(editor.game.clubs[editor.selectedId - 1]!) : 0
        });
        prompt = 'Any more changes (y/n)?';
        label = 'Any more changes, y or n';
      } else {
        prompt = club ? 'Type new team name' : 'Type new player name';
        label = club ? 'New club name' : 'New player name';
      }
    }
    if (editor.error && editor.phase !== 'fault') {
      put(editor.phase === 'list' ? row + 2 : 23 + offset, 0, editor.error, {
        inverse: true
      });
    }
    put(21 + offset, 24, '(h=copy)');
    if (editor.phase === 'fault') {
      put(23, 0, editor.error);
      prompt = '';
    }
  }
  return { label, numeric, prompt };
};
