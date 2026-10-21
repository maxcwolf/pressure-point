// The player's hand in who is seen when: moving guests along a line, to another line, or home.

import { ITEMS, MODALITIES, SEND_HOME_REP } from '../data';
import type { Guest, Item } from '../state/types';
import { guestById, say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit } from './events';
import { goWait, leave } from './guests';
import { treatsHere } from './machines';
import { countVisit } from './records';
import { removeFromStations } from './stations';
import { modalityOf } from './treatments';

/** Whether a guest is waiting their turn, rather than being seen or on their way out. */
export function inLine(g: Guest): boolean {
  return g.state === 'waiting' || g.state === 'toWait' || g.state === 'toNeed' || g.state === 'need';
}

/**
 * The other working stations that do the same job as this one, for the same discipline: for treatment, the same
 * techniques, so a table's line and a machine's are only the same kind where the machine does what the table does.
 */
export function sameKind(ctx: SimContext, it: Item): Item[] {
  const def = ITEMS[it.type].station;
  if (!def) return [];
  return ctx.s.items.filter((o) => {
    const od = ITEMS[o.type].station;
    if (o === it || od?.goal !== def.goal || od.discipline !== def.discipline || !ctx.world.usable(o)) return false;
    return def.goal !== 'treat' || sameWork(it, o);
  });
}

/** Whether two treatment stations of a discipline do any of the same techniques. */
function sameWork(a: Item, b: Item): boolean {
  const mine = ITEMS[a.type].machine?.performs;
  const theirs = ITEMS[b.type].machine?.performs;
  // two tables do the same; a machine and a table share what the machine performs and the table may too
  if (!mine && !theirs) return true;
  const performs = mine ?? theirs ?? [];
  const other = mine ? b : a;
  return performs.some((m) => treatsHere(other, MODALITIES[m]));
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
  // a guest goes only where their own treatment is done
  if (ITEMS[to.type].station?.goal === 'treat' && !treatsHere(to, modalityOf(g))) return false;
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
  // their visit is over and counted already: they are only shopping, or resting after a treatment
  if (g.outcome || g.goal === 'shop') {
    leave(ctx, g);
    return true;
  }
  g.outcome = 'sent';
  countVisit(ctx, g, 'sent');
  changeRep(ctx, -SEND_HOME_REP);
  say(g, '🏠', 6);
  emit(ctx, { type: 'float', text: 'Sent home', x: g.x, y: g.y, kind: 'info' });
  leave(ctx, g);
  return true;
}
