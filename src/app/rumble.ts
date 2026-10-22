// How loud the engine carrying the center through a mishap sounds, from where the camera is looking.

import { mishapCarrier } from '../core/sim/mishaps';
import type { GameState } from '../core/state/types';
import { clamp } from '../core/util';
import { itemCenter } from '../core/world';

/** How far from it, in tiles, a generator carrying the center can be heard at all. */
export const RUMBLE_REACH = 12;

/** How loud the generator carrying the center sounds, from 0 to 1: louder the nearer the camera looks, none past reach. */
export function rumbleLevel(s: GameState, x: number, y: number): number {
  const it = mishapCarrier(s);
  if (!it) return 0;
  const [cx, cy] = itemCenter(it);
  return clamp(1 - Math.hypot(cx - x, cy - y) / RUMBLE_REACH, 0, 1);
}
