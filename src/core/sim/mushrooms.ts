// Magic mushrooms, sold on the quiet under the Shop Counter while there is a Shaman to supply them. They make the odd
// sale a much bigger one, until the health inspector finds them. The inspector writes ahead, so they can be put away in
// time: by hand, or as soon as the notice comes if the policy says so, coming back out once the inspector has gone.

import { MUSHROOM_CHANCE, MUSHROOM_SALE } from '../data';
import { random, rnd } from '../random';
import { offeringOn } from '../state/game';
import type { Guest, RoomVerdict } from '../state/types';
import type { SimContext } from './context';
import { earn } from './economy';
import { toast } from './events';

/** What the inspector writes up on finding mushrooms under the counter. */
export const MUSHROOMS_FOUND = 'magic mushrooms under the counter';

/** Whether there is a Shaman on the payroll to supply the mushrooms. */
export const hasSupplier = (ctx: SimContext) =>
  offeringOn(ctx.s, 'shaman') && ctx.s.staff.some((st) => st.role === 'shaman' && st.state !== 'leaving');

/** Whether there is a Shop Counter to sell them from. */
const hasCounter = (ctx: SimContext) => ctx.s.items.some((it) => it.type === 'shop_counter');

/** Whether mushrooms are on sale under the counter right now: switched on, with a Shaman to supply them and a counter. */
export const mushroomsOnSale = (ctx: SimContext) => ctx.s.mushrooms && hasSupplier(ctx) && hasCounter(ctx);

/** Put the mushrooms on sale, or away. False if there is nobody to supply them. */
export function setMushrooms(ctx: SimContext, on: boolean): boolean {
  if (on && !hasSupplier(ctx)) return false;
  ctx.s.mushrooms = on;
  // put away or out again by hand: nothing is waiting to come back out after an inspection
  ctx.s.mushroomsStashed = false;
  return true;
}

/** What a bag of mushrooms sells for: about the usual price, give or take a fifth, to the nearest five. */
export const mushroomPrice = (roll: number) => Math.round((MUSHROOM_SALE * roll) / 5) * 5;

/** Now and then, a guest at the Shop Counter buys mushrooms too, while they are on sale. What it came to, or 0. */
export function sellMushrooms(ctx: SimContext, g: Guest): number {
  if (!mushroomsOnSale(ctx) || random() >= MUSHROOM_CHANCE) return 0;
  const amount = mushroomPrice(rnd(0.8, 1.2));
  earn(ctx, amount, 'mushrooms', g.x, g.y);
  g.spent += amount;
  return amount;
}

/** The inspector has written ahead: put the mushrooms away if the policy says so, or warn that they are still out. */
export function inspectorComing(ctx: SimContext) {
  const s = ctx.s;
  if (!mushroomsOnSale(ctx)) return;
  if (s.policy.stashMushrooms) {
    s.mushrooms = false;
    s.mushroomsStashed = true;
    toast(ctx, '🍄 The mushrooms are put away under the counter until the inspector has been.', 'info');
  } else
    toast(
      ctx,
      '🍄 The mushrooms are still on sale under the Shop Counter. Put them away before the inspector sees them.',
      'bad',
      { kind: 'item', id: s.items.find((it) => it.type === 'shop_counter')?.id ?? 0 },
    );
}

/** The inspection is over: mushrooms put away for it come back out, if there is still a Shaman to supply them. */
export function inspectorGone(ctx: SimContext) {
  const s = ctx.s;
  if (!s.mushroomsStashed) return;
  s.mushroomsStashed = false;
  if (!hasSupplier(ctx)) return;
  s.mushrooms = true;
  toast(ctx, '🍄 The inspector has gone, and the mushrooms are back under the counter.', 'info');
}

/** What the inspector makes of the Shop Counter on the way out: mushrooms found, or nothing worth a line. */
export function counterVerdict(ctx: SimContext): RoomVerdict | null {
  if (!mushroomsOnSale(ctx)) return null;
  return {
    room: 0,
    name: 'Shop Counter',
    score: 0,
    note: 'Magic mushrooms under the counter!',
    problems: [MUSHROOMS_FOUND],
  };
}
