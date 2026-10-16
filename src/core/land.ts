// Land: the plots each center sells next to its building, what each costs now and whether it is for sale yet; and the
// strips along a side that were sold before centers had plots of their own, as saves from then keep them.

import { type CenterId, centerOf, CENTERS, type Land, LOT_W, type Plot, type PlotDef, type Rect } from './data';
import { type Footprint, inFootprint } from './footprint';
import { unlockedUpTo } from './state/game';
import type { GameState } from './state/types';

/** How wide a center's lot is. */
export const lotWidth = (center: { width?: number }) => center.width ?? LOT_W;

/** The rectangles of all the land bought, in the order it was bought. */
export const landTiles = (s: Pick<GameState, 'land'>): Rect[] => s.land.flatMap((l) => l.rects);

/** Whether a plot is the game's already, up for sale, or not for sale yet. */
export type PlotState = 'owned' | 'open' | 'locked';

/** A center's plot as things stand: whether it can be bought, and for how much. */
export interface PlotOffer {
  def: PlotDef;
  state: PlotState;
  /** What it costs now: its price, less a share for any of its tiles the building has already grown into. */
  price: number;
  /** Why it is not for sale yet, while it is locked. */
  why: string;
}

/** Every tile of a plot, once each. */
export function plotTiles(def: Pick<PlotDef, 'rects'>): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const r of def.rects)
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) {
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push([x, y]);
      }
  return out;
}

/** A plot's name as it reads inside a sentence: "the east wing", not "The east wing". */
export const nameInSentence = (name: string) => name.replace(/^The /, 'the ');

/** A price rounded to the nearest $50. */
const roundPrice = (n: number) => Math.round(n / 50) * 50;

/**
 * Each of the center's plots: bought, or covered already by land bought as strips, it is the game's; otherwise it is
 * for sale from its star, once any plot it comes after is the game's, for its share of tiles still outside.
 */
export function plotOffers(s: GameState, building: Footprint): PlotOffer[] {
  const plots = centerOf(s).plots;
  const owned = new Set<string>();
  return plots.map((def) => {
    const tiles = plotTiles(def);
    const fresh = tiles.filter(([x, y]) => !inFootprint(building, x, y)).length;
    if (fresh === 0 || s.land.some((l) => l.plot === def.id)) {
      owned.add(def.id);
      return { def, state: 'owned', price: 0, why: '' };
    }
    const price = roundPrice((def.price * fresh) / tiles.length);
    const after = def.after ? plots.find((p) => p.id === def.after) : undefined;
    const why =
      unlockedUpTo(s) < def.star
        ? `Comes up for sale at star ${def.star}`
        : after && !owned.has(after.id)
          ? `Comes up for sale once ${nameInSentence(after.name)} is yours`
          : '';
    return { def, state: why ? 'locked' : 'open', price, why };
  });
}

/** The plot that covers a tile, if any. */
export function plotAt(plots: readonly PlotDef[], x: number, y: number): PlotDef | undefined {
  return plots.find((p) => p.rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1));
}

// ---- Strips, as land was sold up to version 0.26 -----------------------------------------------------------------

/** The sides a strip could be bought on: never the front, which faces the street. */
export type LandSide = 'west' | 'east' | 'back';

/** How far a building could grow: its west wall's lowest x, its east wall's highest, and its back wall's lowest y. */
export type LandLimits = Readonly<Record<LandSide, number>>;

/** How deep a strip was, at most; the last on a side took what was left, if that was not much more. */
export const LAND_STEP = 4;

/** How far a building could grow on every lot up to save version 24, when every lot was 32 tiles wide. */
const LIMITS_BEFORE_25: LandLimits = { west: 1, east: 30, back: 1 };

/** Where a lot was tighter than that: the beach huts stood along the back of The Boardwalk's. */
const TIGHTER: Partial<Record<CenterId, Partial<LandLimits>>> = { boardwalk: { back: 3 } };

/** How many tiles of lawn there were between a side of the building and the edge of the lot. */
function roomToGrow(plot: Rect, side: LandSide, limits: LandLimits): number {
  if (side === 'west') return plot.x0 - limits.west;
  if (side === 'east') return limits.east - plot.x1;
  return plot.y0 - limits.back;
}

/**
 * The next strip on a side, or null if there was no room for one at least two tiles deep. A strip was LAND_STEP deep,
 * except that the last on a side took the rest when only a tile more was left, rather than leave a sliver.
 */
export function nextStrip(plot: Rect, side: LandSide, limits: LandLimits): Rect | null {
  const room = roomToGrow(plot, side, limits);
  if (room < 2) return null;
  const depth = room <= LAND_STEP + 1 ? room : LAND_STEP;
  if (side === 'west') return { x0: plot.x0 - depth, x1: plot.x0 - 1, y0: plot.y0, y1: plot.y1 };
  if (side === 'east') return { x0: plot.x1 + 1, x1: plot.x1 + depth, y0: plot.y0, y1: plot.y1 };
  return { x0: plot.x0, x1: plot.x1, y0: plot.y0 - depth, y1: plot.y0 - 1 };
}

/** The strips bought, as rectangles, in the order they were bought: the building grew into each, a side at a time. */
export function stripRects(base: Plot, bought: readonly LandSide[], limits: LandLimits): Rect[] {
  const rects: Rect[] = [];
  let grown: Rect = base;
  for (const side of bought) {
    const strip = nextStrip(grown, side, limits);
    if (!strip) continue;
    rects.push(strip);
    grown = {
      x0: Math.min(grown.x0, strip.x0),
      x1: Math.max(grown.x1, strip.x1),
      y0: Math.min(grown.y0, strip.y0),
      y1: grown.y1,
    };
  }
  return rects;
}

/**
 * The land in a save from before version 25, which kept only the sides bought, as the strips they were then: worked out
 * on the lot as it was, so the building keeps its exact shape however the lot has grown since.
 */
export function stripsBought(center: CenterId, sides: readonly LandSide[]): Land[] {
  const limits = { ...LIMITS_BEFORE_25, ...TIGHTER[center] };
  return stripRects(CENTERS[center].plot, sides, limits).map((r) => ({ plot: 'strip', rects: [r] }));
}
