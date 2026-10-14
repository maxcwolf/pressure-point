// The player's hand in who is seen when: moving guests along a line, to another line, or home.

import { ITEMS, SEND_HOME_REP } from '../data';
import type { Guest, Item } from '../state/types';
import { guestById, say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit } from './events';
import { goWait, leave } from './guests';
import { countVisit } from './records';
import { removeFromStations } from './stations';

/** Whether a guest is waiting their turn, rather than being seen or on their way out. */
export function inLine(g: Guest): boolean {
  return g.state === 'waiting' || g.state === 'toWait' || g.state === 'toNeed' || g.state === 'need';
}

/** The other working stations that do the same job as this one, for the same discipline. */
export function sameKind(ctx: SimContext, it: Item): Item[] {
  const def = ITEMS[it.type].station;
  if (!def) return [];
  return ctx.s.items.filter((o) => {
    const od = ITEMS[o.type].station;
    return o !== it && od?.goal === def.goal && od.discipline === def.discipline && ctx.world.usable(o);
  });
}

/** Of the other stations doing the same job, the one with the shortest line, if there is one. */
export function shortestOtherLine(ctx: SimContext, it: Item): Item | undefined {
  return sameKind(ctx, it).sort((a, b) => a.queue.length - b.queue.length)[0];
}

/** Move a guest up (negative) or down (positive) their line. False if they cannot move that way. */
export function moveInLine(ctx: SimContext, guestId: number, by: number): boolean {
  const g = guestById(ctx, guestId);
  const it = g && ctx.world.item(g.station);
  if (!g || !it || !inLine(g)) return false;
  const from = it.queue.indexOf(g.id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= it.queue.length) return false;
  it.queue.splice(from, 1);
  it.queue.splice(to, 0, g.id);
  g.placed = true;
  return true;
}

/** Send a waiting guest to the end of another station's line, if it does the same job. */
export function moveToStation(ctx: SimContext, guestId: number, stationId: number): boolean {
  const g = guestById(ctx, guestId);
  const from = g && ctx.world.item(g.station);
  const to = ctx.world.item(stationId);
  if (!g || !from || !to || !inLine(g) || !sameKind(ctx, from).includes(to)) return false;
  removeFromStations(ctx, g);
  to.queue.push(g.id);
  g.station = to.id;
  g.placed = true;
  // someone off to the toilet or the tea station finishes first, and comes back to the new line
  if (g.state === 'waiting' || g.state === 'toWait') goWait(ctx, g);
  return true;
}

/** Send a guest home untreated: no fee for treatment, and a small knock to reputation. */
export function sendHome(ctx: SimContext, guestId: number): boolean {
  const g = guestById(ctx, guestId);
  if (!g || g.state === 'leaving') return false;
  g.outcome = 'sent';
  countVisit(ctx, g, 'sent');
  changeRep(ctx, -SEND_HOME_REP);
  say(g, '🏠', 6);
  emit(ctx, { type: 'float', text: 'Sent home', x: g.x, y: g.y, kind: 'info' });
  leave(ctx, g);
  return true;
}
