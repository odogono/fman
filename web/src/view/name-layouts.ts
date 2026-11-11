import type { NameEditor } from '../sim/name-editor';
import type { Paint } from './grid';
import { createPrintScreen } from './print-screen';

export const paintNames = (editor: NameEditor, put: Paint) => {
  const club = editor.kind === 'club';
  let label = 'Continue',
    prompt = '',
    numeric = false;
  if (editor.phase === 'question') {
    prompt = club
      ? 'Do you want to change any team  names (y/n)?'
      : 'Do you want to change any playernames (y/n)?';
    label = club ? 'Change club names, y or n' : 'Change player names, y or n';
  } else {
    const print = createPrintScreen(editor.game.leagueMatches > 0);
    print.text(
      club
        ? `Division ${editor.page}`
        : ['Defence', 'Midfield', 'Attack'][editor.page - 1]!
    );
    print.newline();
    print.text('NUMBER', { ink: 1 });
    print.tab(16, { ink: 1 });
    print.text('NAME', { ink: 1 });
    print.newline();
    const size = club ? 16 : 8;
    for (let i = 0; i < size; i++) {
      const id = (editor.page - 1) * size + i + 1;
      print.text(String(id));
      print.tab(16);
      if (club) {
        print.club(editor.listGame.clubs[id - 1]!);
      } else {
        print.name(editor.listGame.players[id - 1]!.name.padEnd(8));
      }
      print.newline();
    }
    print.text(
      club
        ? 'Type no. of team to be changed  OR 99 for more choice           '
        : 'Type no. of player to be changedOR 99 for more choice',
      { bright: true, paper: 6 }
    );
    print.newline();
    const copy = () => {
      print.at(21, 24);
      print.text('(h=copy)');
      print.newline();
    };
    copy();
    for (const event of editor.output) {
      switch (event.type) {
        case 'input-reserve':
          print.reserveRows(event.rows!);
          break;
        case 'range-error':
          print.text(event.text, { inverse: true });
          print.newline();
          copy();
          break;
        case 'selected':
          print.text(club ? 'Present team is ' : 'Present player is ');
          print.text('', { ink: event.ink });
          print.name(event.text);
          print.newline();
          print.reserveInput();
          break;
        case 'error':
          print.text(event.text, { inverse: true });
          print.newline();
          print.reserveInput();
          break;
        case 'retry-name':
          print.reserveInput();
          break;
        case 'retry-more':
          if (club) {
            print.reserveInput();
          }
          break;
        case 'renamed':
          print.text(club ? 'New team name ' : 'New player name ');
          print.text('', { ink: event.ink });
          print.name(event.text);
          print.newline();
          if (club) {
            print.reserveInput();
          }
          break;
      }
    }
    print.paint(put);
    if (editor.phase === 'list') {
      label = club
        ? 'Club number, or 99 for more choice'
        : 'Player number, or 99 for more choice';
      numeric = true;
    } else if (editor.phase === 'more') {
      prompt = 'Any more changes (y/n)?';
      label = 'Any more changes, y or n';
    } else if (editor.phase === 'fault') {
      put(23, 0, editor.error);
    } else {
      prompt = club ? 'Type new team name' : 'Type new player name';
      label = club ? 'New club name' : 'New player name';
    }
  }
  return { label, numeric, prompt };
};
