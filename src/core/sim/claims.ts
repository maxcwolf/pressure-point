// Seats and facilities: finding a free spot on an item and holding it for someone.

import { type AccessRole, ITEMS } from '../data';
import { type Char, type Item } from '../state/types';
import { accessTile } from '../world';
import { System } from './system';

export class Claims extends System {
  claim(c: Char, it: Item, idx: number) {
    this.release(c);
    it.users[idx] = c.id;
    c.claimItem = it.id;
    c.claimIdx = idx;
  }

  release(c: Char) {
    if (!c.claimItem) return;
    const it = this.world.item(c.claimItem);
    if (it?.users[c.claimIdx] === c.id) it.users[c.claimIdx] = 0;
    c.claimItem = 0;
  }

  findAccess(role: AccessRole, x: number, y: number, maxDist = 1e9): { item: Item; idx: number } | null {
    let best: { item: Item; idx: number } | null = null;
    let bestD = maxDist;
    for (const it of this.s.items) {
      const acc = ITEMS[it.type].access;
      for (const [i, spot] of acc.entries()) {
        if (spot.role !== role || it.users[i] || !this.world.usable(it)) continue;
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

  accessIndex(it: Item, role: AccessRole) {
    return ITEMS[it.type].access.findIndex((a) => a.role === role);
  }
}
