// The centers a game can be set in: the sandbox, and the campaign's.

import { SANDBOX_PLOT } from './map';
import type { CenterDef, CenterId } from './types';

/** The starting money a sandbox game can be set to. */
export const SANDBOX_MONEY: readonly number[] = [10000, 30000, 75000, 200000];

export const CENTERS: Readonly<Record<CenterId, CenterDef>> = {
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    place: 'A big lot of your own',
    blurb: 'Build the center you want, at your own pace.',
    plot: SANDBOX_PLOT,
    width: 44,
    plots: [
      {
        id: 'east-wing',
        name: 'The east wing',
        blurb: 'Empty offices next door, as deep as the building',
        rects: [{ x0: 28, x1: 35, y0: 3, y1: 17 }],
        price: 24000,
        star: 0,
      },
      {
        id: 'back-gallery',
        name: 'The back gallery',
        blurb: 'A long, narrow strip along the back wall',
        rects: [{ x0: 8, x1: 22, y0: 1, y1: 2 }],
        price: 7500,
        star: 1,
      },
      {
        id: 'garden-block',
        name: 'The garden pavilion',
        blurb: 'A building of its own on the old allotments, past the east wing, with a path from the pavement',
        rects: [{ x0: 38, x1: 42, y0: 8, y1: 17 }],
        entrance: { side: 'south', x: 39, y: 17 },
        path: [{ x0: 39, x1: 40, y0: 18, y1: 19 }],
        price: 18000,
        star: 1,
        after: 'east-wing',
      },
      {
        id: 'west-annex',
        name: 'The west annex',
        blurb: 'A slim lean-to along the west wall',
        rects: [{ x0: 1, x1: 2, y0: 6, y1: 17 }],
        price: 6000,
        star: 2,
      },
    ],
    startMoney: 30000,
    climate: { average: 66, swing: 6 },
    disciplines: ['acupuncture', 'reiki', 'sound', 'shaman'],
    mishap: 'power',
    goals: [
      [
        { kind: 'healed', count: 8 },
        { kind: 'reputation', percent: 40 },
      ],
      [
        { kind: 'healed', count: 30 },
        { kind: 'reputation', percent: 60 },
        { kind: 'balance', amount: 50000 },
      ],
      [
        { kind: 'healed', count: 80 },
        { kind: 'reputation', percent: 80 },
        { kind: 'balance', amount: 120000 },
      ],
    ],
  },
  willow: {
    id: 'willow',
    name: 'Willow Lane',
    place: 'A small high-street unit',
    blurb: 'Where it all starts: one massage suite, a few loyal regulars, and a lot to learn.',
    plot: { x0: 7, x1: 22, y0: 8, y1: 17, door: [14, 15] },
    plots: [
      {
        id: 'unit-next-door',
        name: 'The empty unit next door',
        blurb: 'The shop to the east, empty since the florist closed',
        rects: [{ x0: 23, x1: 29, y0: 10, y1: 17 }],
        price: 12000,
        star: 1,
      },
      {
        id: 'back-room',
        name: 'The back room',
        blurb: 'Storage out the back, cleared out at last',
        rects: [{ x0: 9, x1: 18, y0: 3, y1: 7 }],
        price: 10000,
        star: 2,
      },
      {
        id: 'west-unit',
        name: 'The shop to the west',
        blurb: 'A narrow unit that used to mend shoes',
        rects: [{ x0: 2, x1: 6, y0: 11, y1: 17 }],
        price: 8000,
        star: 2,
      },
    ],
    startMoney: 20000,
    climate: { average: 60, swing: 12 },
    disciplines: [],
    goals: [
      [
        { kind: 'healed', count: 5 },
        { kind: 'reputation', percent: 35 },
      ],
      [
        { kind: 'healed', count: 15 },
        { kind: 'prestige', room: 'massage', level: 2 },
        { kind: 'cureRate', percent: 70 },
      ],
      [
        { kind: 'healed', count: 40 },
        { kind: 'balance', amount: 25000 },
        { kind: 'noQuits', days: 30 },
      ],
    ],
  },
  exchange: {
    id: 'exchange',
    name: 'The Exchange',
    place: 'Downtown, between the office towers',
    blurb:
      'Desk workers by the busload, arriving in waves when the office crowd comes in. Acupuncture opens at the first star.',
    plot: { x0: 5, x1: 25, y0: 6, y1: 17, door: [14, 15] },
    width: 36,
    plots: [
      {
        id: 'courtyard-block',
        name: 'The courtyard block',
        blurb: 'Three wings round a little courtyard at the back',
        rects: [
          { x0: 6, x1: 24, y0: 1, y1: 2 },
          { x0: 6, x1: 8, y0: 3, y1: 5 },
          { x0: 22, x1: 24, y0: 3, y1: 5 },
        ],
        price: 21000,
        star: 1,
      },
      {
        id: 'annex',
        name: 'The annex',
        blurb: 'Offices to the east, let go by a firm that moved uptown',
        rects: [{ x0: 26, x1: 33, y0: 8, y1: 17 }],
        price: 20000,
        star: 2,
      },
    ],
    startMoney: 25000,
    climate: { average: 62, swing: 14 },
    disciplines: ['acupuncture'],
    conditions: { slump: 3, band: 2.5, crick: 2.5, neck: 3, steam: 2 },
    rush: { peak: 2.4, lull: 0.6, impatience: 1.25 },
    mishap: 'power',
    calls: {
      often: 2,
      clients: ['the Exchange Tower', 'Halberd & Finch, solicitors', 'the trading floor on Mercer Street'],
    },
    goals: [
      [
        { kind: 'healed', count: 15 },
        { kind: 'reputation', percent: 40 },
        { kind: 'wait', days: 3 },
      ],
      [
        { kind: 'healed', count: 45 },
        { kind: 'healed', count: 10, discipline: 'acupuncture' },
        { kind: 'cureRate', percent: 75 },
      ],
      [
        { kind: 'healed', count: 110 },
        { kind: 'reputation', percent: 70 },
        { kind: 'emergencies', count: 1 },
        { kind: 'balance', amount: 60000 },
      ],
    ],
  },
  boardwalk: {
    id: 'boardwalk',
    name: 'The Boardwalk',
    place: 'A seaside town',
    blurb:
      'Packed in summer, half asleep in winter, and the sea air is hard on equipment. Reiki opens at the second star.',
    plot: { x0: 4, x1: 26, y0: 7, y1: 16, door: [14, 15] },
    width: 40,
    plots: [
      {
        id: 'beach-wing',
        name: 'The beach-facing wing',
        blurb: 'Rooms looking out over the sand to the sea',
        rects: [{ x0: 8, x1: 20, y0: 3, y1: 6 }],
        price: 11000,
        star: 1,
      },
      {
        id: 'ice-cream-parlor',
        name: 'The old ice-cream parlor',
        blurb: 'A little shop of its own next door, shut since the summer it rained',
        rects: [{ x0: 32, x1: 38, y0: 9, y1: 16 }],
        entrance: { side: 'south', x: 34, y: 16 },
        path: [{ x0: 34, x1: 35, y0: 17, y1: 19 }],
        price: 13500,
        star: 2,
      },
    ],
    startMoney: 30000,
    climate: { average: 66, swing: 22 },
    disciplines: ['acupuncture', 'reiki'],
    conditions: { lobstered: 3, sealegs: 2.5, gull: 2.5 },
    seasons: { summer: 1.9, winter: 0.6 },
    wear: 1.4,
    scenery: 'seaside',
    mishap: 'storm',
    calls: { often: 1, clients: ['the Boardwalk Beach Club', 'the lifeboat station', 'the pier theater'] },
    goals: [
      [
        { kind: 'healed', count: 25 },
        { kind: 'reputation', percent: 45 },
        { kind: 'balance', amount: 20000 },
      ],
      [
        { kind: 'healed', count: 70 },
        { kind: 'cureRate', percent: 75 },
        { kind: 'wait', days: 2.5 },
      ],
      [
        { kind: 'healed', count: 160 },
        { kind: 'healed', count: 15, discipline: 'reiki' },
        { kind: 'reputation', percent: 75 },
        { kind: 'noQuits', days: 60 },
      ],
    ],
  },
  highpines: {
    id: 'highpines',
    name: 'High Pines',
    place: 'A lodge up in the mountains',
    blurb:
      'Cold all year, and snowed in now and then through the winter, so keep the place warm and the stones hot. Sound healing opens at the first star, and reiki at the second.',
    plot: { x0: 6, x1: 25, y0: 5, y1: 16, door: [15, 16] },
    width: 36,
    plots: [
      {
        id: 'ski-room',
        name: 'The ski room',
        blurb: 'Where the lodge kept its skis, to the east',
        rects: [{ x0: 26, x1: 33, y0: 7, y1: 16 }],
        price: 16000,
        star: 1,
      },
      {
        id: 'woodshed',
        name: 'The old woodshed',
        blurb: 'Out the back, with a stove that still works',
        rects: [{ x0: 10, x1: 17, y0: 1, y1: 4 }],
        price: 7000,
        star: 2,
      },
    ],
    startMoney: 35000,
    climate: { average: 44, swing: 18 },
    disciplines: ['acupuncture', 'reiki', 'sound'],
    conditions: { frost: 3, coldfeet: 2.5, steam: 1.5, frozen: 3, wipeout: 2.5, cabin: 2.5 },
    snow: { chance: 0.3, days: 2 },
    // a little busier than the road up suggests, to make up for the days it is snowed in
    arrivals: 1.05,
    scenery: 'mountain',
    mishap: 'freeze',
    calls: { often: 1, clients: ['the ski school', 'the Summit Hotel', 'the mountain rescue hut'] },
    goals: [
      [
        { kind: 'healed', count: 25 },
        { kind: 'reputation', percent: 45 },
        { kind: 'balance', amount: 25000 },
      ],
      [
        { kind: 'healed', count: 70 },
        { kind: 'healed', count: 10, discipline: 'sound' },
        { kind: 'reputation', percent: 60 },
        { kind: 'wait', days: 2.5 },
      ],
      [
        { kind: 'healed', count: 160 },
        { kind: 'healed', count: 15, discipline: 'reiki' },
        { kind: 'cureRate', percent: 80 },
        { kind: 'noQuits', days: 60 },
      ],
    ],
  },
  orchard: {
    id: 'orchard',
    name: 'The Orchard Estate',
    place: 'A country resort among the apple orchards',
    blurb:
      'Wealthy guests who pay handsomely and expect beautiful rooms, and a health inspector who calls twice as often. Acupuncture, reiki, sound healing and a Shaman are open from the start.',
    plot: { x0: 4, x1: 27, y0: 5, y1: 16, door: [15, 16] },
    width: 40,
    plots: [
      {
        id: 'orangery',
        name: 'The orangery',
        blurb: 'A long glasshouse of its own to the east, full of light, with a path from the pavement',
        rects: [{ x0: 32, x1: 38, y0: 5, y1: 16 }],
        entrance: { side: 'south', x: 34, y: 16 },
        path: [{ x0: 34, x1: 35, y0: 17, y1: 19 }],
        price: 24000,
        star: 0,
      },
      {
        id: 'cider-barn',
        name: 'The cider barn',
        blurb: 'Out the back, still smelling of apples',
        rects: [{ x0: 8, x1: 19, y0: 1, y1: 4 }],
        price: 14000,
        star: 2,
      },
    ],
    startMoney: 45000,
    climate: { average: 62, swing: 16 },
    disciplines: ['acupuncture', 'reiki', 'sound', 'shaman'],
    conditions: { windfall: 3, croquet: 2.5, blossom: 2.5, neck: 1.5 },
    unlockedFrom: 2,
    picky: { fee: 1.5, expects: 2 },
    inspections: 2,
    scenery: 'orchard',
    mishap: 'wasps',
    calls: { often: 1.5, clients: ['the manor house', 'the croquet club', 'the cider press tasting room'] },
    goals: [
      [
        { kind: 'healed', count: 30 },
        { kind: 'reputation', percent: 50 },
        { kind: 'grade', grade: 1 },
      ],
      [
        { kind: 'healed', count: 90 },
        { kind: 'cureRate', percent: 80 },
        { kind: 'prestige', room: 'massage', level: 4 },
        { kind: 'grade', grade: 2 },
      ],
      [
        { kind: 'healed', count: 200 },
        { kind: 'reputation', percent: 80 },
        { kind: 'balance', amount: 150000 },
        { kind: 'grade', grade: 3 },
      ],
    ],
  },
};

/** The campaign's centers, in the order they are played. */
export const CAMPAIGN: readonly CenterId[] = ['willow', 'exchange', 'boardwalk', 'highpines', 'orchard'];

/** The center a game is set in. */
export const centerOf = (s: { center: CenterId }) => CENTERS[s.center];
