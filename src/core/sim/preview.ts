// What an item would change if it were put down where it is in hand, new or moved: how pleasant, noisy and warm the
// spots around it would be, the prestige of the room it would stand in, and the calm at the treatment tables nearby.

import { HEAT_DAMPING, ITEMS, NOISE_RADIUS, WALL_DAMPING } from '../data';
import type { Item } from '../state/types';
import { itemCenter, type Placed } from '../world';
import { decorOf, prestige, spreadDecor } from './ambience';
import type { SimContext } from './context';
import { calmness, noiseAt, noiseLeak } from './noise';
import { spreader } from './spread';
import { heatLeak, itemHeat, spreadHeat, thermostatShare, todayIndoors } from './warmth';

/** A change in calm, below which a table is not counted as noisier or calmer. */
const CALM_CHANGE = 0.02;

/** What an item in hand would change, tile by tile, and what it would do to the things around it. */
export interface PlacePreview {
  /** Where it would go. */
  placed: Placed;
  /** The tile in the middle of it, where "here" is. */
  x: number;
  y: number;
  /**
   * What it would add to each tile's pleasantness, noise and warmth, or null for what it leaves alone. For one being
   * moved, what it would add where it goes less what it gives where it stands now.
   */
  decor: Float32Array | null;
  noise: Float32Array | null;
  heat: Float32Array | null;
  /** The room whose prestige it would change, with the prestige now and with it moved in or out. */
  room: { id: number; before: number; after: number } | null;
  /** A heater or air conditioner that today's weather would leave switched off. */
  resting: boolean;
  /** How many treatment tables it would make noisier, and how many calmer. */
  noisier: number;
  calmer: number;
}

/** What an item gives off where it stands: decor, noise and warmth (below zero, cool). */
interface Gives {
  decor: number;
  noise: number;
  heat: number;
}

/** What an item gives off spread over the tiles around it, a grid for each, or null for what it gives none of. */
type Spread = Pick<PlacePreview, 'decor' | 'noise' | 'heat'>;

/** Spread what an item gives off from the middle of where it stands, into grids of its own. */
function spreadFrom(ctx: SimContext, at: Placed, gives: Gives): Spread {
  const { world } = ctx;
  const [mx, my] = itemCenter(at);
  const x = Math.floor(mx);
  const y = Math.floor(my);
  const tiles = world.w * world.h;
  let decor: Float32Array | null = null;
  if (gives.decor) {
    decor = new Float32Array(tiles);
    spreadDecor(world, decor, at.type, x, y, gives.decor);
  }
  let noise: Float32Array | null = null;
  if (gives.noise) {
    noise = new Float32Array(tiles);
    spreader(ctx, noiseLeak, WALL_DAMPING)(noise, x, y, gives.noise, NOISE_RADIUS);
  }
  let heat: Float32Array | null = null;
  if (gives.heat) {
    heat = new Float32Array(tiles);
    spreadHeat(heat, spreader(ctx, heatLeak, HEAT_DAMPING), at.type, x, y, gives.heat);
  }
  return { decor, noise, heat };
}

/** One grid less another, either of which may be none. */
function less(a: Float32Array | null, b: Float32Array | null): Float32Array | null {
  if (!b) return a;
  const out = a ?? new Float32Array(b.length);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) - (b[i] ?? 0);
  return out;
}

/** How many treatment tables some more noise would make noisier, and how many calmer. */
function tablesHeard(ctx: SimContext, noise: Float32Array | null): { noisier: number; calmer: number } {
  let noisier = 0;
  let calmer = 0;
  if (!noise) return { noisier, calmer };
  for (const it of ctx.s.items) {
    if (ITEMS[it.type].station?.goal !== 'treat') continue;
    const [cx, cy] = itemCenter(it);
    const tx = Math.floor(cx);
    const ty = Math.floor(cy);
    const now = calmness(noiseAt(ctx, tx, ty));
    const then = calmness(noiseAt(ctx, tx, ty, noise[ctx.world.idx(tx, ty)] ?? 0));
    if (then < now - CALM_CHANGE) noisier++;
    else if (then > now + CALM_CHANGE) calmer++;
  }
  return { noisier, calmer };
}

/** The tile in the middle of where something would go. */
function middle(placed: Placed): { x: number; y: number } {
  const [mx, my] = itemCenter(placed);
  return { x: Math.floor(mx), y: Math.floor(my) };
}

/**
 * What putting down one item would change. The grids of pleasantness, noise and warmth are taken as they stand, so
 * they want working out afresh first. Warmth from an item counts only with the weather on, as it does in play, and
 * only as much as its thermostat lets it give today.
 */
export function previewItem(ctx: SimContext, placed: Placed): PlacePreview {
  const def = ITEMS[placed.type];
  const { world } = ctx;
  // a new heater or air conditioner starts on Auto, giving only what today's weather calls for, which may be nothing
  const share = thermostatShare(placed.type, 'auto', todayIndoors(ctx));
  const warmth = def.heat && ctx.s.weatherOn ? def.heat * share : 0;
  const spread = spreadFrom(ctx, placed, { decor: def.decor ?? 0, noise: def.noise ?? 0, heat: warmth });
  const resting = !!def.heat && ctx.s.weatherOn && !warmth;

  // prestige counts what stands in a room by its corner, as it does once it is down
  const home = world.room(world.zoneAt(placed.x, placed.y));
  const room =
    home && def.decor ? { id: home.id, before: prestige(ctx, home), after: prestige(ctx, home, def.decor) } : null;

  return { placed, ...middle(placed), ...spread, room, resting, ...tablesHeard(ctx, spread.noise) };
}

/**
 * What moving an item would change: what it gives off now, taken from where it stands and given where it would go.
 * It gives what it does in play (its decor wilted or grimy, its warmth by its own thermostat, nothing in a power cut),
 * and its prestige leaves one room for another, or for the corridor.
 */
export function previewMove(ctx: SimContext, it: Item, placed: Placed): PlacePreview {
  const def = ITEMS[it.type];
  const { world } = ctx;
  const share = thermostatShare(it.type, it.thermostat, todayIndoors(ctx));
  const warmth = ctx.s.weatherOn && !world.stoppedByMishap(it) ? itemHeat(it) * share : 0;
  const gives = { decor: decorOf(it), noise: def.noise ?? 0, heat: warmth };
  const there = spreadFrom(ctx, placed, gives);
  const here = spreadFrom(ctx, it, gives);
  const spread = {
    decor: less(there.decor, here.decor),
    noise: less(there.noise, here.noise),
    heat: less(there.heat, here.heat),
  };
  // resting for the weather on Auto; one switched off by hand is not waiting for it to turn
  const resting = !!def.heat && ctx.s.weatherOn && (it.thermostat ?? 'auto') === 'auto' && !share;

  const from = world.room(world.zoneAt(it.x, it.y));
  const to = world.room(world.zoneAt(placed.x, placed.y));
  const room =
    !gives.decor || from === to
      ? null
      : to
        ? { id: to.id, before: prestige(ctx, to), after: prestige(ctx, to, gives.decor) }
        : from
          ? { id: from.id, before: prestige(ctx, from), after: prestige(ctx, from, -gives.decor) }
          : null;

  return { placed, ...middle(placed), ...spread, room, resting, ...tablesHeard(ctx, spread.noise) };
}
