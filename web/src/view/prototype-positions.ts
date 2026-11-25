/**
 * PROTOTYPE (#121), throwaway. Four ways for the manager to play a picked
 * player out of position, on mock data, switchable with `?variant=A..D`:
 * A Classic typed suffix, B Modern tap then target, C Modern per-row picker,
 * D Modern grouped by where they play. The rules are the ones settled in the
 * #121 grilling: −1 skill a line away, outfielder in goal or keeper outfield
 * counts 1, nobody in goal costs defence 3. Not part of the game.
 */

type Line = 'G' | 'D' | 'M' | 'A';
type Status = 'picked' | 'reserve' | 'injured';
type Mock = {
  energy: number;
  id: number;
  name: string;
  plays?: Line;
  pos: Line;
  skill: number;
  status: Status;
  value: number;
  weeks?: number;
};

const lineName: Record<Line, string> = {
  A: 'Attack',
  D: 'Defence',
  G: 'Goal',
  M: 'Midfield'
};
const lineOrder: Line[] = ['G', 'D', 'M', 'A'];
/** Ink by category: a goalkeeper and goal take defence's. */
const inkOf = (line: Line) => (line === 'M' ? 1 : line === 'A' ? 2 : 0);
const outfield = (line: Line) => (line === 'M' ? 1 : line === 'A' ? 2 : 0);

const mock = (
  id: number,
  name: string,
  pos: Line,
  skill: number,
  status: Status = 'picked',
  weeks?: number
): Mock => ({
  energy: 10 + ((id * 7) % 11),
  id,
  name,
  pos,
  skill,
  status,
  value: skill * 9000 + id * 500,
  ...(status === 'picked' ? { plays: pos } : {}),
  ...(weeks ? { weeks } : {})
});

const fresh = (): Mock[] => [
  mock(1, 'HOLT', 'G', 4),
  mock(2, 'LOWE', 'G', 2, 'reserve'),
  mock(3, 'PRICE', 'D', 3),
  mock(5, 'ODUYA', 'D', 4),
  mock(7, 'KEMP', 'D', 2),
  mock(8, 'WELLS', 'D', 3),
  mock(10, 'SMITH', 'M', 4),
  mock(11, 'YATES', 'M', 3, 'reserve'),
  mock(12, 'BARRA', 'M', 3),
  mock(14, 'COLE', 'M', 5),
  mock(15, 'DUNN', 'M', 2),
  mock(18, 'FINCH', 'A', 3),
  mock(20, 'MOSS', 'A', 4),
  mock(22, 'REID', 'A', 2, 'injured', 2)
];

let squad = fresh();
let message = '';
let selected: number | undefined;

// The rules.

/** The skill a player counts where he plays (or would play) under #121. */
const counted = (p: Mock, line: Line) => {
  if (line === 'G') {
    return p.pos === 'G' ? p.skill : 1;
  }
  if (p.pos === 'G') {
    return 1;
  }
  return Math.max(0, p.skill - Math.abs(outfield(p.pos) - outfield(line)));
};

const picked = () => squad.filter(p => p.status === 'picked');
const inGoal = () => picked().find(p => p.plays === 'G');
const out = (p: Mock) => p.plays !== undefined && p.plays !== p.pos;

const strengths = () => {
  const team = picked();
  const sums = [0, 0, 0];
  for (const p of team) {
    sums[outfield(p.plays!)]! += counted(p, p.plays!);
  }
  const emptyGoal = !inGoal();
  if (emptyGoal) {
    sums[0]! -= 3;
  }
  const clamp = (v: number) => Math.max(1, Math.min(20, v));
  return {
    emptyGoal,
    rows: [
      [
        'Energy',
        clamp(Math.floor(team.reduce((s, p) => s + p.energy, 0) / 11))
      ],
      ['Morale', 10],
      ['Defence', clamp(sums[0]!)],
      ['Midfield', clamp(sums[1]!)],
      ['Attack', clamp(sums[2]!)]
    ] as const
  };
};

/** Whoever is in goal makes way: to his own position, or defence for a keeper. */
const makeWay = (except: Mock) => {
  const keeper = inGoal();
  if (keeper && keeper !== except) {
    keeper.plays = keeper.pos === 'G' ? 'D' : keeper.pos;
  }
};

/** Where a player picked by plain number plays. */
const natural = (p: Mock): Line => (p.pos === 'G' && inGoal() ? 'D' : p.pos);

const place = (p: Mock, line: Line) => {
  if (line === 'G') {
    makeWay(p);
  }
  p.plays = line;
};

/** One answer: a number, or a number and a line. Returns a message. */
const answer = (id: number, line?: Line) => {
  const p = squad.find(q => q.id === id);
  if (!p) {
    return 'PLAYER NO. OUT OF RANGE';
  }
  if (p.status === 'injured') {
    return `${p.name} IS INJURED`;
  }
  if (p.status === 'reserve') {
    p.status = 'picked';
    place(p, line ?? natural(p));
    return `${p.name} PICKED, IN ${lineName[p.plays!].toUpperCase()}`;
  }
  if (line) {
    place(p, line);
    return `${p.name} NOW IN ${lineName[line].toUpperCase()}`;
  }
  p.status = 'reserve';
  delete p.plays;
  return `${p.name} DROPPED`;
};

// Shared bits.

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: (Node | string)[]
) => {
  const e = document.createElement(tag);
  if (className) {
    e.className = className;
  }
  e.append(...children);
  return e;
};

const button = (
  className: string,
  label: string | Node,
  onClick: () => void
) => {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};

const order = (players: Mock[]) =>
  players.toSorted(
    (a, b) => lineOrder.indexOf(a.pos) - lineOrder.indexOf(b.pos) || a.id - b.id
  );

const strengthsPanel = () => {
  const s = strengths();
  const table = el('table', 'pick-strengths');
  const body = el('tbody');
  for (const [name, value] of s.rows) {
    body.append(el('tr', '', el('th', '', name), el('td', '', String(value))));
  }
  table.append(body);
  const notes = el('ul', 'proto-notes');
  if (s.emptyGoal) {
    notes.append(el('li', 'warn', 'Nobody in goal: defence −3'));
  }
  for (const p of order(picked()).filter(out)) {
    notes.append(
      el(
        'li',
        '',
        `${p.id} ${p.name} ${p.pos}→${p.plays} counts ${counted(p, p.plays!)} of ${p.skill}`
      )
    );
  }
  return el(
    'aside',
    'proto-state',
    el('h3', '', `Picked ${picked().length}`),
    table,
    notes,
    el('p', 'proto-message', message || ' '),
    button('proto-reset', 'Reset squad', () => {
      squad = fresh();
      message = '';
      selected = undefined;
      render();
    })
  );
};

/** The Modern row, as the real pick team row, with the #121 marker. */
const modernRow = (p: Mock, onTap?: () => void) => {
  const inner: Node[] = [
    el('span', `pick-tag proto-ink-${inkOf(p.pos)}`, p.pos),
    el(
      'span',
      'pick-name',
      p.name,
      ...(out(p) ? [el('span', 'proto-chip', `→${p.plays}`)] : [])
    ),
    el('span', 'pick-number', String(p.id)),
    el(
      'span',
      'pick-skill',
      out(p) ? `${counted(p, p.plays!)}(${p.skill})` : String(p.skill)
    ),
    el('span', 'pick-energy', String(p.energy)),
    el('span', 'pick-value', `£${p.value}`),
    el(
      'span',
      'pick-marker',
      p.status === 'picked'
        ? 'p'
        : p.status === 'injured'
          ? String(p.weeks)
          : ''
    )
  ];
  const row = onTap
    ? button(`pick-row ${p.status}`, '', onTap)
    : el('div', `pick-row ${p.status}`);
  row.replaceChildren(...inner);
  row.dataset.player = String(p.id);
  if (p.id === selected) {
    row.classList.add('proto-selected');
  }
  return row;
};

const header = () =>
  el(
    'div',
    'pick-row pick-header',
    el('span', 'pick-tag'),
    el('span', 'pick-name', 'Name'),
    el('span', 'pick-number', 'No.'),
    el('span', 'pick-skill', 'Skill'),
    el('span', 'pick-energy', 'Energy'),
    el('span', 'pick-value', 'Value'),
    el('span', 'pick-marker')
  );

/** Groups by position, as the squad screen lists them today (Q8). */
const byPosition = (row: (p: Mock) => Node[]) =>
  (['D', 'M', 'A'] as const).map(line =>
    el(
      'section',
      `pick-group category-${inkOf(line)}`,
      el('h3', '', lineName[line]),
      header(),
      ...order(squad)
        .filter(p => (p.pos === 'G' ? 'D' : p.pos) === line)
        .flatMap(row)
    )
  );

const tap = (id: number, line?: Line) => {
  message = answer(id, line);
  render();
};

/** Over eleven picked, the original only drops and won't take 99. */
const doneButton = () => {
  const over = picked().length - 11;
  const b = button(
    'primary',
    over > 0 ? `Drop ${over} to continue` : 'Done – continue',
    () => {
      message = 'Done (not in prototype)';
      render();
    }
  );
  b.disabled = over > 0;
  return b;
};

// Variant A: Classic, typed suffix.

const cols = 32;
const pad = (text: string, at: number, line: string) =>
  line.padEnd(at).slice(0, at) + text;

const variantA = () => {
  const screen = el('div', 'proto-zx');
  const line = (...spans: (string | [string, string])[]) => {
    const row = el('div', 'proto-zx-line');
    for (const s of spans) {
      row.append(typeof s === 'string' ? s : el('span', s[0], s[1]));
    }
    screen.append(row);
  };
  line(
    ['zx-inv-3', 'p'],
    ' = picked to play, ',
    ['zx-inv-4', 'i'],
    ' = injured'
  );
  line(['zx-hdr', '  NAME   NO. SKILL ENERGY VALUE'.padEnd(cols)]);
  for (const p of order(squad)) {
    const skill = out(p)
      ? `${counted(p, p.plays!)}(${p.skill})`
      : String(p.skill);
    let text = `${p.name.padEnd(8)} ${p.id}`;
    text = pad(skill, 13, text);
    text = pad(String(p.energy), 18, text);
    text = pad(`£${p.value}`, 22, text);
    text = text.padEnd(29);
    const status =
      p.status === 'picked'
        ? out(p)
          ? p.plays!
          : 'p'
        : p.status === 'injured'
          ? String(p.weeks)
          : ' ';
    line(
      [`zx-tag zx-inv-ink-${inkOf(p.pos)}`, `${p.pos}█`],
      [`zx-ink-${inkOf(p.pos)}`, text],
      [
        p.status === 'picked'
          ? out(p)
            ? 'zx-inv-2'
            : 'zx-inv-3'
          : p.status === 'injured'
            ? 'zx-inv-4'
            : 'zx-plain',
        status
      ]
    );
  }
  line(['zx-inv-0', 'PLAYERS PICKED'], `=${picked().length}`);
  line('');
  line(['zx-inv-1', 'Type Player No. to add to team']);
  line(['zx-hdr', 'OR type 99 to continue']);
  line(['zx-inv-1', 'Add D,M,A or G to move him:']);
  line(['zx-inv-1', '14A plays No.14 in attack']);
  line(message ? ['zx-ink-2', message] : '');
  const input = el('input', 'proto-zx-input');
  input.setAttribute('aria-label', 'Answer');
  input.autocomplete = 'off';
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') {
      return;
    }
    const text = input.value.trim().toUpperCase();
    const match = /^(\d{1,2})([ADGM])?$/.exec(text);
    if (text === '99') {
      message = 'KICK OFF (not in prototype)';
    } else if (!match) {
      message = 'ANSWER NOT UNDERSTOOD';
    } else {
      message = answer(Number(match[1]), match[2] as Line | undefined);
    }
    render();
    document.querySelector<HTMLInputElement>('.proto-zx-input')?.focus();
  });
  screen.append(el('div', 'proto-zx-line', '? ', input));
  const view = el('div', 'proto-zx-machine', screen);
  queueMicrotask(() => input.focus());
  return [
    el(
      'p',
      'proto-intro',
      'Classic: type a number to add or drop, or a number and D, M, A or G to play him there. The status column shows where an out-of-position player plays, the skill column what he counts (his skill in brackets).'
    ),
    view
  ];
};

// Variant B: Modern, tap the player, then the line.

const lineButtons = (p: Mock, onPick: (line: Line) => void) =>
  el(
    'div',
    'proto-lines',
    ...lineOrder.map(line => {
      const b = button(
        `proto-line proto-ink-${inkOf(line)}`,
        el(
          'span',
          '',
          el('b', '', lineName[line]),
          el('small', '', `counts ${counted(p, line)}`)
        ),
        () => onPick(line)
      );
      b.setAttribute('aria-pressed', String(p.plays === line));
      return b;
    })
  );

const variantB = () => {
  const chosen = squad.find(p => p.id === selected && p.status === 'picked');
  const rows = byPosition(p => [
    modernRow(
      p,
      p.status === 'injured'
        ? undefined
        : () => {
            if (p.status === 'reserve') {
              tap(p.id);
              return;
            }
            selected = selected === p.id ? undefined : p.id;
            render();
          }
    )
  ]);
  const sheet = chosen
    ? el(
        'div',
        'pick-actions proto-sheet',
        el('p', 'pick-hint', `${chosen.name} (${chosen.pos}) plays in:`),
        lineButtons(chosen, line => {
          selected = undefined;
          tap(chosen.id, line);
        }),
        button('red', `Drop ${chosen.name}`, () => {
          selected = undefined;
          tap(chosen.id);
        })
      )
    : el('div', 'pick-actions', doneButton());
  return [
    el('p', 'pick-count', `Players picked = ${picked().length}`),
    el(
      'p',
      'pick-hint',
      'Tap a reserve to add. Tap a picked player to move or drop him.'
    ),
    ...rows,
    sheet
  ];
};

// Variant C: Modern, a picker on every picked row.

const variantC = () => {
  const rows = byPosition(p => {
    const row = modernRow(
      p,
      p.status === 'injured' ? undefined : () => tap(p.id)
    );
    if (p.status !== 'picked') {
      return [row];
    }
    const picker = el(
      'div',
      'proto-row-picker',
      ...lineOrder.map(line => {
        const b = button(
          `proto-seg proto-ink-${inkOf(line)}`,
          `${line} ${counted(p, line)}`,
          () => tap(p.id, line)
        );
        b.setAttribute('aria-pressed', String(p.plays === line));
        b.setAttribute('aria-label', `Play ${p.name} in ${lineName[line]}`);
        return b;
      })
    );
    return [row, picker];
  });
  return [
    el('p', 'pick-count', `Players picked = ${picked().length}`),
    el(
      'p',
      'pick-hint',
      'Tap a row to add or drop. Tap G, D, M or A under a picked player to play him there; each shows what he would count.'
    ),
    ...rows,
    el('div', 'pick-actions', doneButton())
  ];
};

// Variant D: Modern, the team by where they play.

const variantD = () => {
  const chosen = squad.find(p => p.id === selected);
  const groups = lineOrder.map(line => {
    const players = order(picked().filter(p => p.plays === line));
    const head = chosen
      ? button(
          'proto-target',
          `${lineName[line]} – put ${chosen.name} here (counts ${counted(chosen, line)})`,
          () => {
            selected = undefined;
            tap(chosen.id, line);
          }
        )
      : el('h3', '', lineName[line]);
    const section = el(
      'section',
      `pick-group category-${inkOf(line)}`,
      head,
      ...(players.length
        ? players.map(p =>
            modernRow(p, () => {
              selected = selected === p.id ? undefined : p.id;
              render();
            })
          )
        : [
            el('div', 'pick-none', line === 'G' ? 'Nobody: defence −3' : 'None')
          ])
    );
    section.dataset.line = line;
    return section;
  });
  const rest = order(squad.filter(p => p.status !== 'picked'));
  const bench = el(
    'section',
    'pick-group proto-bench',
    el('h3', '', 'Reserves and injured'),
    ...rest.map(p =>
      modernRow(
        p,
        p.status === 'injured'
          ? undefined
          : () => {
              selected = selected === p.id ? undefined : p.id;
              render();
            }
      )
    )
  );
  bench.dataset.line = 'bench';
  const actions = chosen
    ? el(
        'div',
        'pick-actions proto-sheet',
        el(
          'p',
          'pick-hint',
          chosen.status === 'picked'
            ? `Tap a heading to move ${chosen.name}, or:`
            : `Tap a heading to add ${chosen.name} there, or:`
        ),
        chosen.status === 'picked'
          ? button('red', `Drop ${chosen.name}`, () => {
              selected = undefined;
              tap(chosen.id);
            })
          : button(
              'red',
              `Add ${chosen.name} as ${lineName[natural(chosen)]}`,
              () => {
                selected = undefined;
                tap(chosen.id);
              }
            ),
        button('', 'Cancel', () => {
          selected = undefined;
          render();
        })
      )
    : el('div', 'pick-actions', doneButton());
  return [
    el('p', 'pick-count', `Players picked = ${picked().length}`),
    el(
      'p',
      'pick-hint',
      'Grouped by where they play. Tap a player, then a heading.'
    ),
    header(),
    ...groups,
    bench,
    actions
  ];
};

// Variant E: D, plus drag and drop. Mouse drags at once; touch drags after a
// short hold, so a swipe still scrolls the list.

let dragging = false;
document.addEventListener(
  'touchmove',
  event => {
    if (dragging) {
      event.preventDefault();
    }
  },
  { passive: false }
);

const zoneAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-line]');

const enableDrag = (row: HTMLElement, p: Mock) => {
  row.addEventListener('pointerdown', down => {
    if (down.button !== 0) {
      return;
    }
    const touch = down.pointerType !== 'mouse';
    let ghost: HTMLElement | undefined;
    let over: HTMLElement | undefined;
    let held = !touch;
    const startX = down.clientX;
    const startY = down.clientY;
    const timer = touch
      ? setTimeout(() => {
          held = true;
          start(startX, startY);
        }, 250)
      : undefined;
    // Over eleven picked the original only drops: a reserve can't be added.
    const refused = p.status !== 'picked' && picked().length > 11;
    const zones = () =>
      [...document.querySelectorAll<HTMLElement>('[data-line]')].filter(
        zone => !refused || zone.dataset.line === 'bench'
      );
    const start = (x: number, y: number) => {
      dragging = true;
      selected = undefined;
      row.classList.add('proto-lifted');
      ghost = row.cloneNode(true) as HTMLElement;
      ghost.className += ' proto-ghost';
      ghost.style.width = `${row.getBoundingClientRect().width}px`;
      document.body.append(ghost);
      navigator.vibrate?.(10);
      for (const zone of zones()) {
        zone.classList.add('proto-zone');
        const line = zone.dataset.line;
        const label =
          line === 'bench'
            ? p.status === 'picked'
              ? 'drop here'
              : ''
            : `counts ${counted(p, line as Line)}`;
        if (label) {
          zone.querySelector('h3')?.append(el('span', 'proto-counts', label));
        }
      }
      move(x, y);
    };
    const move = (x: number, y: number) => {
      ghost!.style.transform = `translate(${x - 24}px, ${y - 22}px)`;
      const found = zoneAt(x, y);
      const zone = found && zones().includes(found) ? found : undefined;
      if (zone !== over) {
        over?.classList.remove('proto-over');
        over = zone ?? undefined;
        over?.classList.add('proto-over');
      }
    };
    const onMove = (event: PointerEvent) => {
      const far =
        Math.hypot(event.clientX - startX, event.clientY - startY) > 6;
      if (!dragging && far) {
        if (!held) {
          // A touch that moves before the hold is a scroll: let it go.
          finish();
          return;
        }
        start(event.clientX, event.clientY);
      } else if (dragging) {
        move(event.clientX, event.clientY);
      }
    };
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    const onUp = () => {
      finish();
      if (!dragging) {
        return;
      }
      dragging = false;
      ghost?.remove();
      // The click after a drag must not select the row.
      row.addEventListener('click', e => e.stopImmediatePropagation(), {
        capture: true,
        once: true
      });
      const line = over?.dataset.line;
      if (line === 'bench') {
        if (p.status === 'picked') {
          tap(p.id);
          return;
        }
      } else if (line && line !== p.plays) {
        tap(p.id, line as Line);
        return;
      }
      render();
    };
    const onCancel = () => {
      finish();
      if (dragging) {
        dragging = false;
        ghost?.remove();
        render();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });
};

const variantE = () => {
  const nodes = variantD();
  const hint = nodes[1] as HTMLElement;
  hint.textContent =
    'Drag a player to a line, or to the reserves to drop him. On touch, hold, then drag. Tapping still works as in D.';
  for (const node of nodes) {
    if (typeof node !== 'string' && 'querySelectorAll' in node) {
      for (const row of node.querySelectorAll<HTMLElement>(
        'button[data-player]'
      )) {
        const p = squad.find(q => q.id === Number(row.dataset.player))!;
        enableDrag(row, p);
      }
    }
  }
  return nodes;
};

// The switcher.

const variants = [
  ['A', 'Classic: typed 14A', variantA],
  ['B', 'Modern: tap player, then line', variantB],
  ['C', 'Modern: picker on each row', variantC],
  ['D', 'Modern: grouped by where they play', variantD],
  ['E', 'Modern: D with drag and drop', variantE]
] as const;

const current = () => {
  const key = new URLSearchParams(location.search).get('variant') ?? 'A';
  return Math.max(
    0,
    variants.findIndex(([k]) => k === key)
  );
};

const go = (step: number) => {
  const i = (current() + step + variants.length) % variants.length;
  const url = new URL(location.href);
  url.searchParams.set('variant', variants[i]![0]);
  history.replaceState(null, '', url);
  selected = undefined;
  message = '';
  render();
};

const switcher = () => {
  const [key, name] = variants[current()]!;
  return el(
    'nav',
    'proto-switcher',
    button('', '←', () => go(-1)),
    el('span', '', `${key} (${name})`),
    button('', '→', () => go(1))
  );
};

const render = () => {
  const [, , paint] = variants[current()]!;
  const app = document.querySelector('#app')!;
  const classic = variants[current()]![0] === 'A';
  document.documentElement.classList.toggle('modern', !classic);
  const pane = el('div', classic ? 'proto-classic' : 'pick-team', ...paint());
  app.replaceChildren(
    el('div', 'proto-layout', pane, strengthsPanel()),
    switcher()
  );
};

document.addEventListener('keydown', event => {
  const target = event.target as HTMLElement;
  if (target.closest('input, textarea, [contenteditable]')) {
    return;
  }
  if (event.key === 'ArrowLeft') {
    go(-1);
  } else if (event.key === 'ArrowRight') {
    go(1);
  }
});

render();
