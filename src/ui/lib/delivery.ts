// Explaining why a table can or cannot deliver a treatment.

import { ITEMS, type ModalityDef } from '../../core/data';
import type { DeliveryProblem } from '../../core/sim/treatments';

/** A few words on why a modality cannot be delivered, or on what it is waiting for. Empty when all is well. */
export function deliveryNote(problem: DeliveryProblem, def: ModalityDef, staffName: string | undefined): string {
  switch (problem) {
    case '':
      return staffName ? '' : 'once staffed';
    case 'unqualified':
      return `${staffName?.split(' ')[0] ?? 'Nobody'} is not qualified`;
    case 'no-equipment':
      return `needs a ${def.equipment ? ITEMS[def.equipment].name : ''}`;
    case 'cold':
      return 'stones are cold';
  }
}
