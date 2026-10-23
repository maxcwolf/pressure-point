// How the inspector's bars are colored: one rule for every bar about how someone or something is doing, so green is
// always fine, amber always worth a look and red always trouble, whichever way the bar runs.

import { POOR_CONDITION, WEAR_REPAIR } from '../../core/data';

/** What a bar's color says: fine, worth a look, or trouble. */
export type MeterTone = 'good' | 'warn' | 'bad';

/** Where a measure turns amber and then red, and whether it is a rise that is the worry. */
interface Scale {
  /** amber from here */
  warn: number;
  /** red from here */
  bad: number;
  /** true for a need that worsens as it fills (thirst, hunger, bladder, wear); false for a level that worsens as it empties */
  rising: boolean;
}

/** The measures the inspector draws as bars, and where each turns amber and red. */
export const METERS = {
  // a guest seeks a drink, a snack or the restroom from about 70 to 75 and suffers at 100; staff go for one from 60
  need: { warn: 60, bad: 85, rising: true },
  // patience: a long wait is felt under 35, and at nothing they storm out
  patience: { warn: 50, bad: 25, rising: false },
  // a guest's condition: under POOR_CONDITION treatment works less often and the clock runs out soon
  condition: { warn: 60, bad: POOR_CONDITION, rising: false },
  // staff slow down under 15 to 20 and take a break
  energy: { warn: 40, bad: 20, rising: false },
  // misery, and the countdown to quitting, start under 25; a rival can poach under 35
  morale: { warn: 50, bad: 30, rising: false },
  // an item's wear: a Caretaker comes to repair it from WEAR_REPAIR, and at 100 it is broken
  wear: { warn: WEAR_REPAIR * 0.6, bad: WEAR_REPAIR, rising: true },
} as const satisfies Readonly<Record<string, Scale>>;

/** A measure the inspector draws as a bar. */
export type Meter = keyof typeof METERS;

/** Whether a measure is fine, worth a look or trouble, by where it stands on its scale. */
export function meterTone(meter: Meter, value: number): MeterTone {
  const { warn, bad, rising } = METERS[meter];
  if (rising) return value >= bad ? 'bad' : value >= warn ? 'warn' : 'good';
  return value < bad ? 'bad' : value < warn ? 'warn' : 'good';
}

/** The number shown beside a bar: its value rounded, kept between 0 and 100. */
export function meterValue(value: number): string {
  return String(Math.round(Math.max(0, Math.min(100, value))));
}

/** The words beside a progress bar: how far along it is, as a percentage. */
export function meterPercent(value: number): string {
  return `${meterValue(value)}%`;
}
