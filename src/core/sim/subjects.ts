// Finding what a message is about: where it stands, if it is still there.

import { itemCenter } from '../world';
import { guestById, staffById } from './chars';
import type { SimContext } from './context';
import type { Subject } from './events';

/** Where on the ground a subject is now, or null if it has gone (left, sold or demolished). */
export function subjectSpot(ctx: SimContext, about: Subject): [x: number, y: number] | null {
  if (about.kind === 'staff' || about.kind === 'guest' || about.kind === 'visitor') {
    const who =
      about.kind === 'staff'
        ? staffById(ctx, about.id)
        : about.kind === 'guest'
          ? guestById(ctx, about.id)
          : ctx.s.visitors.find((v) => v.id === about.id);
    return who ? [who.x, who.y] : null;
  }
  if (about.kind === 'item') {
    const it = ctx.world.item(about.id);
    return it ? itemCenter(it) : null;
  }
  const room = ctx.s.rooms.find((r) => r.id === about.id);
  return room ? [room.x + room.w / 2, room.y + room.h / 2] : null;
}
