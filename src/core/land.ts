// Land: the plots each center sells next to its building, what each costs now and whether it is for sale yet; and the
// strips along a side that were sold before centers had plots of their own, as saves from then keep them.

import { type CenterId, centerOf, CENTERS, type Land, LOT_W, type Plot, type PlotDef, type Rect } from './data';
import { type Footprint, footprintOf, inFootprint } from './footprint';
import { starsEarned } from './state/game';
import type { GameState } from './state/types';

/** How wide a center's lot is. */
export const lotWidth = (center: { width?: number }) => center.width ?? LOT_W;

/** The land bought and built on, in the order it was bought: not the plots the builders are still at. */
const builtOn = (s: Pick<GameState, 'land'>): Land[] => s.land.filter((l) => l.ready === undefined);

/** The rectangles of the land bought and built on, in the order it was bought. */
export const landTiles = (s: Pick<GameState, 'land'>): Rect[] => builtOn(s).flatMap((l) => l.rects);

/**
 * The center's buildings as they stand: its own, grown into the land built on next to it, and any standing apart, with
 * their doors and the paving out to them.
 */
export function buildingsOf(s: Pick<GameState, 'land' | 'center'>): Footprint {
  const land = builtOn(s);
  return footprintOf(centerOf(s).plot, landTiles(s), {
    entrances: land.flatMap((l) => (l.entrance ? [l.entrance] : [])),
    paths: land.flatMap((l) => l.path ?? []),
  });
}

/** Whether a plot is the game's already, being built on, up for sale, or not for sale yet. */
export type PlotState = 'owned' | 'building' | 'open' | 'locked';

/** A center's plot as things stand: whether it can be bought, and for how much, or how far along the work on it is. */
export interface PlotOffer {
  def: PlotDef;
  state: PlotState;
  /** Its name: the one it came with, or the one the player gave it once it was theirs. */
  name: string;
  /** What it costs now: its price, less a share for any of its tiles the building has already grown into. */
  price: number;
  /** Why it is not for sale yet, while it is locked. */
  why: string;
  /** How far along the work on it is, from 0 to 1: 1 once it is built on. */
  progress: number;
  /** Whole game days until the work on it is done, while it is being built on. */
  daysLeft: number;
}

/** How many game days the builders take over a plot: three, and longer for a big one. */
export const buildDays = (def: Pick<PlotDef, 'rects'>) => Math.max(3, Math.round(plotTiles(def).length / 20));

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
 * Each of the center's plots: bought, or covered already by land bought as strips, it is the game's, once the builders
 * are done; otherwise it is for sale from its star, once any plot it comes after is built on, for its share of tiles
 * still outside.
 */
export function plotOffers(s: GameState, building: Footprint): PlotOffer[] {
  const plots = centerOf(s).plots;
  const states = new Map<string, PlotState>();
  return plots.map((def): PlotOffer => {
    const land = s.land.find((l) => l.plot === def.id);
    const name = land?.name ?? def.name;
    const tiles = plotTiles(def);
    const fresh = tiles.filter(([x, y]) => !inFootprint(building, x, y)).length;
    if (land?.ready !== undefined) {
      states.set(def.id, 'building');
      const daysLeft = Math.max(0, land.ready - s.day);
      const progress = Math.min(1, Math.max(0, 1 - daysLeft / buildDays(def)));
      return { def, state: 'building', name, price: 0, why: '', progress, daysLeft: Math.ceil(daysLeft) };
    }
    if (land || fresh === 0) {
      states.set(def.id, 'owned');
      return { def, state: 'owned', name, price: 0, why: '', progress: 1, daysLeft: 0 };
    }
    const price = roundPrice((def.price * fresh) / tiles.length);
    const after = def.after ? plots.find((p) => p.id === def.after) : undefined;
    const afterName = after && nameInSentence(s.land.find((l) => l.plot === after.id)?.name ?? after.name);
    const why =
      starsEarned(s) < def.star
        ? `Comes up for sale at star ${def.star}`
        : after && states.get(after.id) === 'building'
          ? `Comes up for sale once work on ${afterName} is done`
          : after && states.get(after.id) !== 'owned'
            ? `Comes up for sale once ${afterName} is yours`
            : '';
    const state = why ? 'locked' : 'open';
    states.set(def.id, state);
    return { def, state, name, price, why, progress: 0, daysLeft: 0 };
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
