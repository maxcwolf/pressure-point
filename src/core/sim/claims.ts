// Seats and facilities: finding a free spot on an item and holding it for someone.

import { type AccessRole, ITEMS } from '../data';
import type { Char, Item } from '../state/types';
import { accessTile } from '../world';
import type { SimContext } from './context';

/** Hold a spot on an item for someone, giving up any spot they held before. */
export function claim(ctx: SimContext, c: Char, it: Item, idx: number) {
  release(ctx, c);
  it.users[idx] = c.id;
  c.claimItem = it.id;
  c.claimIdx = idx;
}

/** Give up the spot someone is holding. */
export function release(ctx: SimContext, c: Char) {
  if (!c.claimItem) return;
  const it = ctx.world.item(c.claimItem);
  if (it?.users[c.claimIdx] === c.id) it.users[c.claimIdx] = 0;
  c.claimItem = 0;
}

/** The nearest free spot of a given kind on a usable item, if one is close enough. */
export function findAccess(
  ctx: SimContext,
  role: AccessRole,
  x: number,
  y: number,
  maxDist = 1e9,
): { item: Item; idx: number } | null {
  let best: { item: Item; idx: number } | null = null;
  let bestD = maxDist;
  for (const it of ctx.s.items) {
    const acc = ITEMS[it.type].access;
    for (const [i, spot] of acc.entries()) {
      if (spot.role !== role || it.users[i] || !ctx.world.usable(it)) continue;
      const [ax, ay] = accessTile(it, i);
      const d = Math.hypot(ax - x, ay - y);
      if (d < bestD) {
        bestD = d;
        best = { item: it, idx: i };
      }
    }
  }
  return best;
}

/** Which of an item's spots is meant for this kind of user. */
export function accessIndex(it: Item, role: AccessRole) {
  return ITEMS[it.type].access.findIndex((a) => a.role === role);
}
