// The lines guests wait in: choosing the best one for what they need next, waiting in it, being put back in it, and
// leaving them all to go home.

import { conditionOf, type Discipline, ITEMS, MODALITIES } from '../data';
import { pick } from '../random';
import type { Guest, Item } from '../state/types';
import { at } from '../util';
import { accessPose, accessTile, rotVec, Z_CORRIDOR } from '../world';
import { streetTile } from './chars';
import { accessIndex, claim, findAccess, release } from './claims';
import type { SimContext } from './context';
import { tipOnce } from './events';
import { MACHINE_PULL } from './machines';
import { goTo, halt } from './movement';
import { carriedOut } from './outbreaks';
import { askedFor } from './regulars';
import { stationStaff } from './sessions';
import { deliveryProblem, leftForSpecialist, modalityOf, treatsHere } from './treatments';

/** The best usable station for a guest's current goal, if there is one. */
export function pickStation(ctx: SimContext, g: Guest): Item | null {
  const goal = g.goal;
  let best: Item | null = null;
  let bestScore = 1e9;
  for (const it of ctx.s.items) {
    const st = ITEMS[it.type].station;
    if (st?.goal !== goal || !ctx.world.usable(it)) continue;
    if (goal === 'treat' && !treatsHere(it, modalityOf(g))) continue;
    const score = stationScore(ctx, it, g);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

/** How many more guests a regular will wait behind to be seen by the Name on the Door they ask for. */
export const ASKED_FOR_PULL = 3;

/** Lower is better. Guests steer toward tables that can actually deliver what they need. */
export function stationScore(ctx: SimContext, it: Item, g: Guest) {
  const staff = stationStaff(ctx, it);
  // a station that runs itself is never short of someone to work it
  let score = it.queue.length + (it.serving ? 1 : 0) + (staff || !ITEMS[it.type].station?.staff ? 0 : 2.5);
  if (ITEMS[it.type].station?.goal === 'treat') {
    // a regular waits behind a few more guests for the Name on the Door they ask for
    if (staff && askedFor(ctx, g) === staff.id) score -= ASKED_FOR_PULL;
    const problem = deliveryProblem(ctx, it, staff, modalityOf(g));
    // someone untrained is a last resort, and no resort at all while a colleague trained for it is about
    // and a table without the specialty item can never do it properly, whoever comes to work it
    if (problem === 'unqualified') score += staff && leftForSpecialist(ctx, staff, g) ? 40 : 6;
    else if (problem) score += 60;
    // between a table and a machine doing the same work, the machine is quicker, so a tie goes to it
    if (ITEMS[it.type].machine) score -= MACHINE_PULL;
  }
  return score;
}

/** Join the line at the best station for a guest's goal, or head home if they are done. */
export function decide(ctx: SimContext, g: Guest) {
  if (g.goal === 'leave') {
    leave(ctx, g);
    return;
  }
  const st = pickStation(ctx, g);
  g.station = st ? st.id : 0;
  g.placed = false;
  if (st) {
    // a guest asked back after a complaint goes to the front of every line, and is kept there
    if (g.comp === undefined) st.queue.push(g.id);
    else {
      st.queue.unshift(g.id);
      g.placed = true;
    }
    if (st.queue.length >= 4)
      tipOnce(
        ctx,
        'queue',
        `A line is building at the ${ITEMS[st.type].name}. Click it to see who is waiting: you can move guests up the line, send them to another one, or send them home.`,
        'info',
        { kind: 'item', id: st.id },
      );
  }
  goWait(ctx, g);
}

/** Put a guest back to square one of their current goal. */
export function resetGuest(ctx: SimContext, g: Guest) {
  release(ctx, g);
  removeFromStations(ctx, g);
  halt(g);
  decide(ctx, g);
}

/** The n-th spot in the line in front of a reception desk. */
export function queueTile(ctx: SimContext, it: Item, n: number): [number, number] {
  const ai = accessIndex(it, 'guest');
  const [ax, ay] = accessTile(it, ai);
  const face = at(ITEMS[it.type].access, ai).face;
  const [dx, dy] = rotVec(it.rot, -face[0], -face[1]);
  let x = ax;
  let y = ay;
  for (let i = 0; i <= n; i++) {
    const nx = x + dx;
    const ny = y + dy;
    if (
      !ctx.world.inside(nx, ny) ||
      ctx.world.zone[ctx.world.idx(nx, ny)] !== Z_CORRIDOR ||
      ctx.world.blocked[ctx.world.idx(nx, ny)]
    ) {
      const spots = ctx.world.standSpots(ax, ay, n + 6);
      return spots[Math.min(spots.length - 1, n + 2)] ?? [ax, ay];
    }
    x = nx;
    y = ny;
  }
  return [x, y];
}

/** The spot a guest waits near: their station's door, or the entrance if they have no station. */
export function waitAnchor(ctx: SimContext, g: Guest): [number, number] {
  const st = ctx.world.item(g.station);
  if (st) {
    const room = ctx.world.roomOfItem(st);
    if (room) return [room.door.x + room.door.dx, room.door.y + room.door.dy];
    return accessTile(st, accessIndex(st, 'guest'));
  }
  const { door, front } = ctx.world.building;
  return [door[0], front - 3];
}

/** Send a guest to wait: in line at reception, otherwise on a nearby seat or standing spot. */
export function goWait(ctx: SimContext, g: Guest) {
  release(ctx, g);
  g.state = 'toWait';
  g.needKind = '';
  const st = ctx.world.item(g.station);
  let ok = false;
  if (st && ITEMS[st.type].station?.goal === 'reception') {
    const [qx, qy] = queueTile(ctx, st, Math.max(0, st.queue.indexOf(g.id)));
    ok = goTo(ctx, g, qx, qy);
  } else {
    const [ax, ay] = waitAnchor(ctx, g);
    const seat = findAccess(ctx, 'seat', ax, ay, 11);
    if (seat) {
      claim(ctx, g, seat.item, seat.idx);
      const [sx, sy] = accessTile(seat.item, seat.idx);
      ok = goTo(ctx, g, sx, sy, accessPose(seat.item, seat.idx));
      if (!ok) release(ctx, g);
    }
    if (!ok) {
      const spots = ctx.world.standSpots(ax, ay, 14);
      if (spots.length) {
        const [sx, sy] = pick(ctx.s, spots);
        ok = goTo(ctx, g, sx, sy);
      }
    }
  }
  if (!ok) {
    halt(g);
    g.state = 'waiting';
  }
}

/** Send a guest home. */
export function leave(ctx: SimContext, g: Guest) {
  carriedOut(ctx, g);
  release(ctx, g);
  removeFromStations(ctx, g);
  g.goal = 'leave';
  g.state = 'leaving';
  delete g.runaway;
  const [x, y] = streetTile(ctx.s, ctx.world.building, ctx.world.w);
  if (!goTo(ctx, g, x, y)) ctx.s.guests = ctx.s.guests.filter((q) => q !== g);
}

/** Take a guest out of every line and off every station. */
export function removeFromStations(ctx: SimContext, g: Guest) {
  for (const it of ctx.s.items) {
    if (it.serving === g.id) it.serving = 0;
    if (it.queue.includes(g.id)) it.queue = it.queue.filter((id) => id !== g.id);
  }
  g.station = 0;
}

/** Whether a guest's condition is still worsening: untreated, in the building, and not on the table. */
export const worsening = (g: Guest) => !g.classDay && !g.outcome && g.goal !== 'leave' && g.state !== 'served';

/** What a waiting guest is waiting for, as a line is named: the discipline once diagnosed, and to be seen before. */
export type LineKey = Discipline | 'consult';

/** Which line a guest is in, as far as the warnings group them. */
export const lineOf = (g: Guest): LineKey =>
  g.goal === 'treat' ? MODALITIES[conditionOf(g.condition).modality].discipline : 'consult';
