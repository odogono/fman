import { fixtureSides, type MatchFixture } from '../sim/league';
import type { Game, Player } from '../sim/management';
import { matchInks } from '../sim/matchday';
import type { Moment } from '../sim/moments';
import type { Position, SquadPlayer } from '../sim/squads';
import {
  createClipScript,
  hashSeed,
  kickOffFrame,
  type ClipFrame,
  type ClipInput,
  type ClipPlayer,
  type ClipScript,
  type ClipSide,
  type Line
} from './clips';
import { named } from './ticker-layout';

// How a real match becomes clips (#144): who plays for each side and where,
// what they wear, and each clip's seed.

/** The kits' colours, by Spectrum ink, as Modern mode prints them. */
export const inkColours = [
  '#000000',
  '#0000d7',
  '#d70000',
  '#d700d7',
  '#00d700',
  '#00d7d7',
  '#d7d700',
  '#d7d7d7'
] as const;

/** Goalkeepers' colours, in the order they are tried. No kit uses them. */
export const keeperColours = [
  { css: '#ff8c1a', name: 'orange' },
  { css: '#7cd616', name: 'lime' },
  { css: '#8c8c8c', name: 'grey' },
  { css: '#7a3cb4', name: 'purple' }
] as const;

const rgb = (css: string) =>
  [1, 3, 5].map(i => Number.parseInt(css.slice(i, i + 2), 16)) as [
    number,
    number,
    number
  ];

/**
 * How unlike two colours look: a distance weighted for the eye ("redmean"),
 * from 0 for the same colour to about 765 for black against white.
 */
export const colourDistance = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const red = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + red / 256) * (r1 - r2) ** 2 +
      4 * (g1 - g2) ** 2 +
      (2 + (255 - red) / 256) * (b1 - b2) ** 2
  );
};

/** Colours closer than this would be mistaken for each other on the pitch. */
const unlike = 320;

/** The first goalkeeper colour unlike every colour `taken`. */
const chooseKeeper = (taken: readonly string[]) =>
  (
    keeperColours.find(c =>
      taken.every(t => colourDistance(c.css, t) >= unlike)
    ) ?? keeperColours.find(c => !taken.includes(c.css))!
  ).css;

/**
 * The goalkeepers' colours, home first: each the first on the list that
 * looks unlike both kits and, for the away keeper, the home keeper's.
 */
export const keeperColoursFor = (home: string, away: string) => {
  const homeKeeper = chooseKeeper([home, away]);
  return { away: chooseKeeper([home, away, homeKeeper]), home: homeKeeper };
};

const lineOf = (position: Position | undefined): Line =>
  position === 'DF' || position === 'GK'
    ? 'defence'
    : position === 'FW'
      ? 'attack'
      : 'midfield';

/**
 * Who keeps goal: the first goalkeeper, or else the first defender, or else
 * the first player, so even a side picked short has one. The named player
 * shoots, so never keeps goal while anyone else could.
 */
const keeperOf = (
  positions: readonly (Position | undefined)[],
  shooter: number
) => {
  const first = (wanted: (p: Position | undefined) => boolean) =>
    positions.findIndex((p, i) => i !== shooter && wanted(p));
  for (const wanted of [
    (p: Position | undefined) => p === 'GK',
    (p: Position | undefined) => p === 'DF',
    () => true
  ]) {
    const i = first(wanted);
    if (i >= 0) {
      return i;
    }
  }
  return -1;
};

const lineUp = (
  people: readonly { label: string; position?: Position }[],
  shooter: number
): ClipPlayer[] => {
  const keeper = keeperOf(
    people.map(p => p.position),
    shooter
  );
  return people.map((p, i) => ({
    label: p.label,
    line:
      i === keeper
        ? 'keeper'
        : i === shooter && p.position === 'GK'
          ? 'attack'
          : lineOf(p.position)
  }));
};

const squadOrder: readonly Position[] = ['GK', 'DF', 'MF', 'FW'];
/** The managed club's picked team, in squad order. */
const pickedTeam = (game: Game) =>
  game.players
    .filter(p => p.status === 2)
    .toSorted(
      (a, b) =>
        squadOrder.indexOf(a.position ?? 'MF') -
          squadOrder.indexOf(b.position ?? 'MF') || a.id - b.id
    );

const shape: Readonly<Record<Position, number>> = {
  DF: 4,
  FW: 2,
  GK: 1,
  MF: 4
};

/**
 * An opponent's 11 from its squad, in a 4-4-2: in squad order, its first
 * goalkeeper, four defenders, four midfielders and two attackers, with any
 * gap filled from the rest. The named player always plays, in place of the
 * last-listed player in their position.
 */
export const opponentEleven = (
  squad: readonly SquadPlayer[],
  named?: number
) => {
  const chosen: number[] = [];
  for (const position of squadOrder) {
    chosen.push(
      ...squad
        .flatMap((p, i) => (p.position === position ? [i] : []))
        .slice(0, shape[position])
    );
  }
  for (let i = 0; i < squad.length && chosen.length < 11; i++) {
    if (!chosen.includes(i)) {
      chosen.push(i);
    }
  }
  if (named !== undefined && named < squad.length && !chosen.includes(named)) {
    const position = squad[named]!.position;
    const same = chosen.filter(i => squad[i]!.position === position);
    const out = same.at(-1) ?? chosen.at(-1);
    if (out === undefined) {
      chosen.push(named);
    } else {
      chosen[chosen.indexOf(out)] = named;
    }
  }
  return chosen
    .toSorted(
      (a, b) =>
        squadOrder.indexOf(squad[a]!.position) -
          squadOrder.indexOf(squad[b]!.position) || a - b
    )
    .slice(0, 11);
};

/** A club without a squad of its own fields 11 in a 4-4-2, unnamed. */
const unnamedEleven: readonly Position[] = [
  'GK',
  ...Array<Position>(4).fill('DF'),
  ...Array<Position>(4).fill('MF'),
  ...Array<Position>(2).fill('FW')
];

type Sides = Readonly<{
  away: ClipSide;
  /** The side that made the chance, and its shooter's place in it. */
  clubShooter: number;
  home: ClipSide;
  opponentShooter: number;
}>;

/** Both sides as a moment shows them, with that moment's shooter. */
const sidesFor = (
  game: Game,
  fixture: MatchFixture,
  moment?: Moment
): Sides => {
  const inks = matchInks(game, fixture);
  const homeKit = inkColours[inks.home]!;
  const awayKit = inkColours[inks.away]!;
  const keepers = keeperColoursFor(homeKit, awayKit);
  const picked = pickedTeam(game);
  const clubShooter =
    moment?.side === 'club'
      ? picked.findIndex((p: Player) => p.id === moment.player)
      : -1;
  const club = lineUp(
    picked.map(p => ({
      label: p.name.trim(),
      ...(p.position ? { position: p.position } : {})
    })),
    clubShooter
  );
  const { squad } = game.clubs[fixture.opponent - 1]!;
  const named = moment?.side === 'opponent' ? moment.squadPlayer : undefined;
  const eleven = squad ? opponentEleven(squad, named) : [];
  const opponentShooter = named === undefined ? -1 : eleven.indexOf(named);
  const opponent = squad
    ? lineUp(
        eleven.map(i => ({
          label: squad[i]!.name.trim(),
          position: squad[i]!.position
        })),
        opponentShooter
      )
    : lineUp(
        unnamedEleven.map(position => ({ label: '', position })),
        moment?.side === 'opponent' ? 10 : -1
      );
  const clubSide = (fixture.home ? 'home' : 'away') as 'away' | 'home';
  const sides = {
    club: {
      keeper: keepers[clubSide],
      kit: clubSide === 'home' ? homeKit : awayKit,
      players: club
    },
    opponent: {
      keeper: keepers[clubSide === 'home' ? 'away' : 'home'],
      kit: clubSide === 'home' ? awayKit : homeKit,
      players: opponent
    }
  };
  return {
    away: fixture.home ? sides.opponent : sides.club,
    clubShooter,
    home: fixture.home ? sides.club : sides.opponent,
    opponentShooter:
      opponentShooter < 0 && !squad && moment?.side === 'opponent'
        ? 10
        : opponentShooter
  };
};

/** The input for the clip of the `index`th moment of a match. */
export const clipInputFor = (
  game: Game,
  fixture: MatchFixture,
  moment: Moment,
  index: number
): ClipInput => {
  const sides = sidesFor(game, fixture, moment);
  const clubHome = fixture.home;
  const club = clubHome ? sides.home : sides.away;
  const opponent = clubHome ? sides.away : sides.home;
  const attackingHome = (moment.side === 'club') === clubHome;
  const name = named(game, fixture, moment).trim();
  const shooting = moment.side === 'club' ? club : opponent;
  let shooter =
    moment.side === 'club' ? sides.clubShooter : sides.opponentShooter;
  if (shooter < 0) {
    // No player is named: the side's most advanced player shoots.
    const lines: readonly Line[] = ['attack', 'midfield', 'defence', 'keeper'];
    shooter = Math.max(
      0,
      ...lines
        .map(line => shooting.players.findIndex(p => p.line === line))
        .filter(i => i >= 0)
        .slice(0, 1)
    );
  }
  const players = shooting.players.map((p, i) =>
    i === shooter ? { ...p, label: name } : p
  );
  return {
    attack: { ...shooting, players },
    // The home side shoots up the screen before half-time, down after.
    attackingUp: attackingHome === moment.minute < 46,
    defence: moment.side === 'club' ? opponent : club,
    kind: moment.kind,
    minute: moment.minute,
    seed: hashSeed(
      [
        game.club,
        fixture.opponent,
        clubHome ? 'home' : 'away',
        index,
        moment.minute,
        moment.kind,
        moment.side,
        name
      ].join('|')
    ),
    shooter
  };
};

/** Every moment's clip, in minute order, as the view works them out at kick-off. */
export const clipScriptsFor = (
  game: Game,
  fixture: MatchFixture,
  moments: readonly Moment[]
): ClipScript[] =>
  moments.map((moment, i) =>
    createClipScript(clipInputFor(game, fixture, moment, i))
  );

/** The still pitch under "Kick-off" or "Full time": both sides in shape. */
export const stillFrameFor = (
  game: Game,
  fixture: MatchFixture,
  caption: string
): { frame: ClipFrame; sides: { attack: ClipSide; defence: ClipSide } } => {
  const { away, home } = sidesFor(game, fixture);
  return {
    frame: kickOffFrame(home, away, caption),
    sides: { attack: home, defence: away }
  };
};

/** The club names for the debug page's readout. */
export const clubNames = (game: Game, fixture: MatchFixture) => {
  const { away, home } = fixtureSides(game, fixture);
  return { away: away.name.trim(), home: home.name.trim() };
};
