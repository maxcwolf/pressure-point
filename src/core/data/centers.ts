// The centers a game can be set in: the sandbox, and the campaign's.

import { SANDBOX_PLOT } from './map';
import type { CenterDef, CenterId } from './types';

export const CENTERS: Readonly<Record<CenterId, CenterDef>> = {
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    place: 'A big lot of your own',
    blurb: 'Build the center you want, at your own pace.',
    plot: SANDBOX_PLOT,
    startMoney: 30000,
    disciplines: ['acupuncture', 'reiki'],
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
    startMoney: 20000,
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
      'Desk workers by the busload, all arriving at once before and after work. Acupuncture opens at the first star.',
    plot: { x0: 5, x1: 25, y0: 6, y1: 17, door: [14, 15] },
    startMoney: 25000,
    disciplines: ['acupuncture'],
    conditions: { slump: 3, band: 2.5, crick: 2.5, neck: 3, steam: 2 },
    rush: { peak: 2.4, lull: 0.6, impatience: 1.25 },
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
};

/** The campaign's centers, in the order they are played. */
export const CAMPAIGN: readonly CenterId[] = ['willow', 'exchange'];

/** The center a game is set in. */
export const centerOf = (s: { center: CenterId }) => CENTERS[s.center];
