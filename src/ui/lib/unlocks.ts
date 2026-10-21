// What a newly earned star opens up.

import {
  type CenterId,
  type Discipline,
  MODALITIES,
  MODALITY_ORDER,
  modalityLabel,
  type Offering,
  ROOM_ORDER,
  roomHere,
  ROOMS,
  type RoomType,
} from '../../core/data';
import { available, roomOffering } from './catalog';

/**
 * What the star dialog says about the rooms a star unlocks, or '' if none: treatment rooms bring in a new kind of
 * guest once staffed, and any other room says what it is for.
 */
export function newRoomsText(star: number, enabled: (d: Offering) => boolean, center?: CenterId): string {
  const types = ROOM_ORDER.filter(
    (t) => ROOMS[t].unlock === star && (!center || roomHere(ROOMS[t], center)) && available(roomOffering(t), enabled),
  );
  /** A room's "icon name" label. */
  const label = (t: RoomType) => `${ROOMS[t].icon} ${ROOMS[t].name}`;
  const treatment = types.filter((t) => ROOMS[t].discipline);
  const parts = treatment.length
    ? [`${treatment.map(label).join(', ')}. Build one and hire its staff to bring in a new kind of guest.`]
    : [];
  for (const t of types.filter((t) => !ROOMS[t].discipline)) parts.push(`${label(t)}: ${ROOMS[t].desc}`);
  return parts.join(' ');
}

/**
 * The treatments a star unlocks, as "icon name" labels, leaving out any whose discipline is switched off, and a
 * machine's own, which comes with its room.
 */
export function treatmentsUnlockedAt(star: number, enabled: (d: Discipline) => boolean): string[] {
  return MODALITY_ORDER.filter(
    (m) => MODALITIES[m].star === star && !MODALITIES[m].machine && enabled(MODALITIES[m].discipline),
  ).map((m) => `${MODALITIES[m].icon} ${modalityLabel(m)}`);
}
