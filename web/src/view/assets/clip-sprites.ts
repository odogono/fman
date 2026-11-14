// The sprite highlights' artwork (#146), drawn for this project as pixel
// grids and dedicated to the public domain (see README.md). One character
// is one art pixel:
//
//   .  clear          o  outline         s  shirt, the kit's colour
//   d  shorts and socks, a darker shade of the kit
//   f  skin           h  hair            w  white
//   c  the sweat drop of the tired icon
//
// A player's frame stands on its bottom row, centred. Players are drawn
// facing down the screen, up it, or left; facing right is left mirrored.

export type ArtGrid = readonly string[];

/** Every character a grid may use. */
export const artColours = ['.', 'o', 's', 'd', 'f', 'h', 'w', 'c'] as const;

export type ArtFacing = 'down' | 'left' | 'up';

/**
 * Each pose's frames for each facing: one, or the run's cycle. A dive is
 * drawn to the left only.
 */
export type PlayerArt = Readonly<{
  celebrate: Readonly<Record<ArtFacing, ArtGrid>>;
  dive: Readonly<{ left: ArtGrid }>;
  head: Readonly<Record<ArtFacing, ArtGrid>>;
  hold: Readonly<Record<ArtFacing, ArtGrid>>;
  kick: Readonly<Record<ArtFacing, ArtGrid>>;
  run: Readonly<Record<ArtFacing, readonly ArtGrid[]>>;
  stand: Readonly<Record<ArtFacing, ArtGrid>>;
}>;

export const playerArt: PlayerArt = {
  celebrate: {
    down: [
      'f......f',
      'f.oooo.f',
      'fohhhhof',
      '.offffo.',
      '.offffo.',
      '.osssso.',
      'osssssso',
      '.osssso.',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ],
    left: [
      '..f.....',
      '..foooo.',
      '.fohhhho',
      '..offhho',
      '..offfho',
      '...osso.',
      '...ossso',
      '...ossso',
      '...osso.',
      '...oddo.',
      '...oddo.',
      '...oddo.',
      '...oooo.'
    ],
    up: [
      'f......f',
      'f.oooo.f',
      'fohhhhof',
      '.ohhhho.',
      '..offo..',
      '.osssso.',
      'osssssso',
      '.osssso.',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ]
  },
  dive: {
    left: [
      '...oooooooooo.',
      'ffohhfosssddoo',
      'ffohffosssdddo',
      '..ohffossssddo',
      '...oooooooooo.'
    ]
  },
  head: {
    down: [
      '.foooof.',
      'ofhhhhfo',
      'o.ffff.o',
      '..offo..',
      '.osssso.',
      '.osssso.',
      '.osssso.',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ],
    left: [
      '..ofooo.',
      '.ofhhhho',
      '.o.ffhho',
      '...offho',
      '...osso.',
      '...ossso',
      '...ossso',
      '...osso.',
      '...oddo.',
      '...oddo.',
      '...oddo.',
      '...oooo.'
    ],
    up: [
      '.foooof.',
      'ofhhhhfo',
      'o.hhhh.o',
      '..ohho..',
      '.osssso.',
      '.osssso.',
      '.osssso.',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ]
  },
  hold: {
    down: [
      '..oooo..',
      '.owwwwo.',
      '.fowwof.',
      '.f.oo.f.',
      '.foooof.',
      '.fhhhhf.',
      '.offffo.',
      '.offffo.',
      'oossssoo',
      '.osssso.',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ],
    left: [
      '.oooo...',
      'owwwwo..',
      '.owwo...',
      '.ff.....',
      '.ofoooo.',
      '.ofhhhho',
      '..offhho',
      '..offfho',
      '...osso.',
      '...ossso',
      '...ossso',
      '...oddo.',
      '...oddo.',
      '...oddo.',
      '...oooo.'
    ],
    up: [
      '..oooo..',
      '.owwwwo.',
      '.fowwof.',
      '.f.oo.f.',
      '.foooof.',
      '.fhhhhf.',
      '.ohhhho.',
      '..offo..',
      'oossssoo',
      '.osssso.',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ]
  },
  kick: {
    down: [
      '..oooo..',
      '.ohhhho.',
      '.offffo.',
      '.offffo.',
      'oossssoo',
      'fssssssf',
      'fssssssf',
      '.osssso.',
      '.oddddoo',
      '.odooddo',
      '.od..oo.',
      '.oo.....'
    ],
    left: [
      '..oooo..',
      '.ohhhho.',
      '.offhho.',
      '.offfho.',
      '..osso..',
      '..ossso.',
      '..osfso.',
      '..osfso.',
      '..oddo..',
      'ooddddo.',
      '....odo.',
      '....oo..'
    ],
    up: [
      '..oooo..',
      '.ohhhho.',
      '.ohhhho.',
      '..offo..',
      'oossssoo',
      'fssssssf',
      'fssssssf',
      '.osssso.',
      '.oddddoo',
      '.odooddo',
      '.od..oo.',
      '.oo.....'
    ]
  },
  run: {
    down: [
      [
        '..oooo..',
        '.ohhhho.',
        '.offffo.',
        '.offffo.',
        'oossssoo',
        'fssssssf',
        'fssssssf',
        '.osssso.',
        '.oddddo.',
        '.odoodo.',
        '.od..oo.',
        '.oo.....'
      ],
      [
        '..oooo..',
        '.ohhhho.',
        '.offffo.',
        '.offffo.',
        'oossssoo',
        'fssssssf',
        'fssssssf',
        '.osssso.',
        '.oddddo.',
        '.odoodo.',
        '.oo..do.',
        '.....oo.'
      ]
    ],
    left: [
      [
        '..oooo..',
        '.ohhhho.',
        '.offhho.',
        '.offfho.',
        '..osso..',
        '..ossso.',
        '..osfso.',
        '..osfso.',
        '..oddo..',
        '.oddddo.',
        'odo..odo',
        'oo....oo'
      ],
      [
        '..oooo..',
        '.ohhhho.',
        '.offhho.',
        '.offfho.',
        '..osso..',
        '..ossso.',
        '..osfso.',
        '..osfso.',
        '..oddo..',
        '..oddo..',
        '..oddo..',
        '..ooo...'
      ]
    ],
    up: [
      [
        '..oooo..',
        '.ohhhho.',
        '.ohhhho.',
        '..offo..',
        'oossssoo',
        'fssssssf',
        'fssssssf',
        '.osssso.',
        '.oddddo.',
        '.odoodo.',
        '.od..oo.',
        '.oo.....'
      ],
      [
        '..oooo..',
        '.ohhhho.',
        '.ohhhho.',
        '..offo..',
        'oossssoo',
        'fssssssf',
        'fssssssf',
        '.osssso.',
        '.oddddo.',
        '.odoodo.',
        '.oo..do.',
        '.....oo.'
      ]
    ]
  },
  stand: {
    down: [
      '..oooo..',
      '.ohhhho.',
      '.offffo.',
      '.offffo.',
      'oossssoo',
      'fssssssf',
      'fssssssf',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ],
    left: [
      '..oooo..',
      '.ohhhho.',
      '.offhho.',
      '.offfho.',
      '..osso..',
      '..ossso.',
      '..osfso.',
      '..osfso.',
      '..oddo..',
      '..oddo..',
      '..oddo..',
      '..oooo..'
    ],
    up: [
      '..oooo..',
      '.ohhhho.',
      '.ohhhho.',
      '..offo..',
      'oossssoo',
      'fssssssf',
      'fssssssf',
      '.osssso.',
      '.oddddo.',
      '.odoodo.',
      '.od..do.',
      '.oo..oo.'
    ]
  }
};

/** The ball's spin, a frame at a time as it rolls. */
export const ballArt: readonly ArtGrid[] = [
  ['.oo.', 'oowo', 'owwo', '.oo.'],
  ['.oo.', 'owoo', 'owwo', '.oo.'],
  ['.oo.', 'owwo', 'owoo', '.oo.'],
  ['.oo.', 'owwo', 'oowo', '.oo.']
];

/** Status icons, floating over a player's head; its tail points down at them. */
export const statusArt: Readonly<{ tired: ArtGrid }> = {
  tired: [
    '.ooooo.',
    'owwcwwo',
    'owwcwwo',
    'owcccwo',
    'owcccwo',
    'owwcwwo',
    '.ooooo.',
    '..oo...',
    '..o....'
  ]
};
