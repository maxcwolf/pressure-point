// Staff at their posts: taking one up, stepping away from it, and dropping whatever they are doing to be free for
// something else.

import type { Item, Staff } from '../state/types';
import { accessPose, accessTile } from '../world';
import { guestById } from './chars';
import { accessIndex, release } from './claims';
import { isClassLead } from './classes';
import type { SimContext } from './context';
import { recoup } from './economy';
import { resetGuest } from './lines';
import { goTo, halt } from './movement';
import { isLeadStation, matsOf } from './sessions';

/** Set off to work a station, which is theirs from now. False if its staff spot cannot be reached. */
export function takePost(ctx: SimContext, st: Staff, it: Item): boolean {
  const ai = accessIndex(it, 'staff');
  const [x, y] = accessTile(it, ai);
  if (!goTo(ctx, st, x, y, accessPose(it, ai))) return false;
  it.staffId = st.id;
  st.post = it.id;
  st.state = 'toPost';
  return true;
}

/** Step away from the station they were staffing. */
export function leavePost(ctx: SimContext, st: Staff) {
  const it = ctx.world.item(st.post);
  if (it?.staffId === st.id) {
    it.staffId = 0;
    // whoever they had called or were seeing goes back to the line, rather than wait on the table for nobody
    const g = guestById(ctx, it.serving);
    if (g) resetGuest(ctx, g);
    // a class they were leading is called off, and can start again when someone is there to lead it
    if (isClassLead(it) && it.progress > 0) {
      it.progress = 0;
      const room = ctx.world.roomOfItem(it);
      if (room) delete room.lastClass;
    }
    // and at the bowls, so does everyone lying on the mats they played for
    if (isLeadStation(it))
      for (const m of matsOf(ctx, it)) {
        const lying = guestById(ctx, m.serving);
        if (lying) resetGuest(ctx, lying);
      }
  }
  st.post = 0;
  st.busy = false;
  delete st.lineT;
}

/** Give up the cleaning, watering or repair job they had claimed. */
export function dropJob(ctx: SimContext, st: Staff) {
  const job = st.job;
  if (!job) return;
  const claimed =
    job.kind === 'litter'
      ? ctx.s.litter.find((x) => x.id === job.id)
      : job.kind === 'smudge'
        ? ctx.s.rooms.find((r) => r.id === job.id)
        : // a soul retrieval is for a member of staff, and a runner is calmed wherever they are: neither claims anything
          job.kind === 'soul' || job.kind === 'ward' || job.kind === 'calm'
          ? undefined
          : ctx.world.item(job.id);
  if (claimed?.claimedBy === st.id) claimed.claimedBy = 0;
  st.job = null;
}

/** Drop whatever a member of staff is doing and leave them free for new work. */
export function staffIdle(ctx: SimContext, st: Staff) {
  if (st.training) {
    // interrupted before finishing: the course fee comes back
    recoup(ctx, st.training.cost, 'training');
    st.training = null;
  }
  leavePost(ctx, st);
  release(ctx, st);
  dropJob(ctx, st);
  halt(st);
  st.state = 'idle';
  st.timer = 0.2;
}
