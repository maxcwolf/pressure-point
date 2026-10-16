// What the things hung on walls do, beyond their decor and noise: posters lift the staff, a clock hurries everyone
// along, a television calms the wait, and the charts help the treatments in their rooms.

import {
  CHART_BONUS,
  CLOCK_BREAK_BOOST,
  CLOCK_DRAIN,
  CLOCK_SIGHT,
  type ItemType,
  POSTER_MAX,
  POSTER_MORALE,
  TV_CALM,
  TV_RANGE,
} from '../data';
import type { Guest, Item, Staff } from '../state/types';
import type { SimContext } from './context';

/** What waiting guests can see that changes how fast they lose patience. */
const WATCHED: readonly ItemType[] = ['wall_clock', 'television'];

/**
 * The clocks and televisions on the walls, kept until an item is added or taken away. Moving one moves the item, so it
 * stays right.
 */
let watched: { items: readonly Item[]; length: number; list: Item[] } | null = null;

/** Every Wall Clock and Television in the building. */
function watchedOf(ctx: SimContext): Item[] {
  const { items } = ctx.s;
  if (watched?.items !== items || watched.length !== items.length)
    watched = { items, length: items.length, list: items.filter((it) => WATCHED.includes(it.type)) };
  return watched.list;
}

/** Whether a guest can see a working item of a type, in the same room or corridor and close enough. */
function inSight(ctx: SimContext, g: Guest, type: ItemType, range: number): boolean {
  const zone = ctx.world.zoneAt(g.tx, g.ty);
  return watchedOf(ctx).some(
    (it) =>
      it.type === type &&
      ctx.world.zoneAt(it.x, it.y) === zone &&
      Math.hypot(it.x + 0.5 - g.x, it.y + 0.5 - g.y) <= range &&
      ctx.world.usable(it),
  );
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
  return watchedOf(ctx).some(
    (c) => c.type === 'wall_clock' && ctx.world.zoneAt(c.x, c.y) === zone && ctx.world.usable(c),
  )
    ? CLOCK_BREAK_BOOST
    : 1;
}

/**
 * How fast a waiting guest loses patience, against usual: faster with a Wall Clock in sight, counting the minutes, and
 * slower with a Television to watch.
 */
export function wallDrain(ctx: SimContext, g: Guest): number {
  if (!watchedOf(ctx).length) return 1;
  return (
    (inSight(ctx, g, 'wall_clock', CLOCK_SIGHT) ? CLOCK_DRAIN : 1) *
    (inSight(ctx, g, 'television', TV_RANGE) ? TV_CALM : 1)
  );
}

/** The charts that help treatments in their rooms. */
const CHARTS: readonly ItemType[] = ['chakra_chart', 'meridian_poster'];

/** How much more often a treatment at this table works for a chart on its room's wall. Only one counts. */
export function chartBonus(ctx: SimContext, table: Item): number {
  const zone = ctx.world.zoneAt(table.x, table.y);
  if (zone <= 0) return 0;
  const chart = ctx.s.items.some(
    (it) => CHARTS.includes(it.type) && ctx.world.zoneAt(it.x, it.y) === zone && ctx.world.usable(it),
  );
  return chart ? CHART_BONUS : 0;
}
