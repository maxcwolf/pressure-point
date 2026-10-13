// What a newly earned star opens up.

import { type Discipline, MODALITIES, MODALITY_ORDER, modalityLabel, ROOM_ORDER, ROOMS } from '../../core/data';
import { available } from './catalog';

/** The rooms a star unlocks, as "icon name" labels, leaving out any whose discipline is switched off. */
export function roomsUnlockedAt(star: number, enabled: (d: Discipline) => boolean): string[] {
  return ROOM_ORDER.filter((t) => ROOMS[t].unlock === star && available(ROOMS[t].discipline, enabled)).map(
    (t) => `${ROOMS[t].icon} ${ROOMS[t].name}`,
  );
}

/** The treatments a star unlocks, as "icon name" labels, leaving out any whose discipline is switched off. */
export function treatmentsUnlockedAt(star: number, enabled: (d: Discipline) => boolean): string[] {
  return MODALITY_ORDER.filter((m) => MODALITIES[m].star === star && enabled(MODALITIES[m].discipline)).map(
    (m) => `${MODALITIES[m].icon} ${modalityLabel(m)}`,
  );
}
