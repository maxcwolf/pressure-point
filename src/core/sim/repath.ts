// Finding everyone a new way when the building changes under them, and seeing to those left with none.

import type { Char } from '../state/types';
import { rerouteFirefighter } from './blazes';
import { leaveForCall } from './calls';
import type { SimContext } from './context';
import { resetGuest } from './lines';
import { goTo, halt } from './movement';
import { staffIdle } from './posts';
import { backToStudy } from './training';
import { nextRoom } from './visits';

/** Reroute everyone who is walking, and reset anyone who can no longer get where they were going. */
export function repathAll(ctx: SimContext) {
  for (const c of [...ctx.s.guests, ...ctx.s.staff, ...ctx.s.visitors] as Char[]) {
    const d = c.dest;
    if (!d || !c.path) continue;
    const pp = d[4] ? { x: d[2], y: d[3], face: c.endFace, pose: c.endPose, h: c.endH } : undefined;
    if (goTo(ctx, c, d[0], d[1], pp)) continue;
    // someone on a really bad trip stops where they are, and runs on somewhere else
    if (c.kind === 'guest' && c.state === 'running') halt(c);
    else if (c.kind === 'guest') resetGuest(ctx, c);
    // a firefighter who can no longer get to a fire goes to the next, or back to the truck
    else if (c.kind === 'visitor' && c.visit === 'firefighter') rerouteFirefighter(ctx, c);
    // a visitor who can no longer get to a room moves on to the next
    else if (c.kind === 'visitor') nextRoom(ctx, c);
    // someone on their way out with no way out is simply gone, as when they are fired with nowhere to walk
    else if (c.state === 'leaving') ctx.s.staff = ctx.s.staff.filter((st) => st !== c);
    // someone heading out on a house call has gone, as when the walk out runs out under them
    else if (c.state === 'toCall') leaveForCall(ctx, c);
    // someone on their way to a desk tries another way, or another desk, before giving up the course
    else if (c.training) backToStudy(ctx, c);
    else staffIdle(ctx, c);
  }
}
