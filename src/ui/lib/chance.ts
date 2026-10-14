// How a guest's chance of success reads in the interface.

import type { ModalityDef } from '../../core/data';
import type { Chance } from '../../core/sim/stations';
import { deliveryNote } from './delivery';

/** A fraction as a whole percentage. */
export const percent = (x: number) => `${Math.round(x * 100)}%`;

/** A chance as a percentage, with why it is low when something stops the treatment being done properly. */
export function chanceText(c: Chance, def: ModalityDef, staffName: string): string {
  const why = deliveryNote(c.problem, def, staffName);
  return why ? `${percent(c.chance)} (${why})` : percent(c.chance);
}

/** Whether a chance is poor enough to warn about. */
export const poorChance = (c: Chance) => c.chance < 0.5 || c.problem !== '';
