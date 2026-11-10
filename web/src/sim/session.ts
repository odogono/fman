import { createFrameClock } from './frame-clock';
import { seasonOver, type MatchCompletion } from './league';
import {
  borrow,
  createNewGame,
  isDismissed,
  makeSaleOffer,
  repay,
  respondToSale,
  type Game,
  type SaleOffer
} from './management';
import { createMatchday, type Matchday } from './matchday';
import { createNameEditor, type NameEditor } from './name-editor';
import { createRng } from './rng';
import { decodeSave, encodeSave } from './save';
import { completeSeason, type SeasonCompletion } from './season';
import {
  bidForPlayer,
  openTransferMarket,
  type TransferOffer
} from './transfers';

export type Screen =
  | 'save-question'
  | 'names'
  | 'dismissal'
  | 'cleared'
  | 'end-season'
  | 'season-table'
  | 'season-summary'
  | 'cup-celebration'
  | 'replay'
  | 'cup-result'
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
  | { type: 'copy' }
  | { data: string; type: 'save' }
  | { feature: string; type: 'unavailable' };

const isCommand = (text: string, command: string) =>
  text === command || text === command.toUpperCase();
const numericInput = (text: string) =>
  /^\d*$/.test(text) && Number.isSafeInteger(Number(`0${text}`))
    ? Number(`0${text}`)
    : undefined;

export const createSession = (initialFrames = 0, initialSeed = 0) => {
  let clock = createFrameClock(initialFrames);
  let setupSeed = initialSeed;
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
  let matchday: Matchday | undefined;
  let season: SeasonCompletion | undefined;
  let nameEditor: NameEditor | undefined;
  let selectionError = '';
  let transfer: TransferOffer | undefined;
  const showBills = () => {
    screen = isDismissed(game!) ? 'dismissal' : 'bills';
  };
  const clearProgram = () => {
    clock = createFrameClock();
    setupSeed = 0;
    screen = 'cleared';
    game = undefined;
    manager = '';
    club = 0;
    level = 1;
    page = 1;
    message = '';
    remaining = 0;
    resume = 'manager';
    changingLevel = false;
    offer = undefined;
    matchday = undefined;
    season = undefined;
    nameEditor = undefined;
    selectionError = '';
    transfer = undefined;
  };
  const returnToManagement = () => {
    const rng = createRng(game!.seed);
    rng.randomize(0, clock.frames);
    game = { ...game!, seed: rng.seed };
    screen = 'menu';
  };
  const play = (step: (matchday: Matchday) => void) => {
    step(matchday!);
    game = matchday!.game;
    if (screen === 'highlights' && matchday!.stage === 'result') {
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
    if (screen === 'cup-celebration') {
      return;
    }
    if (screen === 'highlights') {
      play(m => m.skipPause());
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
      play(m => m.advance(frames));
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
    if (remaining > 0 || screen === 'highlights' || screen === 'cleared') {
      return;
    }
    if (
      screen !== 'manager' &&
      screen !== 'names' &&
      screen !== 'save-question' &&
      (text === 'h' || text === 'H')
    ) {
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
          seed: setupSeed
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
          const next = createMatchday(game!);
          if (!next) {
            return {
              feature: 'Season progression',
              type: 'unavailable'
            };
          }
          matchday = next;
          game = next.game;
          screen = 'fixture';
        } else if (isCommand(text, 'change')) {
          nameEditor = createNameEditor(game!);
          screen = 'names';
        } else if (isCommand(text, 'keep')) {
          return { data: encodeSave(game!, clock.frames), type: 'save' };
        }
        break;
      case 'save-question':
        if (['y', 'Y', 'yes', 'YES'].includes(text)) {
          returnToManagement();
        } else {
          clearProgram();
        }
        break;
      case 'names': {
        const effect = nameEditor!.submit(text);
        game = nameEditor!.game;
        if (nameEditor!.done) {
          nameEditor = undefined;
          screen = 'menu';
        }
        return effect;
      }
      case 'fixture':
        play(m => m.refresh());
        screen = 'team';
        break;
      case 'team':
        if (text === '99') {
          play(m => m.kickOff());
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
          play(m => m.pick(number));
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }
          selectionError = error.message;
        }
        break;
      case 'result': {
        play(m => m.settle());
        const settled = matchday!.settlement;
        if (!settled) {
          screen = 'replay';
        } else if (settled.kind === 'league') {
          screen = 'other-matches';
        } else if (settled.cupWon) {
          screen = 'cup-celebration';
          remaining = 90;
          resume = 'cup-result';
        } else {
          screen = 'cup-result';
        }
        break;
      }
      case 'replay':
        play(m => m.replay());
        screen = 'fixture';
        break;
      case 'cup-result':
        showBills();
        break;
      case 'cup-celebration':
        break;
      case 'other-matches':
        screen = 'table';
        break;
      case 'table':
        showBills();
        break;
      case 'bills':
        if (seasonOver(game!)) {
          screen = 'end-season';
          break;
        }
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
      case 'dismissal':
        clearProgram();
        break;
      case 'end-season':
        screen = 'season-table';
        break;
      case 'season-table':
        season = completeSeason(game!);
        game = season.game;
        screen = 'season-summary';
        break;
      case 'season-summary':
        returnToManagement();
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
  const settlement = () => matchday?.settlement;
  const cupWon = () => {
    const settled = settlement();
    return settled?.kind === 'cup' && settled.cupWon;
  };
  return {
    advance,
    get bills(): MatchCompletion['bills'] | undefined {
      const settled = settlement();
      return settled?.kind === 'cup'
        ? settled.bills
        : settled?.completion.bills;
    },
    get changingLevel() {
      return changingLevel;
    },
    get completion() {
      const settled = settlement();
      return settled?.kind === 'league' ? settled.completion : undefined;
    },
    get cupCelebrationStep() {
      return cupWon()
        ? screen === 'cup-celebration'
          ? Math.min(9, Math.floor((90 - remaining) / 10) + 1)
          : 9
        : 0;
    },
    get cupDisplayKey() {
      return cupWon() &&
        (screen === 'cup-celebration' || screen === 'cup-result')
        ? `${this.cupCelebrationStep}:${Math.floor(clock.frames / 16) % 2}`
        : '';
    },
    get cupWon() {
      return cupWon();
    },
    get fixture() {
      return matchday?.fixture;
    },
    get frames() {
      return clock.frames;
    },
    get game() {
      return game;
    },
    get highlights() {
      return matchday?.highlights;
    },
    load: (data: string) => {
      const saved = decodeSave(data);
      clearProgram();
      clock = createFrameClock(saved.frames);
      game = saved.game;
      returnToManagement();
    },
    get matchday() {
      return matchday;
    },
    get message() {
      return message;
    },
    get nameEditor() {
      return nameEditor;
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
      return matchday?.playback;
    },
    reload: () => {
      if (screen !== 'cleared') {
        return false;
      }
      screen = 'title';
      remaining = 300;
      resume = 'manager';
      return true;
    },
    saved: () => {
      if (screen !== 'menu' || !game) {
        return false;
      }
      screen = 'save-question';
      return true;
    },
    get screen() {
      return screen;
    },
    get season() {
      return season;
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
