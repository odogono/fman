export const levels = [
  'Beginner',
  'Novice',
  'Average',
  'Good',
  'Expert',
  'Super Expert',
  'Genius'
] as const;

export const playerNames = [
  'P.Parkes',
  'D.Watson',
  'P.Neal',
  'A.Martin',
  'K.Sansom',
  'M.Mills',
  'R.Osman',
  'S.Foster',
  'B.Robson',
  'G.Hoddle',
  'G.Rix',
  'S.Hunt',
  'G.Owen',
  'R.Moses',
  'B.Talbot',
  'S.McCall',
  'C.Regis',
  'P.Withe',
  'T.Morley',
  'P.Barnes',
  'E.Gates',
  'K.Reeves',
  'K.Keegan',
  'G.Shaw'
] as const;

/** The two kits a club wears in the highlights, as Spectrum inks. */
export type Kit = Readonly<{ change: number; home: number }>;

export type Club = Readonly<{
  ink: number | null;
  /** Kits for the present-day clubs; the original clubs have none. */
  kit?: Kit;
  name: string;
  /** A name colour's paper, when it is not the screen's white. */
  paper?: number;
  width?: number;
}>;

// Original DATA order (9230–9260). Derby's repeated colour prefix leaves
// only eight visible characters in the original twelve-byte string array.
const names = [
  'Arsenal',
  'Aston V.',
  'Brighton',
  'Coventry',
  'Everton',
  'Ipswich',
  'Liverpool',
  'Luton',
  'Man.City',
  'Man.Utd',
  'Norwich',
  'Notts.F.',
  'Swansea',
  'Spurs',
  'Watford',
  'West Ham',
  'Blackburn',
  'Bolton',
  'Cambridge',
  'Charlton',
  'Chelsea',
  'Crystal P.',
  'Derby Co',
  'Fulham',
  'Grimsby',
  'Leeds',
  'Middlesbro',
  'Newcastle',
  'Oldham',
  'Q.P.R.',
  'Rotherham',
  'Sheff.Wed',
  'Bradford',
  'Brentford',
  'Bristol R.',
  'Cardiff',
  'Doncaster',
  'Exeter',
  'Lincoln',
  'Millwall',
  'Newport',
  'Orient',
  'Oxford',
  'Plymouth',
  'Preston',
  'Reading',
  'Southend',
  'Walsall',
  'Blackpool',
  'Bury',
  'Colchester',
  'Crewe',
  'Darlington',
  'Halifax',
  'Hartlepool',
  'Hereford',
  'Hull',
  'Mansfield',
  'Port Vale',
  'Rochdale',
  'Scunthorpe',
  'Stockport',
  'Torquay',
  'York City'
];
const inks = [
  2, 3, 1, 1, 1, 1, 2, 0, 1, 2, 4, 2, 0, 1, 0, 3, 1, 0, 0, 2, 1, 0, 0, 0, 0, 1,
  2, 0, 1, 1, 2, 1, 3, 2, 1, 1, 0, 2, 2, 1, 0, 2, 0, 4, 0, 1, 1, 2, 0, 0, 1, 2,
  0, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 2
];
export const clubs: readonly Club[] = names.map((name, index) => ({
  ink: inks[index]!,
  name,
  width: index === 22 ? 8 : 10
}));

/** The Spectrum's eight colours, by ink number. */
export const colourNames = [
  'Black',
  'Blue',
  'Red',
  'Magenta',
  'Green',
  'Cyan',
  'Yellow',
  'White'
] as const;

// The England squad announced on 6 November 2026, eight to a category:
// defence (with one goalkeeper, as the original), midfield and attack.
export const presentDayPlayerNames = [
  'Pickford',
  'B.White',
  'E.Konsa',
  'Branthwt',
  'Quansah',
  'D.Spence',
  'L.Hall',
  'D.Burn',
  'D.Rice',
  'Jude B.',
  'Jobe B.',
  'Anderson',
  'J.Garner',
  'J.King',
  'L.Skelly',
  'T.Arnold',
  'H.Kane',
  'E.Eze',
  'A.Gordon',
  'Gibbs-W.',
  'C.Lewin',
  'Ngumoha',
  'M.Rogers',
  'B.Saka'
] as const;

const [k, b, r, m, g, c, y, w] = [0, 1, 2, 3, 4, 5, 6, 7] as const;
/** Name, name ink, name paper, home kit, change kit. */
type PresentDayClub = readonly [string, number, number, number, number];

// 2026/27, one division per tier. Each keeps the tier's 16 highest 2025/26
// finishers across the pyramid: clubs relegated into it, then clubs staying,
// then clubs promoted into it. Alphabetical within a division, as the
// original. Kits are never yellow, the grass's ink, nor green, which the
// pitch hides.
const presentDay: readonly PresentDayClub[] = [
  ['Arsenal', r, w, r, w],
  ['Aston V.', m, w, m, c],
  ['Bournemth', w, r, r, w],
  ['Brentford', r, w, r, k],
  ['Brighton', b, w, b, w],
  ['Chelsea', b, w, b, w],
  ['Crystal P.', w, b, b, r],
  ['Everton', b, w, b, w],
  ['Fulham', w, k, w, k],
  ['Leeds', w, b, w, b],
  ['Liverpool', r, w, r, w],
  ['Man.City', b, c, c, k],
  ['Man.Utd', r, w, r, w],
  ['Newcastle', k, w, k, w],
  ['Notts.F.', r, w, r, w],
  ['Sunderland', r, w, r, k],
  ['Birmingham', b, w, b, w],
  ['Bristol C.', r, w, r, w],
  ['Burnley', w, m, m, c],
  ['Derby Co', k, w, w, k],
  ['Middlesbro', r, w, r, w],
  ['Millwall', b, w, b, w],
  ['Norwich', k, y, w, k],
  ['Preston', w, b, w, b],
  ['Q.P.R.', b, w, b, w],
  ['Sheff.Utd', r, w, r, k],
  ['Southamptn', r, w, r, w],
  ['Swansea', w, k, w, k],
  ['Watford', k, y, r, k],
  ['West Ham', w, m, m, c],
  ['Wolves', k, y, k, w],
  ['Wrexham', r, w, r, w],
  ['Barnsley', r, w, r, w],
  ['Blackpool', k, y, r, w],
  ['Bradford', m, y, m, w],
  ['Doncaster', r, w, r, w],
  ['Huddersfld', b, w, b, w],
  ['Leicester', b, w, b, w],
  ['Luton', w, r, r, w],
  ['Mansfield', b, y, b, w],
  ['Oxford', b, y, b, w],
  ['Plymouth', w, g, w, k],
  ['Reading', b, w, b, w],
  ['Sheff.Wed', b, w, b, w],
  ['Stevenage', r, w, r, w],
  ['Stockport', w, b, b, w],
  ['Wigan', b, w, b, w],
  ['Wycombe', c, b, c, b],
  ['Accrington', r, w, r, w],
  ['Barnet', k, y, k, w],
  ['Bristol R.', b, w, b, w],
  ['Chesterfld', b, w, b, w],
  ['Colchester', b, w, b, w],
  ['Crewe', r, w, r, w],
  ['Exeter', r, w, r, k],
  ['Fleetwood', r, w, r, w],
  ['Grimsby', k, w, k, w],
  ['Northamptn', m, w, m, w],
  ['Oldham', b, w, b, w],
  ['Port Vale', w, k, w, k],
  ['Rotherham', r, w, r, w],
  ['Salford', k, y, r, w],
  ['Swindon', r, w, r, w],
  ['Walsall', r, w, r, w]
];

export const presentDayClubs: readonly Club[] = presentDay.map(
  ([name, ink, paper, home, change]) => ({
    ink,
    kit: { change, home },
    name,
    ...(paper === w ? {} : { paper }),
    width: 10
  })
);

/** The status screen's colours: the chosen colour, or the club's home kit. */
export const coloursText = (colour: number | undefined, club: Club) =>
  `Colours = ${colourNames[colour ?? club.kit!.home]}`;
