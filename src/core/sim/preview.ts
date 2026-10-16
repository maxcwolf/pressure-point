// What an item would change if it were put down where it is in hand: how pleasant, noisy and warm the spots around it
// would be, the prestige of the room it would stand in, and the calm at the treatment tables nearby.

import { HEAT_DAMPING, ITEMS, NOISE_RADIUS, WALL_DAMPING } from '../data';
import { itemCenter, type Placed } from '../world';
import { prestige, spreadDecor } from './ambience';
import type { SimContext } from './context';
import { calmness, noiseAt, noiseLeak } from './noise';
import { spreader } from './spread';
import { heatLeak, spreadHeat, thermostatShare, todayIndoors } from './warmth';

/** A change in calm, below which a table is not counted as noisier or calmer. */
const CALM_CHANGE = 0.02;

/** What one more item would add, tile by tile, and what it would do to the things around it. */
export interface PlacePreview {
  /** Where it would go. */
  placed: Placed;
  /** The tile in the middle of it, where "here" is. */
  x: number;
  y: number;
  /** What it would add to each tile's pleasantness, noise and warmth, or null for what it leaves alone. */
  decor: Float32Array | null;
  noise: Float32Array | null;
  heat: Float32Array | null;
  /** The room it would stand in, with the room's prestige now and with the item in it. */
  room: { id: number; before: number; after: number } | null;
  /** A heater or air conditioner that today's weather would leave switched off. */
  resting: boolean;
  /** How many treatment tables it would make noisier, and how many calmer. */
  noisier: number;
  calmer: number;
}

/**
 * What putting down one item would change. The grids of pleasantness, noise and warmth are taken as they stand, so
 * they want working out afresh first. Warmth from an item counts only with the weather on, as it does in play, and
 * only as much as its thermostat lets it give today.
 */
export function previewItem(ctx: SimContext, placed: Placed): PlacePreview {
  const def = ITEMS[placed.type];
  const { world } = ctx;
  const [mx, my] = itemCenter(placed);
  const x = Math.floor(mx);
  const y = Math.floor(my);
  const tiles = world.w * world.h;

  let decor: Float32Array | null = null;
  if (def.decor) {
    decor = new Float32Array(tiles);
    spreadDecor(world, decor, placed.type, x, y, def.decor);
  }
  let noise: Float32Array | null = null;
  if (def.noise) {
    noise = new Float32Array(tiles);
    spreader(ctx, noiseLeak, WALL_DAMPING)(noise, x, y, def.noise, NOISE_RADIUS);
  }
  let heat: Float32Array | null = null;
  // a new heater or air conditioner starts on Auto, giving only what today's weather calls for, which may be nothing
  const warmth = def.heat && ctx.s.weatherOn ? def.heat * thermostatShare(placed.type, 'auto', todayIndoors(ctx)) : 0;
  if (warmth) {
    heat = new Float32Array(tiles);
    spreadHeat(heat, spreader(ctx, heatLeak, HEAT_DAMPING), placed.type, x, y, warmth);
  }
  const resting = !!def.heat && ctx.s.weatherOn && !warmth;

  // prestige counts what stands in a room by its corner, as it does once it is down
  const home = world.room(world.zoneAt(placed.x, placed.y));
  const room =
    home && def.decor ? { id: home.id, before: prestige(ctx, home), after: prestige(ctx, home, def.decor) } : null;

  let noisier = 0;
  let calmer = 0;
  if (noise) {
    for (const it of ctx.s.items) {
      if (ITEMS[it.type].station?.goal !== 'treat') continue;
      const [cx, cy] = itemCenter(it);
      const tx = Math.floor(cx);
      const ty = Math.floor(cy);
      const now = calmness(noiseAt(ctx, tx, ty));
      const then = calmness(noiseAt(ctx, tx, ty, noise[world.idx(tx, ty)] ?? 0));
      if (then < now - CALM_CHANGE) noisier++;
      else if (then > now + CALM_CHANGE) calmer++;
    }
  }
  return { placed, x, y, decor, noise, heat, room, resting, noisier, calmer };
}
