import type { Game } from './management';
import {
  NameRuntimeError,
  clubInk,
  clubText,
  renameClub,
  renamePlayer
} from './names';

const yes = (text: string) => ['y', 'Y', 'yes', 'YES'].includes(text);

export const createNameEditor = (initial: Game) => {
  let game = initial;
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
      return { type: 'copy' };
    }
    switch (phase) {
      case 'question':
        if (yes(text)) {
          phase = 'list';
          page = 1;
          listGame = game;
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
          break;
        }
        const size = kind === 'club' ? 16 : 8;
        if (id < (page - 1) * size + 1 || id > page * size) {
          error =
            kind === 'club'
              ? 'TEAM NUMBER OUT OF RANGE'
              : 'PLAYER NO. OUT OF RANGE';
          break;
        }
        selectedId = id;
        previousName =
          kind === 'club'
            ? clubText(game.clubs[id - 1]!)
            : game.players[id - 1]!.name.padEnd(8);
        previousInk = kind === 'club' ? clubInk(game.clubs[id - 1]!) : 0;
        phase = 'name';
        error = '';
        break;
      }
      case 'name':
        if (text.length === 0) {
          break;
        }
        try {
          game =
            kind === 'club'
              ? renameClub(game, selectedId, text)
              : renamePlayer(game, selectedId, text);
          phase = 'more';
          error = '';
        } catch (error_) {
          if (error_ instanceof NameRuntimeError) {
            phase = 'fault';
            error = error_.message;
          } else if (error_ instanceof RangeError) {
            error = error_.message;
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
