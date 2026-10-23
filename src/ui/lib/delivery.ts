// Explaining why a table can or cannot deliver a treatment.

import { type Discipline, DISCIPLINES, ITEMS, type ModalityDef, ROLES, ROOMS } from '../../core/data';
import { an, article } from '../../core/format';
import type { DeliveryProblem } from '../../core/sim/treatments';

/** What it takes to offer a discipline: where it is delivered, when its room unlocks, or what to build and hire. */
export function disciplineNote(discipline: Discipline, hasRoom: boolean, stars: number): string {
  const disc = DISCIPLINES[discipline];
  const role = ROLES[disc.role].name;
  const room = ROOMS[disc.room];
  if (hasRoom) return `Delivered in the ${room.name} by ${role}s.`;
  if ((room.unlock ?? 0) > stars) return `The ${room.name} unlocks at star ${room.unlock}.`;
  return `Build ${article(room.name)} ${room.name} and hire ${article(role)} ${role} to offer these. Until then, guests who need them will not turn up.`;
}

/** A few words on why a modality cannot be delivered, or on what it is waiting for. Empty when all is well. */
export function deliveryNote(problem: DeliveryProblem, def: ModalityDef, staffName: string | undefined): string {
  switch (problem) {
    case '':
      return staffName ? '' : 'once staffed';
    case 'unqualified':
      return `${staffName?.split(' ')[0] ?? 'Nobody'} is not qualified`;
    case 'no-equipment':
      return def.equipment ? `needs ${an(ITEMS[def.equipment].name)}` : 'needs its equipment';
    case 'out-of-action':
      return `${def.equipment ? ITEMS[def.equipment].name : 'equipment'} is out of action`;
    case 'cold':
      return 'stones are cold';
  }
}
