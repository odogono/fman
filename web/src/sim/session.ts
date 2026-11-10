import { createFrameClock } from './frame-clock';
import {
  borrow,
  createNewGame,
  makeSaleOffer,
  repay,
  respondToSale,
  type Game,
  type SaleOffer
} from './management';
import { createRng } from './rng';

export type Screen =
  | 'title'
  | 'manager'
  | 'clubs'
  | 'level'
  | 'colours'
  | 'menu'
  | 'status'
  | 'squad'
  | 'sale'
  | 'message'
  | 'borrow'
  | 'repay';
export type Effect =
  { type: 'copy' } | { feature: string; type: 'unavailable' };

const isCommand = (text: string, command: string) =>
  text === command || text === command.toUpperCase();
const numericInput = (text: string) =>
  /^\d*$/.test(text) && Number.isSafeInteger(Number(`0${text}`))
    ? Number(`0${text}`)
    : undefined;

export const createSession = (initialFrames = 0, initialSeed = 0) => {
  const clock = createFrameClock(initialFrames);
  let screen: Screen = 'title';
  let game: Game | undefined;
  let manager = '';
  let club = 0;
  let level = 1;
  let page = 1;
  let message = '';
  let remaining = 300;
  let resume: Screen = 'manager';
  let changingLevel = false;
  let offer: SaleOffer | undefined;

  const showMessage = (text: string, next: Screen, frames = 0) => {
    message = text;
    screen = 'message';
    resume = next;
    remaining = frames;
  };
  const skipPause = () => {
    if (remaining > 0) {
      remaining = 0;
      screen = resume;
    }
  };
  const advance = (frames: number) => {
    clock.advance(frames);
    if (remaining > 0) {
      remaining = Math.max(0, remaining - frames);
      if (remaining === 0) {
        screen = resume;
      }
    }
  };
  const submit = (text: string): Effect | undefined => {
    if (remaining > 0) {
      return;
    }
    if (screen !== 'manager' && (text === 'h' || text === 'H')) {
      return { type: 'copy' };
    }
    const number = numericInput(text);
    switch (screen) {
      case 'manager':
        if (text.length > 20) {
          showMessage('Name is too long (max 20 chars.)', 'manager', 200);
        } else {
          manager = text;
          screen = 'clubs';
        }
        break;
      case 'clubs':
        if (number === 99) {
          page = (page % 4) + 1;
        } else if (
          number !== undefined &&
          number >= (page - 1) * 16 + 1 &&
          number <= page * 16
        ) {
          club = number;
          changingLevel = false;
          screen = 'level';
        }
        break;
      case 'level':
        if (number !== undefined && number >= 1 && number <= 7) {
          level = number;
          if (changingLevel) {
            game = { ...game!, level };
            showMessage('Your new skill level is -', 'menu');
          } else {
            screen = 'colours';
          }
        } else if (number !== undefined && changingLevel) {
          showMessage('1 TO 7 please!', 'level', 300);
        }
        break;
      case 'colours':
        if (number === undefined) {
          break;
        }
        if (number !== 0 && number !== 7) {
          showMessage('0 or 7 please!', 'colours', 200);
          break;
        }
        game = createNewGame({
          club,
          colour: number,
          level,
          manager,
          seed: initialSeed
        });
        {
          const rng = createRng(game.seed);
          rng.randomize(0, clock.frames);
          game = { ...game, seed: rng.seed };
        }
        screen = 'menu';
        break;
      case 'menu':
        if (isCommand(text, 's')) {
          screen = 'status';
        } else if (isCommand(text, 'a')) {
          screen = 'squad';
        } else if (isCommand(text, 'l')) {
          screen = 'borrow';
        } else if (isCommand(text, 'p')) {
          screen = 'repay';
        } else if (isCommand(text, 'level')) {
          changingLevel = true;
          level = game!.level;
          screen = 'level';
        } else if (
          text === '99' ||
          isCommand(text, 'keep') ||
          isCommand(text, 'change')
        ) {
          return {
            feature:
              text === '99'
                ? 'Match play'
                : isCommand(text, 'keep')
                  ? 'Saving'
                  : 'Name editing',
            type: 'unavailable'
          };
        }
        break;
      case 'status':
        screen = 'menu';
        break;
      case 'squad':
        if (number === 99) {
          screen = 'menu';
        } else if (number !== undefined && game!.players[number - 1]?.status) {
          try {
            offer = makeSaleOffer(game!, number);
            game = offer.game;
            screen = 'sale';
          } catch (error) {
            if (!(error instanceof RangeError)) {
              throw error;
            }
            showMessage(error.message, 'menu');
          }
        }
        break;
      case 'sale': {
        const accepted = isCommand(text, 'yes') || isCommand(text, 'y');
        const name = game!.players[offer!.playerId - 1]!.name;
        game = respondToSale(game!, offer!, accepted);
        if (accepted) {
          showMessage(`${name} has been sold`, 'menu');
        } else {
          screen = 'menu';
        }
        break;
      }
      case 'borrow':
      case 'repay': {
        if (number === undefined) {
          break;
        }
        const retry = screen;
        try {
          game =
            screen === 'borrow' ? borrow(game!, number) : repay(game!, number);
          showMessage('', 'menu');
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }
          showMessage(error.message, retry);
        }
        break;
      }
      case 'message':
        screen = resume;
        break;
      case 'title':
        break;
    }
  };
  return {
    advance,
    get changingLevel() {
      return changingLevel;
    },
    get frames() {
      return clock.frames;
    },
    get game() {
      return game;
    },
    get message() {
      return message;
    },
    get offer() {
      return offer;
    },
    get page() {
      return page;
    },
    get paused() {
      return remaining > 0;
    },
    get screen() {
      return screen;
    },
    skipPause,
    submit
  };
};

export type Session = ReturnType<typeof createSession>;
