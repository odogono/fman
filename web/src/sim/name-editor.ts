import type { Game } from './management';
import {
  NameRuntimeError,
  clubInk,
  clubText,
  renameClub,
  renamePlayer
} from './names';

export type NameOutput = Readonly<{
  ink: number;
  text: string;
  type:
    | 'selected'
    | 'renamed'
    | 'error'
    | 'range-error'
    | 'retry-name'
    | 'retry-more';
}>;

const yes = (text: string) => ['y', 'Y', 'yes', 'YES'].includes(text);

export const createNameEditor = (initial: Game) => {
  let game = initial;
  let output: NameOutput[] = [];
  let listGame = initial;
  let previousInk = 0;
  let kind: 'club' | 'player' = 'club';
  let phase: 'question' | 'list' | 'name' | 'more' | 'fault' = 'question';
  let page = 1;
  let selectedId = 0;
  let previousName = '';
  let error = '';
  let done = false;
  const nextKind = () => {
    if (kind === 'player') {
      done = true;
      return;
    }
    output = [];
    kind = 'player';
    phase = 'question';
    page = 1;
    selectedId = 0;
    error = '';
    previousName = '';
  };
  const submit = (text: string): { type: 'copy' } | undefined => {
    if (done || phase === 'fault') {
      return;
    }
    if (phase !== 'question' && (text === 'h' || text === 'H')) {
      if (phase === 'name' || phase === 'more') {
        output.push({
          ink: 0,
          text: '',
          type: phase === 'name' ? 'retry-name' : 'retry-more'
        });
      }
      return { type: 'copy' };
    }
    switch (phase) {
      case 'question':
        if (yes(text)) {
          phase = 'list';
          page = 1;
          listGame = game;
          output = [];
        } else {
          nextKind();
        }
        break;
      case 'list': {
        if (!/^\d*$/.test(text) || !Number.isSafeInteger(Number('0' + text))) {
          break;
        }
        const id = Number('0' + text);
        if (id === 99) {
          page = (page % (kind === 'club' ? 4 : 3)) + 1;
          error = '';
          listGame = game;
          output = [];
          break;
        }
        const size = kind === 'club' ? 16 : 8;
        if (id < (page - 1) * size + 1 || id > page * size) {
          error =
            kind === 'club'
              ? 'TEAM NUMBER OUT OF RANGE'
              : 'PLAYER NO. OUT OF RANGE';
          output.push({ ink: 0, text: error, type: 'range-error' });
          break;
        }
        selectedId = id;
        previousName =
          kind === 'club'
            ? clubText(game.clubs[id - 1]!)
            : game.players[id - 1]!.name.padEnd(8);
        previousInk = kind === 'club' ? clubInk(game.clubs[id - 1]!) : 0;
        output.push({ ink: previousInk, text: previousName, type: 'selected' });
        phase = 'name';
        error = '';
        break;
      }
      case 'name':
        if (text.length === 0) {
          output.push({ ink: 0, text: '', type: 'retry-name' });
          break;
        }
        try {
          game =
            kind === 'club'
              ? renameClub(game, selectedId, text)
              : renamePlayer(game, selectedId, text);
          output.push({
            ink: kind === 'club' ? clubInk(game.clubs[selectedId - 1]!) : 0,
            text:
              kind === 'club'
                ? clubText(game.clubs[selectedId - 1]!)
                : game.players[selectedId - 1]!.name.padEnd(8),
            type: 'renamed'
          });
          phase = 'more';
          error = '';
        } catch (error_) {
          if (error_ instanceof NameRuntimeError) {
            phase = 'fault';
            error = error_.message;
          } else if (error_ instanceof RangeError) {
            error = error_.message;
            output.push({ ink: 0, text: error, type: 'error' });
          } else {
            throw error_;
          }
        }
        break;
      case 'more':
        if (yes(text)) {
          phase = 'list';
          error = '';
          listGame = game;
          output = [];
        } else {
          nextKind();
        }
        break;
    }
  };
  return {
    get done() {
      return done;
    },
    get error() {
      return error;
    },
    get game() {
      return game;
    },
    get kind() {
      return kind;
    },
    get listGame() {
      return listGame;
    },
    get output(): readonly NameOutput[] {
      return output;
    },
    get page() {
      return page;
    },
    get phase() {
      return phase;
    },
    get previousInk() {
      return previousInk;
    },
    get previousName() {
      return previousName;
    },
    get selectedId() {
      return selectedId;
    },
    submit
  };
};
export type NameEditor = ReturnType<typeof createNameEditor>;
