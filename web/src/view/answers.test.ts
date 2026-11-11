import { expect, test } from 'bun:test';

import { createJournal, openSave, type Journal } from '../sim/journal';
import {
  createSession,
  type Effect,
  type Screen,
  type Session,
  type View
} from '../sim/session';
import { viewOn } from '../sim/view-on';
import { finishPrompt, submitInput } from '../test/input';
import { answersFor, tapAnswer, type OfferedAnswer } from './answers';
import { barFor } from './context-bar';

/** A short description of where an answer led, to compare with the table. */
const outcome = (view: View, effect: Effect | undefined) => {
  if (effect) {
    return `effect:${effect.type}`;
  }
  switch (view.screen) {
    case 'clubs':
      return `clubs:${view.page}`;
    case 'message':
      return `message:${view.message.kind}`;
    case 'selection':
      return `selection:${view.pickedCount}${view.error ? `:${view.error}` : ''}`;
    case 'names': {
      const editor = view.nameEditor;
      return `names:${editor.phase}:${editor.kind}:${editor.page}`;
    }
    default:
      return view.screen;
  }
};

const sampleText: Record<string, string> = {
  'manager.name': 'alex',
  'names.name': 'Ace'
};

/** The view, narrowed to `screen`; throws when it shows another. */
const narrow = <S extends Screen>(view: View, screen: S) => {
  if (view.screen !== screen) {
    throw new Error(`View shows ${view.screen}, not ${screen}`);
  }
  return view as Extract<View, { screen: S }>;
};

/** What each offered answer does, from the answer table in #41. */
const expected = (answer: OfferedAnswer, view: View): string | string[] => {
  const n = Number(/\d+$/.exec(answer.id)?.[0]);
  const key = answer.id.replace(/\.\d+$/, '.#');
  const names = view.screen === 'names' ? view.nameEditor : undefined;
  const table: Record<string, () => string | string[]> = {
    'bills.continue': () => ['end-season', 'transfer', 'transfer-result'],
    'borrow.amount': () => 'message:balance',
    'borrow.cancel': () => 'message:balance',
    'clubs.club.#': () => 'level',
    'clubs.next-page': () => `clubs:${(narrow(view, 'clubs').page % 4) + 1}`,
    'colours.black': () => 'menu',
    'colours.white': () => 'menu',
    'cup-result.continue': () => 'bills',
    'dismissal.continue': () => 'cleared',
    'end-season.continue': () => 'season-table',
    'fixture.continue': () => 'team',
    'level.#': () =>
      narrow(view, 'level').changing ? 'message:skill-level' : 'colours',
    'manager.name': () => 'clubs:1',
    'menu.borrow': () => 'borrow',
    'menu.change': () => 'names:question:club:1',
    'menu.keep': () => 'effect:save',
    'menu.level': () => 'level',
    'menu.play': () => 'fixture',
    'menu.repay': () => 'repay',
    'menu.squad': () => 'squad',
    'menu.status': () => 'status',
    // A message returns to whichever prompt showed it.
    'message.continue': () => [
      'menu',
      'transfer',
      'level',
      'manager',
      'colours',
      'borrow',
      'repay'
    ],
    'names.club.#': () => 'names:name:club:' + names!.page,
    'names.name': () => `names:more:${names!.kind}:${names!.page}`,
    'names.next-page': () =>
      `names:list:${names!.kind}:${(names!.page % (names!.kind === 'club' ? 4 : 3)) + 1}`,
    'names.no': () =>
      names!.kind === 'club' ? 'names:question:player:1' : 'menu',
    'names.player.#': () => 'names:name:player:' + names!.page,
    'names.yes': () =>
      `names:list:${names!.kind}:${names!.phase === 'question' ? 1 : names!.page}`,
    'other-matches.continue': () => 'table',
    'repay.amount': () => 'message:balance',
    'repay.cancel': () => 'message:balance',
    'replay.continue': () => 'fixture',
    'result.continue': () => [
      'replay',
      'other-matches',
      'cup-result',
      'cup-celebration'
    ],
    'sale.no': () => 'menu',
    'sale.yes': () => 'message:text',
    'save-question.no': () => 'cleared',
    'save-question.yes': () => 'menu',
    'season-summary.continue': () => 'menu',
    'season-table.continue': () => 'season-summary',
    'selection.done': () => 'team',
    'selection.player.#': () => {
      const count = narrow(view, 'selection').pickedCount;
      return `selection:${count > 11 ? count - 1 : count + 1}`;
    },
    'squad.back': () => 'menu',
    'squad.player.#': () =>
      view.game!.players[n - 1]!.status === 3 ? 'message:text' : 'sale',
    'status.continue': () => 'menu',
    'table.continue': () => 'bills',
    'team.change': () => `selection:${narrow(view, 'team').pickedCount}`,
    'team.kick-off': () => 'highlights',
    'transfer-result.continue': () => 'menu',
    // The largest bid the club can afford: refused or accepted, never short.
    'transfer.bid': () => ['message:text', 'transfer-result'],
    'transfer.decline': () => 'menu'
  };
  const want = table[key];
  if (!want) {
    throw new Error(`No expected outcome for ${answer.id}`);
  }
  return want();
};

/** The parts of a view an ignored answer must leave alone. */
const shown = (view: View) => {
  const { frames: _frames, paused: _paused, ulaFrames: _ula, ...rest } = view;
  return JSON.stringify(rest);
};

/** Taps an answer; an amount goes in at its largest, or at `amount`. */
const tap = (journal: Journal, answer: OfferedAnswer, amount?: number) => {
  const effect =
    answer.kind === 'choice'
      ? tapAnswer(journal, answer)
      : tapAnswer(
          journal,
          answer,
          answer.kind === 'amount'
            ? String(amount ?? answer.max)
            : sampleText[answer.id]!
        );
  journal.setKey('');
  finishPrompt(journal);
  return outcome(journal.session.view, effect);
};

const visited = new Set<Screen>();

/**
 * Taps every offered answer on a copy of the journal and checks it does what
 * the table says; then checks an unlisted answer is ignored or matches one.
 */
const probe = (journal: Journal) => {
  finishPrompt(journal);
  const view = journal.session.view;
  visited.add(view.screen);
  const answers = answersFor(view);
  // Classic mode's bar has a label for every offered answer.
  expect(barFor(answers)).toHaveLength(answers.length);
  if (view.paused) {
    expect(answers).toEqual([]);
    return;
  }
  expect(new Set(answers.map(a => a.id)).size).toBe(answers.length);
  const outcomes = answers.map(answer => {
    const got = tap(openSave(journal.snapshot()), answer);
    const wants = [expected(answer, view)].flat();
    expect(`${answer.id} → ${wants.includes(got) ? 'as listed' : got}`).toBe(
      `${answer.id} → as listed`
    );
    if (answer.kind === 'amount') {
      // One past the range ends on one of the original's errors.
      const over = openSave(journal.snapshot());
      tap(over, answer, answer.max + 1);
      const message = narrow(over.session.view, 'message').message;
      expect(message.kind === 'text' ? message.text : '').toMatch(
        /credit limit|DON'T OWE|haven't enough/
      );
    }
    return got;
  });
  const copy = openSave(journal.snapshot());
  const got = tap(copy, { id: 'unlisted', kind: 'choice', text: 'zz' });
  const ignored = shown(copy.session.view) === shown(view);
  expect(
    ignored || outcomes.includes(got)
      ? 'ignored or listed'
      : `${view.screen}: zz → ${got}`
  ).toBe('ignored or listed');
};

const play = (journal: Journal, inputs: readonly string[]) => {
  for (const input of inputs) {
    submitInput(journal, input);
  }
};

/** A journal at the menu of the game the session tests set up. */
const atMenu = () => {
  const session: Session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  for (const input of ['alex', '1', '1', '0']) {
    submitInput(session, input);
  }
  const view = viewOn(session, 'menu');
  return createJournal({
    frames: view.frames,
    game: view.game,
    kind: 'menu',
    ...session.timingState
  });
};

test('setup prompts offer the clubs, levels and colours the original accepts', () => {
  const journal = createJournal();
  journal.advance(5);
  probe(journal);
  expect(journal.session.view.screen).toBe('title');
  journal.advance(400);
  probe(journal);
  play(journal, ['alex']);
  probe(journal);
  play(journal, ['99']);
  probe(journal);
  play(journal, ['17']);
  probe(journal);
  play(journal, ['1']);
  probe(journal);
  play(journal, ['0']);
  probe(journal);
  expect(journal.session.view.screen).toBe('menu');
});

test('management prompts offer the menu, squad, loans, level and names', () => {
  const journal = atMenu();
  play(journal, ['s']);
  probe(journal);
  play(journal, ['', 'a']);
  probe(journal);
  const seller = journal.session.view.game!.players.find(p => p.status === 1)!;
  play(journal, [String(seller.id)]);
  probe(journal);
  play(journal, ['n', 'l']);
  probe(journal);
  play(journal, ['1000']);
  probe(journal);
  play(journal, ['', 'p']);
  probe(journal);
  play(journal, ['0', '', 'level']);
  probe(journal);
  play(journal, ['1']);
  probe(journal);
  play(journal, ['', 'change']);
  probe(journal);
  for (const input of ['y', '99', '17', 'Ace', 'n', 'y', '1', 'Bob']) {
    play(journal, [input]);
    probe(journal);
  }
  play(journal, ['n']);
  expect(journal.session.view.screen).toBe('menu');
  expect(journal.saved()).toBe(true);
  probe(journal);
});

test('a league matchday offers the picks, results and transfer answers', () => {
  const journal = atMenu();
  play(journal, ['99']);
  probe(journal);
  play(journal, ['']);
  probe(journal);
  play(journal, ['c']);
  probe(journal);
  const reserve = journal.session.view.game!.players.find(p => p.status === 1)!;
  play(journal, [String(reserve.id)]);
  probe(journal);
  play(journal, [String(reserve.id), '99', '99']);
  probe(journal);
  expect(journal.session.view.screen).toBe('highlights');
  journal.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    probe(journal);
    play(journal, ['']);
  }
  probe(journal);
  expect(journal.session.view.screen).toBe('transfer');
  play(journal, ['0']);
  probe(journal);
  play(journal, ['']);
  play(journal, [String(journal.session.view.game!.cash)]);
  probe(journal);
  expect(journal.session.view.screen).toBe('transfer-result');
});

test('a drawn cup round offers its replay', () => {
  const journal = atMenu();
  play(journal, ['99', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['', '', '', '']);
  journal.advance((65_536 - (journal.session.view.frames % 65_536)) % 65_536);
  play(journal, ['99', '99', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['']);
  probe(journal);
  expect(journal.session.view.screen).toBe('replay');
  play(journal, ['', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['']);
  probe(journal);
  expect(journal.session.view.screen).toBe('cup-result');
});

test('a club beyond the debt cap is offered only the way out', () => {
  const journal = atMenu();
  play(journal, ['l', '250000', '', '99', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['', '', '', '']);
  play(journal, [String(journal.session.view.game!.cash)]);
  journal.advance((65_537 - (journal.session.view.frames % 65_536)) % 65_536);
  play(journal, ['', '99', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['', '']);
  probe(journal);
  expect(journal.session.view.screen).toBe('dismissal');
  play(journal, ['']);
  probe(journal);
  expect(journal.session.view.screen).toBe('cleared');
});

test('the season boundary offers its continues', () => {
  const journal = atMenu();
  play(journal, ['99', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['', '', '', '']);
  journal.advance((65_537 - (journal.session.view.frames % 65_536)) % 65_536);
  play(journal, ['99', '99', '', '99']);
  journal.advance(1_000_000);
  play(journal, ['', '', '', '99']);
  for (let match = 2; match <= 15; match++) {
    play(journal, ['99', '', '99']);
    journal.advance(1_000_000);
    play(journal, ['', '', '']);
    if (match < 15) {
      play(journal, ['', '99']);
    }
  }
  for (let i = 0; i < 3; i++) {
    play(journal, ['']);
    probe(journal);
  }
  expect(journal.session.view.screen).toBe('season-summary');
});

test('every screen with a prompt was probed', () => {
  const screens: Screen[] = [
    'title',
    'manager',
    'clubs',
    'level',
    'colours',
    'menu',
    'status',
    'squad',
    'sale',
    'borrow',
    'repay',
    'message',
    'names',
    'save-question',
    'fixture',
    'team',
    'selection',
    'highlights',
    'result',
    'replay',
    'cup-result',
    'other-matches',
    'table',
    'bills',
    'transfer',
    'transfer-result',
    'dismissal',
    'cleared',
    'end-season',
    'season-table',
    'season-summary'
  ];
  expect([...visited]).toEqual(expect.arrayContaining(screens));
});

const holdFrames = 5;

/**
 * Types an answer key by key, two frames down and two up each, then holds
 * Enter while submitting, as a keyboard player does.
 */
const typeAnswer = (journal: Journal, text: string, hold = holdFrames) => {
  for (const char of text) {
    journal.setKey(
      /\d/.test(char) ? `Digit${char}` : `Key${char.toUpperCase()}`
    );
    journal.advance(2);
    journal.setKey('');
    journal.advance(2);
  }
  journal.setKey('Enter');
  journal.submit(text);
  journal.advance(hold);
  journal.setKey('');
};

/** Taps an offered answer after the same typing time, holding the finger as long. */
const tapAt = (
  journal: Journal,
  id: string,
  text?: string,
  hold = holdFrames
) => {
  const offered = answersFor(journal.session.view).find(a => a.id === id);
  if (!offered) {
    throw new Error(`${id} is not offered on ${journal.session.view.screen}`);
  }
  const sent = offered.kind === 'choice' ? offered.text : text!;
  journal.advance(sent.length * 4);
  if (offered.kind === 'choice') {
    tapAnswer(journal, offered);
  } else {
    tapAnswer(journal, offered, sent);
  }
  journal.advance(hold);
  journal.setKey('');
  return sent;
};

test('a game played by taps matches the same game typed at the same moments', () => {
  const tapped = createJournal();
  const typed = createJournal();
  const both = (step: (journal: Journal) => void) => {
    step(tapped);
    step(typed);
  };
  const answer = (id: string, text?: string, hold?: number) => {
    both(finishPrompt);
    both(j => j.advance(40));
    typeAnswer(typed, tapAt(tapped, id, text, hold), hold);
  };
  const highlights = () => {
    expect(tapped.session.view.screen).toBe('highlights');
    both(j => {
      j.advance(200);
      j.setKey('Space');
      j.advance(3);
      j.setKey('');
      j.advance(1_000_000);
    });
  };
  both(j => j.advance(400));
  answer('manager.name', 'alex');
  answer('clubs.club.3');
  answer('level.2');
  answer('colours.white');
  answer('menu.borrow');
  answer('borrow.amount', '5000');
  answer('message.continue');
  answer('menu.play');
  answer('fixture.continue');
  answer('team.kick-off');
  highlights();
  for (const screen of ['result', 'other-matches', 'table', 'bills']) {
    answer(`${screen}.continue`);
  }
  answer('transfer.decline');
  answer('menu.play');
  answer('fixture.continue');
  // A long press: Enter held into the highlights shortens their pauses.
  answer('team.kick-off', undefined, 200);
  both(j => j.advance(1_000_000));
  answer('result.continue');
  expect(JSON.stringify(tapped.session.view)).toBe(
    JSON.stringify(typed.session.view)
  );
  expect(tapped.session.timingState).toEqual(typed.session.timingState);
});
