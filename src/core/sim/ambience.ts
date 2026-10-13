// How pleasant the place is: decor, litter and the prestige of each room.

import { DECOR_RADIUS, H, ITEMS, ROOMS, W, WINDOW_MAX_BONUS } from '../data';
import type { Item, Room } from '../state/types';
import { at, clamp } from '../util';
import { inBounds, itemCenter, tileIdx } from '../world';
import { System } from './system';

export class Ambience extends System {
  /** How pleasant each tile is, from nearby decor and litter. */
  attract = new Float32Array(W * H);

  /** Work out afresh how pleasant each tile is. */
  update() {
    const grid = this.attract;
    grid.fill(0);
    const R = DECOR_RADIUS;
    /** Add pleasantness around a tile, fading with distance. */
    const spread = (cx: number, cy: number, amount: number) => {
      for (let y = cy - R; y <= cy + R; y++) {
        for (let x = cx - R; x <= cx + R; x++) {
          if (!inBounds(x, y)) continue;
          const d = Math.hypot(x - cx, y - cy);
          const i = tileIdx(x, y);
          if (d <= R) grid[i] = at(grid, i) + amount * (1 - d / (R + 1));
        }
      }
    };
    for (const it of this.s.items) {
      const decor = this.decorOf(it);
      if (!decor) continue;
      const [cx, cy] = itemCenter(it);
      spread(Math.floor(cx), Math.floor(cy), decor);
    }
    for (const l of this.s.litter) spread(l.x, l.y, -2.5);
  }

  /** A wilted plant drags its surroundings down instead of lifting them. */
  private decorOf(it: Item): number {
    if (it.type === 'plant' && it.water <= 15) return -1;
    return ITEMS[it.type].decor ?? 0;
  }

  /** Patience drains slower in pleasant surroundings and faster in grim ones. */
  drainFactor(x: number, y: number): number {
    return clamp(1.12 - (inBounds(x, y) ? at(this.attract, tileIdx(x, y)) : 0) * 0.035, 0.7, 1.4);
  }

  /** One to five, from how roomy and how nicely furnished a room is. */
  prestige(room: Room): number {
    const def = ROOMS[room.type];
    let score = (room.w * room.h - def.minShort * def.minLong) * 0.4;
    for (const it of this.s.items) if (this.world.zoneAt(it.x, it.y) === room.id) score += this.decorOf(it);
    for (const l of this.s.litter) if (this.world.zoneAt(l.x, l.y) === room.id) score -= 2;
    // daylight helps, up to a point
    score += Math.min(room.windows.length, WINDOW_MAX_BONUS) * 1.5;
    return clamp(1 + Math.floor(score / 3), 1, 5);
  }
}
