// Mishaps: one for each center but Willow Lane. Each is announced a few days ahead, can be prepared for at a price,
// and while it lasts takes some of the center out of action or keeps guests away.

import type { ItemType } from './types';

export type MishapId = 'power' | 'storm' | 'freeze' | 'wasps';

/** One kind of mishap: what it is called, what it does, and how to prepare for it. */
export interface MishapDef {
  id: MishapId;
  name: string;
  icon: string;
  /** What the speakers say a few days before, as it starts, and as it ends. */
  warning: string;
  start: string;
  end: string;
  /** How many days it lasts. */
  days: number;
  /** What preparing costs, what the button says, and what it does, in a line for the notice. */
  prepare: { cost: number; label: string; effect: string };
  /** What it does unprepared, in a line for the notice. */
  harm: string;
  /** The items it takes out of action unprepared, and those in a few words for the advisor. */
  stops?: readonly ItemType[];
  stopsWhat?: string;
  /** How many guests arrive while it lasts, against usual. */
  arrivals?: number;
  /** Unprepared: how many items it breaks as it starts. */
  breaks?: number;
  /** The season it can only come in, if any. */
  winterOnly?: boolean;
}

export const MISHAPS: Readonly<Record<MishapId, MishapDef>> = {
  power: {
    id: 'power',
    name: 'Power cut',
    icon: '🔌',
    warning: 'The power company will be working on the lines this week. Expect a power cut.',
    start: 'The power is out. Anything with a plug is now a very expensive ornament.',
    end: 'The power is back. Please stop meditating by candlelight.',
    days: 1,
    prepare: { cost: 1500, label: 'Hire a generator', effect: 'A generator keeps everything running.' },
    harm: 'For a day, nothing with a plug works: scanners, stim units, stone warmers, machines, radiators and air conditioning.',
    stops: [
      'posture_scanner',
      'stim_unit',
      'stone_warmer',
      'arcade_machine',
      'coffee_machine',
      'snack_machine',
      'fortune_teller',
      'staff_fridge',
      'radiator',
      'air_conditioner',
    ],
    stopsWhat: 'anything with a plug',
  },
  storm: {
    id: 'storm',
    name: 'Storm',
    icon: '⛈️',
    warning: 'A storm is coming in off the sea later this week. Batten down the hatches.',
    start: 'The storm has arrived. Please keep away from the windows... and Brent.',
    end: 'The storm has passed. The seagulls are back, and so are the guests.',
    days: 2,
    prepare: { cost: 800, label: 'Board up the windows', effect: 'Nothing gets broken. Fewer guests come either way.' },
    harm: 'For two days hardly anyone comes, and the wind breaks a few things as it starts.',
    arrivals: 0.35,
    breaks: 3,
  },
  freeze: {
    id: 'freeze',
    name: 'Big freeze',
    icon: '🥶',
    warning: 'A big freeze is forecast later this week. The pipes are nervous.',
    start: 'The pipes have frozen. Please hold on, in every sense.',
    end: 'The pipes have thawed. Normal flushing is resumed.',
    days: 2,
    prepare: { cost: 1200, label: 'Lag the pipes', effect: 'The water keeps running through the freeze.' },
    harm: 'For two days the toilets, sinks, drinks and radiators are out of action.',
    stops: ['toilet', 'sink', 'water_cooler', 'tea_station', 'fountain', 'koi_pond', 'radiator'],
    stopsWhat: 'the water',
    winterOnly: true,
  },
  wasps: {
    id: 'wasps',
    name: 'Wasps',
    icon: '🐝',
    warning: 'It is harvest week in the orchards, and the wasps have noticed.',
    start: 'Wasps have found the snacks. Please walk calmly and do not wave your arms.',
    end: 'The wasps have gone back to the orchards.',
    days: 2,
    prepare: { cost: 900, label: 'Call pest control', effect: 'The wasps are seen off before they settle.' },
    harm: 'For two days nobody can get near the snacks, drinks or bins.',
    stops: ['snack_machine', 'tea_station', 'kombucha_tap', 'coffee_machine', 'water_cooler', 'bin'],
    stopsWhat: 'the snacks, drinks and bins',
  },
};

/** Days ahead a mishap is announced, the first day one may come, and days between one and the next. */
export const MISHAP_NOTICE_DAYS = 3;
export const MISHAP_FIRST_DAY = 75;
export const MISHAP_GAP_DAYS: readonly [number, number] = [80, 140];
/** Days until a mishap that is out of season is looked at again. */
export const MISHAP_RETRY_DAYS = 10;

/** Whether a mishap, as it stands, takes items of this type out of action. */
export function mishapStopsType(def: MishapDef, type: ItemType, prepared: boolean): boolean {
  return !prepared && !!def.stops?.includes(type);
}
