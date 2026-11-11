import type { Game } from '../../web/src/sim/management';
import type { Ruleset } from '../../web/src/sim/ruleset';
import { createSession, type View } from '../../web/src/sim/session';
import { createHarnessRng, mixSeed, type HarnessRng } from './random';
import {
  decisionScreens,
  type DecisionView,
  type Strategy
} from './strategies';

export { rulesets, type Ruleset } from '../../web/src/sim/ruleset';

/** How a bot paces itself; the same for every strategy. */
export const timing = {
  /** Frames between an answer becoming possible and Enter being pressed. */
  thinkFrames: [50, 300],
  /** Frames Enter is held after submitting an answer. */
  enterHoldFrames: [3, 8],
  /** Chance of pressing a key to cut each timed pause short. */
  pauseSkipChance: 0.5,
  /** When a skipping bot presses, in frames after the pause starts. */
  pausePressFrames: [1, 150],
  /** Frames a pause-skipping key is held. */
  pauseHoldFrames: [3, 8]
} as const;

/** Screens whose timed waits a keypress can end early. */
const timedScreens: ReadonlySet<View['screen']> = new Set([
  'title',
  'message',
  'highlights',
  'cup-celebration'
]);

export type RunConfig = Readonly<{
  level: number;
  ruleset: Ruleset;
  /** The run ends after this many completed seasons. */
  seasonLimit: number;
  /** The run's seed; timing and strategy streams are derived from it. */
  seed: number;
  strategy: Strategy;
}>;

export type LeagueTally = {
  drawn: number;
  goalsAgainst: number;
  goalsFor: number;
  lost: number;
  won: number;
};

export type SeasonRecord = LeagueTally & {
  cash: number;
  cupRound: number;
  cupWon: boolean;
  debt: number;
  division: number;
  morale: number;
  movement: 'promoted' | 'relegated' | 'stayed';
  points: number;
  position: number;
};

export type RunRecord = Readonly<{
  end: 'dismissed' | 'season-limit';
  final: { cash: number; debt: number; division: number };
  league: LeagueTally;
  level: number;
  matchdays: number;
  peakDebt: number;
  ruleset: Ruleset;
  seasons: readonly SeasonRecord[];
  seed: number;
  strategy: string;
}>;

/** A bot gave an answer the game did not accept, or play stopped moving. */
export class BotError extends Error {
  override name = 'BotError';
}

const maxSteps = 2_000_000;
/**
 * Frames advanced per check while a pause runs. Polling once an emulated
 * second keeps runs fast; the cost is that a bot's wait after a pause can
 * run up to this many frames past its end before think time starts.
 */
export const pauseStep = 50;
const emptyTally = (): LeagueTally => ({
  drawn: 0,
  goalsAgainst: 0,
  goalsFor: 0,
  lost: 0,
  won: 0
});
const between = (rng: HarnessRng, [min, max]: readonly [number, number]) =>
  rng.int(min, max);

/** The answer for screens where play only continues. */
const continueAnswer = (view: View, config: RunConfig) => {
  switch (view.screen) {
    case 'manager':
      return 'bot';
    case 'clubs':
      return '1';
    case 'level':
      return String(config.level);
    case 'colours':
      return '0';
    default:
      return '';
  }
};

/** True when `after` shows that the game turned the answer down. */
const rejected = (before: View, after: View) => {
  if (after.screen === 'selection' && after.error) {
    return after.error;
  }
  if (
    after.screen === 'message' &&
    after.message.kind === 'text' &&
    ['borrow', 'repay', 'squad', 'manager', 'colours', 'level'].includes(
      before.screen
    )
  ) {
    return after.message.text;
  }
  if (
    after.screen === 'message' &&
    after.message.kind === 'text' &&
    after.message.text === "You haven't enough money!"
  ) {
    return after.message.text;
  }
  if (
    before.screen === after.screen &&
    before.game === after.game &&
    (before.screen !== 'clubs' ||
      (after.screen === 'clubs' && before.page === after.page))
  ) {
    return 'nothing changed';
  }
  return undefined;
};

/**
 * Plays one run through the headless session, from the title screen to
 * dismissal or the season limit, pressing keys the way a keyboard player
 * does so that pause skipping and answer timing shape the frame-based
 * reseeds exactly as in real play.
 */
export const playRun = (config: RunConfig): RunRecord => {
  const timingRng = createHarnessRng(mixSeed(config.seed, 1));
  const decide = config.strategy.create(
    createHarnessRng(mixSeed(config.seed, 2))
  );
  const session = createSession(0, 0, config.ruleset);
  const seasons: SeasonRecord[] = [];
  const league = emptyTally();
  let seasonLeague = emptyTally();
  let peakDebt = 0;
  let matchdays = 0;
  let cupWon = false;
  let beforeSeason: Game | undefined;
  let lastGame: Game | undefined;
  let steps = 0;

  const step = () => {
    if (++steps > maxSteps) {
      throw new BotError(
        `${config.strategy.name} stalled on ${session.view.screen}`
      );
    }
  };
  const press = (key: string, frames: number) => {
    session.setKey(key);
    session.advance(frames);
    session.setKey('');
  };
  /** Waits out a pause, sometimes pressing a key partway through. */
  const waitOutPause = () => {
    let episode = '';
    let elapsed = 0;
    let pressAt: number | undefined;
    while (session.view.paused) {
      step();
      const view = session.view;
      const key = `${view.screen}:${view.timingKey ?? ''}`;
      if (key !== episode) {
        episode = key;
        elapsed = 0;
        pressAt =
          timedScreens.has(view.screen) &&
          timingRng.next() < timing.pauseSkipChance
            ? between(timingRng, timing.pausePressFrames)
            : undefined;
      }
      if (pressAt !== undefined && elapsed >= pressAt) {
        pressAt = undefined;
        const hold = between(timingRng, timing.pauseHoldFrames);
        press('Space', hold);
        elapsed += hold;
      } else {
        const frames =
          pressAt === undefined
            ? pauseStep
            : Math.min(pauseStep, pressAt - elapsed);
        session.advance(frames);
        elapsed += frames;
      }
    }
  };
  const observe = (view: View) => {
    if (view.game) {
      lastGame = view.game;
      peakDebt = Math.max(peakDebt, view.game.debt);
    }
    switch (view.screen) {
      case 'result': {
        if (view.fixture.kind !== 'league') {
          break;
        }
        const ours = view.score[view.fixture.home ? 0 : 1]!;
        const theirs = view.score[view.fixture.home ? 1 : 0]!;
        for (const tally of [league, seasonLeague]) {
          tally.goalsFor += ours;
          tally.goalsAgainst += theirs;
          if (ours > theirs) {
            tally.won++;
          } else if (ours < theirs) {
            tally.lost++;
          } else {
            tally.drawn++;
          }
        }
        break;
      }
      case 'bills':
      case 'dismissal':
        matchdays++;
        break;
      case 'cup-result':
        cupWon ||= view.celebration !== undefined;
        break;
      case 'season-table':
        beforeSeason = view.game;
        break;
      case 'season-summary': {
        const before = beforeSeason!;
        const offset = (before.division - 1) * 16;
        const record = before.league[before.club - offset - 1]!;
        const after = view.season.game;
        seasons.push({
          ...seasonLeague,
          cash: before.cash,
          cupRound: before.cupRound,
          cupWon,
          debt: before.debt,
          division: before.division,
          morale: before.morale,
          movement:
            after.division < before.division
              ? 'promoted'
              : after.division > before.division
                ? 'relegated'
                : 'stayed',
          points: record.points,
          position: view.season.finalPosition
        });
        seasonLeague = emptyTally();
        cupWon = false;
        break;
      }
      default:
        break;
    }
  };
  const finish = (end: RunRecord['end']): RunRecord => ({
    end,
    final: {
      cash: lastGame!.cash,
      debt: lastGame!.debt,
      division: lastGame!.division
    },
    league,
    level: config.level,
    matchdays,
    peakDebt,
    ruleset: config.ruleset,
    seasons,
    seed: config.seed,
    strategy: config.strategy.name
  });

  for (;;) {
    waitOutPause();
    step();
    const view = session.view;
    observe(view);
    if (view.screen === 'dismissal') {
      return finish('dismissed');
    }
    if (
      view.screen === 'season-summary' &&
      view.season.game.seasons >= config.seasonLimit
    ) {
      return finish('season-limit');
    }
    const answer = decisionScreens.has(view.screen)
      ? decide(view as DecisionView)
      : continueAnswer(view, config);
    session.advance(between(timingRng, timing.thinkFrames));
    session.setKey('Enter');
    session.submit(answer);
    session.advance(between(timingRng, timing.enterHoldFrames));
    session.setKey('');
    const after = session.view;
    const reason = rejected(view, after);
    if (reason) {
      throw new BotError(
        `${config.strategy.name} answered ${JSON.stringify(answer)} on ${view.screen}: ${reason}`
      );
    }
  }
};
