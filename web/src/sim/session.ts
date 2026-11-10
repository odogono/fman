import {
  prepareCupMatch,
  prepareReplay,
  refreshPlayers,
  settleCupLeg
} from './cup';
import { createFrameClock } from './frame-clock';
import { simulateHighlights } from './highlights';
import {
  completeLeagueMatch,
  nextFixture,
  prepareLeagueMatch,
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
import { completeSeason, type SeasonCompletion } from './season';
import {
  bidForPlayer,
  openTransferMarket,
  type TransferOffer
} from './transfers';

export type Screen =
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
  let season: SeasonCompletion | undefined;
  let cupWon = false;
  let bills: MatchCompletion['bills'] | undefined;
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
      game = {
        ...game!,
        attackCarry: highlights!.carry,
        seed: highlights!.seed
      };
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
          const next = nextFixture(game!);
          if (next === 'season') {
            return {
              feature: 'Season progression',
              type: 'unavailable'
            };
          }
          fixture =
            next === 'league'
              ? prepareLeagueMatch(game!)
              : prepareCupMatch(game!);
          game = fixture.game;
          cupWon = false;
          completion = undefined;
          bills = undefined;
          screen = 'fixture';
        } else if (isCommand(text, 'keep') || isCommand(text, 'change')) {
          return {
            feature: isCommand(text, 'keep') ? 'Saving' : 'Name editing',
            type: 'unavailable'
          };
        }
        break;
      case 'fixture':
        game = refreshPlayers(game!);
        screen = 'team';
        break;
      case 'team':
        if (text === '99') {
          highlights = simulateHighlights({
            awayInk: fixture!.home ? 7 - game!.colour : game!.colour,
            carry: game!.attackCarry,
            home: fixture!.home,
            homeInk: fixture!.home ? game!.colour : 7 - game!.colour,
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
        if (fixture!.kind === 'cup') {
          const result = settleCupLeg(game!, fixture!, highlights!.score);
          game = result.game;
          bills = result.bills;
          cupWon = result.cupWon;
          screen = result.replay
            ? 'replay'
            : cupWon
              ? 'cup-celebration'
              : 'cup-result';
          if (cupWon) {
            remaining = 90;
            resume = 'cup-result';
          }
          break;
        }
        completion = completeLeagueMatch(game!, fixture!, highlights!.score);
        game = completion.game;
        bills = completion.bills;
        screen = 'other-matches';
        break;
      case 'replay':
        fixture = prepareReplay(game!, fixture!);
        screen = 'fixture';
        break;
      case 'cup-result':
        screen = 'bills';
        break;
      case 'cup-celebration':
        break;
      case 'other-matches':
        screen = 'table';
        break;
      case 'table':
        screen = 'bills';
        break;
      case 'bills':
        if (game!.debt > 250_000 * (5 - game!.division)) {
          return { feature: 'Dismissal', type: 'unavailable' };
        }
        if (game!.leagueMatches === 15 && game!.cupFinished) {
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
  return {
    advance,
    get bills() {
      return bills;
    },
    get changingLevel() {
      return changingLevel;
    },
    get completion() {
      return completion;
    },
    get cupCelebrationStep() {
      return cupWon
        ? screen === 'cup-celebration'
          ? Math.min(9, Math.floor((90 - remaining) / 10) + 1)
          : 9
        : 0;
    },
    get cupDisplayKey() {
      return cupWon && (screen === 'cup-celebration' || screen === 'cup-result')
        ? `${this.cupCelebrationStep}:${Math.floor(clock.frames / 16) % 2}`
        : '';
    },
    get cupWon() {
      return cupWon;
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
