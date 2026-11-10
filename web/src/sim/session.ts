import { createFrameClock } from './frame-clock';
import { simulateHighlights } from './highlights';
import {
  completeFirstMatch,
  prepareFirstMatch,
  teamStrength,
  togglePickedPlayer,
  type MatchCompletion,
  type MatchFixture
} from './league';
import {
  borrow,
  createNewGame,
  makeSaleOffer,
  repay,
  respondToSale,
  type Game,
  type SaleOffer
} from './management';
import {
  createPlayback,
  type HighlightResult,
  type Playback
} from './playback';
import { createRng } from './rng';
import {
  bidForPlayer,
  openTransferMarket,
  type TransferOffer
} from './transfers';

export type Screen =
  | 'transfer'
  | 'transfer-result'
  | 'fixture'
  | 'team'
  | 'selection'
  | 'highlights'
  | 'result'
  | 'other-matches'
  | 'table'
  | 'bills'
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
  let fixture: MatchFixture | undefined;
  let highlights: HighlightResult | undefined;
  let playback: Playback | undefined;
  let completion: MatchCompletion | undefined;
  let selectionError = '';
  let transfer: TransferOffer | undefined;
  const returnToManagement = () => {
    const rng = createRng(game!.seed);
    rng.randomize(0, clock.frames);
    game = { ...game!, seed: rng.seed };
    screen = 'menu';
  };
  const finishHighlights = () => {
    if (playback?.done) {
      game = { ...game!, seed: highlights!.seed };
      screen = 'result';
    }
  };

  const showMessage = (text: string, next: Screen, frames = 0) => {
    message = text;
    screen = 'message';
    resume = next;
    remaining = frames;
  };
  const skipPause = () => {
    if (screen === 'highlights') {
      playback!.skipPause();
      finishHighlights();
      return;
    }
    if (remaining > 0) {
      remaining = 0;
      screen = resume;
    }
  };
  const advance = (frames: number) => {
    clock.advance(frames);
    if (screen === 'highlights') {
      playback!.advance(frames);
      finishHighlights();
      return;
    }
    if (remaining > 0) {
      remaining = Math.max(0, remaining - frames);
      if (remaining === 0) {
        screen = resume;
      }
    }
  };
  const submit = (text: string): Effect | undefined => {
    if (remaining > 0 || screen === 'highlights') {
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
        } else if (text === '99') {
          if (game!.leagueMatches > 0) {
            return { feature: 'Next fixture', type: 'unavailable' };
          }
          fixture = prepareFirstMatch(game!);
          game = fixture.game;
          screen = 'fixture';
        } else if (isCommand(text, 'keep') || isCommand(text, 'change')) {
          return {
            feature: isCommand(text, 'keep') ? 'Saving' : 'Name editing',
            type: 'unavailable'
          };
        }
        break;
      case 'fixture':
        screen = 'team';
        break;
      case 'team':
        if (text === '99') {
          highlights = simulateHighlights({
            awayInk: 7 - game!.colour,
            home: true,
            homeInk: game!.colour,
            opponent: fixture!.opponentStrength,
            seed: game!.seed,
            strength: teamStrength(game!)
          });
          playback = createPlayback(highlights);
          screen = 'highlights';
        } else {
          selectionError = '';
          screen = 'selection';
        }
        break;
      case 'selection':
        if (number === undefined) {
          break;
        }
        if (
          number === 99 &&
          game!.players.filter(p => p.status === 2).length <= 11
        ) {
          screen = 'team';
          break;
        }
        selectionError = '';
        try {
          game = togglePickedPlayer(game!, number);
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }
          selectionError = error.message;
        }
        break;
      case 'result':
        completion = completeFirstMatch(game!, fixture!, highlights!.score);
        game = completion.game;
        screen = 'other-matches';
        break;
      case 'other-matches':
        screen = 'table';
        break;
      case 'table':
        screen = 'bills';
        break;
      case 'bills':
        transfer = openTransferMarket(game!);
        if (!transfer) {
          returnToManagement();
          break;
        }
        game = transfer.game;
        screen = transfer.fullSquad ? 'transfer-result' : 'transfer';
        message = transfer.fullSquad
          ? 'You cannot buy a player because you have 16 in your squad - thatis the maximum allowed under    F.A. rules.'
          : '';
        break;
      case 'transfer': {
        if (number === undefined) {
          break;
        }
        const result = bidForPlayer(game!, transfer!.playerId, number);
        game = result.game;
        if (result.outcome === 'declined') {
          returnToManagement();
        } else if (result.outcome === 'joined') {
          message = `${game.players[transfer!.playerId - 1]!.name} has joined your team`;
          screen = 'transfer-result';
        } else {
          showMessage(
            result.outcome === 'refused'
              ? 'YOUR BID IS REFUSED'
              : "You haven't enough money!",
            'transfer'
          );
        }
        break;
      }
      case 'transfer-result':
        returnToManagement();
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
    get completion() {
      return completion;
    },
    get fixture() {
      return fixture;
    },
    get frames() {
      return clock.frames;
    },
    get game() {
      return game;
    },
    get highlights() {
      return highlights;
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
      return remaining > 0 || screen === 'highlights';
    },
    get playback() {
      return playback;
    },
    get screen() {
      return screen;
    },
    get selectionError() {
      return selectionError;
    },
    skipPause,
    submit,
    get transfer() {
      return transfer;
    }
  };
};

export type Session = ReturnType<typeof createSession>;
