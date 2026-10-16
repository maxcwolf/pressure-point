// What the things hung on walls do, beyond their decor: posters lift the staff, and a clock hurries everyone along.

import { CLOCK_BREAK_BOOST, CLOCK_DRAIN, CLOCK_SIGHT, POSTER_MAX, POSTER_MORALE } from '../data';
import type { Guest, Item, Staff } from '../state/types';
import type { SimContext } from './context';

/** The clocks on the walls, kept until an item is added or taken away. Moving one moves the item, so it stays right. */
let clocks: { items: readonly Item[]; length: number; list: Item[] } | null = null;

/** Every Wall Clock in the building. */
function clocksOf(ctx: SimContext): Item[] {
  const { items } = ctx.s;
  if (clocks?.items !== items || clocks.length !== items.length)
    clocks = { items, length: items.length, list: items.filter((it) => it.type === 'wall_clock') };
  return clocks.list;
}

/** How much the Motivational Posters in the Staff Rooms lift everyone's morale. */
export function posterMorale(ctx: SimContext): number {
  const posters = ctx.s.items.filter((it) => it.type === 'motivational_poster' && ctx.world.usable(it)).length;
  return Math.min(POSTER_MAX, posters) * POSTER_MORALE;
}

/** How much sooner someone on a break is done with it: sooner with a Wall Clock in the room to keep an eye on. */
export function clockBreak(ctx: SimContext, st: Staff): number {
  const seat = ctx.world.item(st.claimItem);
  if (!seat) return 1;
  const zone = ctx.world.zoneAt(seat.x, seat.y);
  if (zone <= 0) return 1;
  return clocksOf(ctx).some((c) => ctx.world.zoneAt(c.x, c.y) === zone && ctx.world.usable(c)) ? CLOCK_BREAK_BOOST : 1;
}

/** How much faster a waiting guest loses patience: faster with a Wall Clock in sight, counting the minutes. */
export function clockDrain(ctx: SimContext, g: Guest): number {
  const list = clocksOf(ctx);
  if (!list.length) return 1;
  const zone = ctx.world.zoneAt(g.tx, g.ty);
  const seen = list.some(
    (c) => ctx.world.zoneAt(c.x, c.y) === zone && Math.hypot(c.x + 0.5 - g.x, c.y + 0.5 - g.y) <= CLOCK_SIGHT,
  );
  return seen ? CLOCK_DRAIN : 1;
}
