import { beepRegisters, beeperT, type SoundEvent } from './beeper';
import { createFrameClock, framePeriod, spectrumFrameT } from './frame-clock';
import { seasonOver, type MatchCompletion, type MatchFixture } from './league';
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
import { screenPrintFault } from './name-print-fault';
import { createPauseKeyboard, type PauseKeyboardState } from './pause-keyboard';
import type { Playback } from './playback';
import { createRng } from './rng';
import { decodeSave, encodeSave } from './save';
import { completeSeason, type SeasonCompletion } from './season';
import {
  cupPlayback,
  errorPlayback,
  titlePlayback,
  type TimedScreen
} from './timed-screens';
import { createTimeline } from './timeline';
import {
  bidForPlayer,
  openTransferMarket,
  type TransferOffer
} from './transfers';

/** What a message screen shows; the original prints each kind differently. */
export type Message =
  | { kind: 'text'; text: string }
  /** The new level, after "Your new skill level is -". */
  | { kind: 'skill-level'; level: number }
  /** The club's cash and debt, after a loan or repayment. */
  | { cash: number; debt: number; kind: 'balance' };

type Bills = NonNullable<MatchCompletion['bills']>;

/** One variant per screen in `S`, each with data `D`. */
type Each<S extends string, D> = S extends unknown ? D & { screen: S } : never;

/** Each screen with the data it shows. Screens before a game exists have no `game`. */
export type ScreenView =
  | Each<'title' | 'cleared' | 'manager' | 'colours', { game?: undefined }>
  | { game?: undefined; page: number; screen: 'clubs' }
  | { changing: false; game?: undefined; screen: 'level' }
  | { changing: true; game: Game; screen: 'level' }
  | { game?: Game; message: Message; screen: 'message' }
  | Each<
      | 'save-question'
      | 'menu'
      | 'status'
      | 'squad'
      | 'borrow'
      | 'repay'
      | 'replay'
      | 'end-season'
      | 'season-table',
      { game: Game }
    >
  | { game: Game; nameEditor: NameEditor; screen: 'names' }
  | Each<'bills' | 'dismissal', { bills: Bills; game: Game }>
  | Each<'fixture' | 'team', { fixture: MatchFixture; game: Game }>
  | { error: string; fixture: MatchFixture; game: Game; screen: 'selection' }
  | {
      fixture: MatchFixture;
      game: Game;
      playback: Playback;
      screen: 'highlights';
    }
  | {
      fixture: MatchFixture;
      game: Game;
      score: readonly number[];
      screen: 'result';
    }
  | Each<
      'cup-celebration' | 'cup-result',
      {
        /** The trophy's star rows shown so far, 0 to 9, when the cup was won. */
        celebration: number | undefined;
        celebrationProgress?: { stars: number; text: number; trophy: number };
        game: Game;
      }
    >
  | Each<'other-matches' | 'table', { completion: MatchCompletion; game: Game }>
  | { game: Game; screen: 'season-summary'; season: SeasonCompletion }
  | { game: Game; offer: SaleOffer; screen: 'sale' }
  | { game: Game; playerId: number; screen: 'transfer' }
  | { fullSquad: boolean; game: Game; screen: 'transfer-result'; text: string };

/** The session as the player sees it: the screen, its data, and the clock. */
export type View = ScreenView & {
  frames: number;
  /** A timed pause or highlights are running; input waits. */
  paused: boolean;
  printed?: number;
  printFault?: string;
  timingKey?: number;
  ulaFrames?: number;
};

export type Screen = ScreenView['screen'];

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

/** Everything a fresh program holds; NEW replaces it wholesale. */
const freshProgram = (frames = 0, seed = 0) => ({
  changingLevel: false,
  clock: createFrameClock(frames),
  club: 0,
  game: undefined as Game | undefined,
  keyboard: createPauseKeyboard(),
  level: 1,
  manager: '',
  matchday: undefined as Matchday | undefined,
  message: { kind: 'text', text: '' } as Message,
  nameEditor: undefined as NameEditor | undefined,
  offer: undefined as SaleOffer | undefined,
  page: 1,
  promptSound: undefined as ReturnType<typeof createTimeline> | undefined,
  resume: 'manager' as Screen,
  screen: 'title' as Screen,
  season: undefined as SeasonCompletion | undefined,
  selectionError: '',
  setupSeed: seed,
  timed: undefined as TimedScreen | undefined,
  transfer: undefined as TransferOffer | undefined,
  transferText: '',
  ulaFrames: frames
});

export const createSession = (initialFrames = 0, initialSeed = 0) => {
  let program = freshProgram(initialFrames, initialSeed);
  let soundTimeT = 0;
  let soundGeneration = 0;
  const promptScreens = new Set<Screen>([
    'menu',
    'status',
    'squad',
    'fixture',
    'team',
    'selection',
    'result',
    'other-matches',
    'table',
    'bills',
    'dismissal',
    'replay',
    'cup-result',
    'end-season',
    'season-table',
    'season-summary',
    'transfer',
    'transfer-result',
    'message'
  ]);
  const promptSound = (phase = program.ulaFrames * spectrumFrameT) => {
    if (
      !promptScreens.has(program.screen) ||
      screenPrintFault(screenView()) ||
      (program.timed && !program.timed.done) ||
      (program.screen === 'selection' &&
        program.game!.players.filter(player => player.status === 2).length > 11)
    ) {
      return;
    }
    const tone = { duration: 0.2, pitch: 0 };
    const { de, hl } = beepRegisters(tone.duration, tone.pitch);
    program.promptSound = createTimeline(
      [
        {
          duration: beeperT(hl, de, phase) / spectrumFrameT,
          interrupts: false,
          tones: [tone]
        }
      ],
      program.keyboard,
      undefined,
      phase
    );
  };
  program.timed = titlePlayback(program.keyboard);
  const showBills = () => {
    program.screen = isDismissed(program.game!) ? 'dismissal' : 'bills';
  };
  const clearProgram = () => {
    program = { ...freshProgram(), screen: 'cleared' };
  };
  const returnToManagement = () => {
    const rng = createRng(program.game!.seed);
    rng.randomize(0, program.clock.frames);
    program.game = { ...program.game!, seed: rng.seed };
    program.screen = 'menu';
  };
  const play = (step: (matchday: Matchday) => void) => {
    step(program.matchday!);
    program.game = program.matchday!.game;
    if (
      program.screen === 'highlights' &&
      program.matchday!.stage === 'result'
    ) {
      program.screen = 'result';
    }
  };

  const showMessage = (message: Message | string, next: Screen, frames = 0) => {
    program.message =
      typeof message === 'string' ? { kind: 'text', text: message } : message;
    program.screen = 'message';
    program.resume = next;
    program.timed =
      frames > 0
        ? errorPlayback(
            program.keyboard,
            typeof message === 'string' ? message : '',
            frames
          )
        : undefined;
  };
  const finishTimed = () => {
    if (program.timed?.done) {
      program.screen = program.resume;
    }
  };
  const skipPause = () => {
    if (program.screen === 'cup-celebration') {
      return;
    }
    if (program.screen === 'highlights') {
      play(m => m.skipPause());
      if (program.matchday!.stage === 'result') {
        promptSound(program.matchday!.playback!.elapsedT % spectrumFrameT);
      }
      return;
    }
    if (program.timed && !program.timed.done) {
      const paused = program.timed.current?.kind === 'pause';
      program.timed.skipPause();
      if (paused) {
        program.screen = program.resume;
        program.timed = undefined;
      }
      return;
    }
  };
  const advance = (frames: number) => {
    // Validate before changing either the playback or the ULA counter.
    if (
      !Number.isSafeInteger(frames * spectrumFrameT) ||
      frames < 0 ||
      !Number.isInteger(frames)
    ) {
      throw new RangeError('Invalid frame advance');
    }
    program.ulaFrames =
      (program.ulaFrames + (frames % framePeriod)) % framePeriod;
    let left = frames * spectrumFrameT;
    let missed = 0;
    let phase = soundTimeT % spectrumFrameT;
    const timeline =
      program.screen === 'highlights'
        ? program.matchday!.playback
        : program.timed && !program.timed.done
          ? program.timed
          : undefined;
    if (timeline && !(program.promptSound && !program.promptSound.done)) {
      const played =
        program.screen === 'highlights'
          ? program.matchday!.advanceWithinT(left)
          : timeline.advanceWithinT(left);
      missed += played.missed;
      soundTimeT += played.usedT;
      left -= played.usedT;
      phase = timeline.elapsedT % spectrumFrameT;
      if (program.screen === 'highlights') {
        program.game = program.matchday!.game;
        if (program.matchday!.stage === 'result') {
          program.screen = 'result';
        }
      } else {
        finishTimed();
      }
      if (timeline.done) {
        promptSound(phase);
      }
    }
    if (program.promptSound && !program.promptSound.done) {
      missed += program.promptSound.advanceT(left);
    } else {
      program.keyboard.advance(Math.floor((phase + left) / spectrumFrameT));
    }
    soundTimeT += left;
    program.clock.advance(frames - missed);
  };

  const accept = (text: string): Effect | undefined => {
    if (
      (program.promptSound && !program.promptSound.done) ||
      (program.timed && !program.timed.done) ||
      program.screen === 'highlights' ||
      program.screen === 'cleared'
    ) {
      return;
    }
    if (
      program.screen !== 'manager' &&
      program.screen !== 'names' &&
      program.screen !== 'save-question' &&
      (text === 'h' || text === 'H')
    ) {
      return { type: 'copy' };
    }
    const number = numericInput(text);
    switch (program.screen) {
      case 'manager':
        if (text.length > 20) {
          showMessage('Name is too long (max 20 chars.)', 'manager', 200);
        } else {
          program.manager = text;
          program.screen = 'clubs';
        }
        break;
      case 'clubs':
        if (number === 99) {
          program.page = (program.page % 4) + 1;
        } else if (
          number !== undefined &&
          number >= (program.page - 1) * 16 + 1 &&
          number <= program.page * 16
        ) {
          program.club = number;
          program.changingLevel = false;
          program.screen = 'level';
        }
        break;
      case 'level':
        if (number !== undefined && number >= 1 && number <= 7) {
          program.level = number;
          if (program.changingLevel) {
            program.game = { ...program.game!, level: program.level };
            showMessage({ kind: 'skill-level', level: program.level }, 'menu');
          } else {
            program.screen = 'colours';
          }
        } else if (number !== undefined && program.changingLevel) {
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
        program.game = createNewGame({
          club: program.club,
          colour: number,
          level: program.level,
          manager: program.manager,
          seed: program.setupSeed
        });
        {
          const rng = createRng(program.game.seed);
          rng.randomize(0, program.clock.frames);
          program.game = { ...program.game, seed: rng.seed };
        }
        program.screen = 'menu';
        break;
      case 'menu':
        if (isCommand(text, 's')) {
          program.screen = 'status';
        } else if (isCommand(text, 'a')) {
          program.screen = 'squad';
        } else if (isCommand(text, 'l')) {
          program.screen = 'borrow';
        } else if (isCommand(text, 'p')) {
          program.screen = 'repay';
        } else if (isCommand(text, 'level')) {
          program.changingLevel = true;
          program.level = program.game!.level;
          program.screen = 'level';
        } else if (text === '99') {
          const next = createMatchday(program.game!, program.keyboard);
          if (!next) {
            return {
              feature: 'Season progression',
              type: 'unavailable'
            };
          }
          program.matchday = next;
          program.game = next.game;
          program.screen = 'fixture';
        } else if (isCommand(text, 'change')) {
          program.nameEditor = createNameEditor(program.game!);
          program.screen = 'names';
        } else if (isCommand(text, 'keep')) {
          return {
            data: encodeSave(program.game!, program.clock.frames),
            type: 'save'
          };
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
        const effect = program.nameEditor!.submit(text);
        program.game = program.nameEditor!.game;
        if (program.nameEditor!.done) {
          program.nameEditor = undefined;
          program.screen = 'menu';
        }
        return effect;
      }
      case 'fixture':
        play(m => m.refresh());
        program.screen = 'team';
        break;
      case 'team':
        if (text === '99') {
          play(m => m.kickOff());
          program.screen = 'highlights';
        } else {
          program.selectionError = '';
          program.screen = 'selection';
        }
        break;
      case 'selection':
        if (number === undefined) {
          break;
        }
        if (
          number === 99 &&
          program.game!.players.filter(player => player.status === 2).length <=
            11
        ) {
          program.screen = 'team';
          break;
        }
        program.selectionError = '';
        try {
          play(m => m.pick(number));
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }
          program.selectionError = error.message;
        }
        break;
      case 'result': {
        play(m => m.settle());
        const settled = program.matchday!.settlement;
        if (!settled) {
          program.screen = 'replay';
        } else if (settled.kind === 'league') {
          program.screen = 'other-matches';
        } else if (settled.cupWon) {
          program.screen = 'cup-celebration';
          program.timed = cupPlayback(program.keyboard);
          program.resume = 'cup-result';
        } else {
          program.screen = 'cup-result';
        }
        break;
      }
      case 'replay':
        play(m => m.replay());
        program.screen = 'fixture';
        break;
      case 'cup-result':
        showBills();
        break;
      case 'cup-celebration':
        break;
      case 'other-matches':
        program.screen = 'table';
        break;
      case 'table':
        showBills();
        break;
      case 'bills':
        if (seasonOver(program.game!)) {
          program.screen = 'end-season';
          break;
        }
        program.transfer = openTransferMarket(program.game!);
        if (!program.transfer) {
          returnToManagement();
          break;
        }
        program.game = program.transfer.game;
        program.screen = program.transfer.fullSquad
          ? 'transfer-result'
          : 'transfer';
        program.transferText = program.transfer.fullSquad
          ? 'You cannot buy a player because you have 16 in your squad - thatis the maximum allowed under    F.A. rules.'
          : '';
        break;
      case 'dismissal':
        clearProgram();
        break;
      case 'end-season':
        program.screen = 'season-table';
        break;
      case 'season-table':
        program.season = completeSeason(program.game!);
        program.game = program.season.game;
        program.screen = 'season-summary';
        break;
      case 'season-summary':
        returnToManagement();
        break;
      case 'transfer': {
        if (number === undefined) {
          break;
        }
        const result = bidForPlayer(
          program.game!,
          program.transfer!.playerId,
          number
        );
        program.game = result.game;
        if (result.outcome === 'declined') {
          returnToManagement();
        } else if (result.outcome === 'joined') {
          program.transferText = `${program.game.players[program.transfer!.playerId - 1]!.name.padEnd(8)} has joined your team`;
          program.screen = 'transfer-result';
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
        program.screen = 'menu';
        break;
      case 'squad':
        if (number === 99) {
          program.screen = 'menu';
        } else if (
          number !== undefined &&
          program.game!.players[number - 1]?.status
        ) {
          try {
            program.offer = makeSaleOffer(program.game!, number);
            program.game = program.offer.game;
            program.screen = 'sale';
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
        const name =
          program.game!.players[program.offer!.playerId - 1]!.name.padEnd(8);
        program.game = respondToSale(program.game!, program.offer!, accepted);
        if (accepted) {
          showMessage(`${name} has been sold`, 'menu');
        } else {
          program.screen = 'menu';
        }
        break;
      }
      case 'borrow':
      case 'repay': {
        if (number === undefined) {
          break;
        }
        const retry = program.screen;
        try {
          program.game =
            program.screen === 'borrow'
              ? borrow(program.game!, number)
              : repay(program.game!, number);
          showMessage(
            {
              cash: program.game.cash,
              debt: program.game.debt,
              kind: 'balance'
            },
            'menu'
          );
        } catch (error) {
          if (!(error instanceof RangeError)) {
            throw error;
          }
          showMessage(error.message, retry);
        }
        break;
      }
      case 'message':
        program.screen = program.resume;
        break;
      case 'title':
        break;
    }
  };
  const submit = (text: string): Effect | undefined => {
    if (screenPrintFault(screenView())) {
      return;
    }
    if (program.promptSound && !program.promptSound.done) {
      return;
    }
    const before = program.screen;
    const effect = accept(text);
    if (
      before !== program.screen ||
      (program.screen === 'selection' && !program.selectionError && !effect) ||
      (before === 'menu' && program.screen === 'menu' && !effect)
    ) {
      soundGeneration++;
      promptSound();
    } else if (
      effect?.type === 'copy' &&
      promptScreens.has(before) &&
      !['menu', 'squad', 'team', 'selection', 'transfer'].includes(before)
    ) {
      promptSound();
    }
    return effect;
  };
  const settlement = () => program.matchday?.settlement;
  const screenView = (): ScreenView => {
    const { game, matchday, screen } = program;
    if (!game) {
      switch (screen) {
        case 'clubs':
          return { page: program.page, screen };
        case 'level':
          return { changing: false, screen };
        case 'message':
          return { message: program.message, screen };
        case 'title':
        case 'cleared':
        case 'manager':
        case 'colours':
          return { screen };
      }
      throw new Error(`Screen ${screen} needs a game`);
    }
    const settled = settlement();
    switch (screen) {
      case 'title':
      case 'cleared':
      case 'manager':
      case 'colours':
      case 'clubs':
        throw new Error(`Screen ${screen} comes before a game`);
      case 'level':
        return { changing: true, game, screen };
      case 'message':
        return { game, message: program.message, screen };
      case 'save-question':
      case 'menu':
      case 'status':
      case 'squad':
      case 'borrow':
      case 'repay':
      case 'replay':
      case 'end-season':
      case 'season-table':
        return { game, screen };
      case 'names':
        return { game, nameEditor: program.nameEditor!, screen };
      case 'bills':
      case 'dismissal':
        return {
          bills:
            settled!.kind === 'cup'
              ? settled!.bills
              : settled!.completion.bills!,
          game,
          screen
        };
      case 'fixture':
      case 'team':
        return { fixture: matchday!.fixture, game, screen };
      case 'selection':
        return {
          error: program.selectionError,
          fixture: matchday!.fixture,
          game,
          screen
        };
      case 'highlights':
        return {
          fixture: matchday!.fixture,
          game,
          playback: matchday!.playback!,
          screen
        };
      case 'result':
        return {
          fixture: matchday!.fixture,
          game,
          score: matchday!.highlights!.score,
          screen
        };
      case 'cup-celebration':
      case 'cup-result':
        return {
          celebration:
            settled?.kind === 'cup' && settled.cupWon
              ? screen === 'cup-celebration'
                ? Math.ceil((program.timed?.progress.stars ?? 0) / 32)
                : 9
              : undefined,
          ...(screen === 'cup-celebration'
            ? { celebrationProgress: program.timed!.progress }
            : {}),
          game,
          screen
        };
      case 'other-matches':
      case 'table':
        if (settled?.kind !== 'league') {
          throw new Error(`Screen ${screen} needs a league result`);
        }
        return { completion: settled.completion, game, screen };
      case 'season-summary':
        return { game, screen, season: program.season! };
      case 'sale':
        return { game, offer: program.offer!, screen };
      case 'transfer':
        return { game, playerId: program.transfer!.playerId, screen };
      case 'transfer-result':
        return {
          fullSquad: program.transfer!.fullSquad,
          game,
          screen,
          text: program.transferText
        };
    }
  };
  const paused = () =>
    (program.promptSound !== undefined && !program.promptSound.done) ||
    (program.timed !== undefined && !program.timed.done) ||
    program.screen === 'highlights';
  return {
    advance,
    load: (data: string) => {
      const saved = decodeSave(data);
      clearProgram();
      program.clock = createFrameClock(saved.frames);
      program.ulaFrames = saved.frames;
      program.game = saved.game;
      returnToManagement();
    },
    reload: () => {
      if (program.screen !== 'cleared') {
        return false;
      }
      program.screen = 'title';
      program.timed = titlePlayback(program.keyboard);
      program.resume = 'manager';
      return true;
    },
    /** Puts an already reseeded game at the management menu. */
    resumeMenu: (
      frames: number,
      resumed: Game,
      ulaFrames = frames,
      keyboard?: PauseKeyboardState
    ) => {
      const next = createFrameClock(frames);
      clearProgram();
      program.clock = next;
      program.ulaFrames = ulaFrames;
      program.keyboard = createPauseKeyboard(keyboard);
      program.game = resumed;
      program.screen = 'menu';
    },
    saved: () => {
      if (program.screen !== 'menu' || !program.game) {
        return false;
      }
      program.screen = 'save-question';
      return true;
    },
    setKey: (key: string) => program.keyboard.set(key),
    skipPause,
    get sounds(): readonly SoundEvent[] {
      const timeline =
        program.screen === 'highlights'
          ? program.matchday?.playback
          : program.promptSound && !program.promptSound.done
            ? program.promptSound
            : program.timed && !program.timed.done
              ? program.timed
              : undefined;
      if (!timeline) {
        return [];
      }
      const prompt = timeline === program.promptSound;
      const events = timeline.sounds.map(sound => ({
        de: sound.de,
        hl: sound.hl,
        id: `${soundGeneration}:${prompt ? 'prompt' : `timeline:${sound.index}`}`,
        phaseT: sound.t,
        startT: soundTimeT + sound.t - timeline.elapsedT
      }));
      if (
        !prompt &&
        (program.screen === 'highlights' ||
          program.screen === 'cup-celebration')
      ) {
        events.push({
          ...beepRegisters(0.2, 0),
          id: `${soundGeneration}:prompt`,
          phaseT: timeline.endT % spectrumFrameT,
          startT: soundTimeT + timeline.remainingT
        });
      }
      return events;
    },
    get soundTimeT() {
      return soundTimeT;
    },
    submit,
    get timingState() {
      return { keyboard: program.keyboard.state, ulaFrames: program.ulaFrames };
    },
    /** The current screen and its data, as a plain value. */
    get view(): View {
      const screen = screenView();
      const fault = screenPrintFault(screen);
      return {
        ...screen,
        ...(fault ? { printFault: fault } : {}),
        ...(program.timed &&
        ['title', 'message', 'cup-celebration'].includes(program.screen)
          ? {
              printed: program.timed.progress.text,
              timingKey: program.timed.index
            }
          : {}),
        ...(screen.game && screen.screen !== 'menu'
          ? { ulaFrames: program.ulaFrames }
          : {}),
        frames: program.clock.frames,
        paused: paused() || Boolean(fault)
      };
    }
  };
};

export type Session = ReturnType<typeof createSession>;
