// The building as a set of tiles: the rectangles it is built from, the center's own and any land bought since, its
// front door, and the straight runs of outer wall round its edge. Nothing here knows the size of the map.

import type { Entrance, Plot, Rect, Side } from './data';

export type { Entrance, Side } from './data';

/**
 * Where the buildings stand: the tiles inside their outer walls, as rectangles, their entrances, and the paving between
 * them and the pavement. The center's own building has the front door; land bought either joins it or stands apart as a
 * building of its own, with an entrance and a path.
 */
export interface Footprint {
  /** The rectangles it is built from: the center's own building first, then any land, in the order it was bought. */
  rects: readonly Rect[];
  /** The front door's two tiles, along the row `front`. */
  door: readonly [number, number];
  /** The row inside the front wall, where the front door is. */
  front: number;
  /** Every door in the outer walls: the front door first, then those of the buildings standing apart. */
  entrances: readonly Entrance[];
  /** The paving from the doors of the buildings standing apart: outdoors, walked on. */
  paths: readonly Rect[];
  /** The smallest rectangle round every tile of it. */
  bounds: Rect;
}

/** A door's way through the wall: a tile inside, and the tile just outside it. */
export interface DoorStep {
  inside: readonly [number, number];
  outside: readonly [number, number];
}

/** Which way out from a tile each side faces, across and down the map. */
const OUT: Readonly<Record<Side, readonly [number, number]>> = {
  north: [0, -1],
  south: [0, 1],
  west: [-1, 0],
  east: [1, 0],
};

/** The two steps through an entrance, one for each of its tiles. */
export function entranceSteps(e: Entrance): DoorStep[] {
  const [dx, dy] = OUT[e.side];
  // along the wall: east for a north or south door, south for an east or west one
  const [ax, ay] = dy ? [1, 0] : [0, 1];
  return [0, 1].map((i) => {
    const x = e.x + ax * i;
    const y = e.y + ay * i;
    return { inside: [x, y], outside: [x + dx, y + dy] };
  });
}

/** Where an entrance is in its wall: the wall's line, as a run of wall has it, and from where to where along it. */
export function entranceSpan(e: Entrance): { side: Side; line: number; a: number; b: number } {
  const horizontal = e.side === 'north' || e.side === 'south';
  const across = horizontal ? e.y : e.x;
  const along = horizontal ? e.x : e.y;
  const outward = e.side === 'south' || e.side === 'east' ? 1 : 0;
  return { side: e.side, line: across + outward, a: along, b: along + 2 };
}

/** The center's front door, as an entrance in the south wall. */
export const frontEntrance = (base: Pick<Plot, 'door' | 'y1'>): Entrance => ({
  side: 'south',
  x: base.door[0],
  y: base.y1,
});

/** A straight run of the building's outer wall, along the edge between tiles inside and tiles outside. */
export interface WallRun {
  /** Which way it faces: the outside is that way. */
  side: Side;
  /** True for the north and south walls, which run along x. */
  horizontal: boolean;
  /** Where its inside face is, across the wall: a tile edge. */
  line: number;
  /** Where it starts and ends along the wall, at tile edges. */
  a: number;
  b: number;
}

/** Where two runs of outer wall meet: at the corner of a tile (outside), or round a tile of outdoors (inside). */
export interface WallCorner {
  /** The horizontal run and the upright one, and which end of each meets the corner. */
  h: WallRun;
  hEnd: 'a' | 'b';
  v: WallRun;
  vEnd: 'a' | 'b';
  /** True at an outside corner, where the walls wrap round the building; false at an inside one. */
  outside: boolean;
}

/** Whether a tile is in a rectangle. */
export const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** The smallest rectangle round some rectangles. */
function boundsOf(rects: readonly Rect[]): Rect {
  return {
    x0: Math.min(...rects.map((r) => r.x0)),
    x1: Math.max(...rects.map((r) => r.x1)),
    y0: Math.min(...rects.map((r) => r.y0)),
    y1: Math.max(...rects.map((r) => r.y1)),
  };
}

/**
 * A building from a center's own plot and the rectangles of land added to it, with the doors and paths of any that
 * stand apart.
 */
export function footprintOf(
  base: Plot,
  more: readonly Rect[] = [],
  apart: { entrances?: readonly Entrance[]; paths?: readonly Rect[] } = {},
): Footprint {
  const rects = [{ x0: base.x0, x1: base.x1, y0: base.y0, y1: base.y1 }, ...more];
  return {
    rects,
    door: base.door,
    front: base.y1,
    entrances: [frontEntrance(base), ...(apart.entrances ?? [])],
    paths: apart.paths ?? [],
    bounds: boundsOf(rects),
  };
}

/** Whether a tile is paving laid to a building standing apart. */
export const onPath = (fp: Pick<Footprint, 'paths'>, x: number, y: number) => fp.paths.some((r) => inRect(r, x, y));

/** Whether a tile is inside the building. */
export function inFootprint(fp: Footprint, x: number, y: number): boolean {
  return inRect(fp.bounds, x, y) && fp.rects.some((r) => inRect(r, x, y));
}

/** Every tile inside the building, once each, row by row. */
export function footprintTiles(fp: Footprint): [number, number][] {
  const out: [number, number][] = [];
  const { x0, x1, y0, y1 } = fp.bounds;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inFootprint(fp, x, y)) out.push([x, y]);
  return out;
}

/** How many tiles the building covers. */
export const footprintArea = (fp: Footprint) => footprintTiles(fp).length;

/** The row just outside the front door, where the path to the pavement starts. */
export const doorstep = (fp: Pick<Footprint, 'front'>) => fp.front + 1;

/** The building's rectangles, doors and paths as a key, so a layer can tell when the building has changed. */
export const footprintKey = (fp: Footprint) =>
  [
    fp.rects.map((r) => `${r.x0},${r.x1},${r.y0},${r.y1}`).join(';'),
    fp.entrances.map((e) => `${e.side}${e.x},${e.y}`).join(';'),
    fp.paths.map((r) => `${r.x0},${r.x1},${r.y0},${r.y1}`).join(';'),
  ].join('|');

/** The sides in the order their runs are listed. */
const SIDES: readonly Side[] = ['north', 'south', 'west', 'east'];

/**
 * The building's outer walls as straight runs, each as long as it can be: the north runs first, then the south, the
 * west and the east, each from north-west to south-east. A rectangle has four, one a side.
 */
export function wallRuns(fp: Footprint): WallRun[] {
  const runs: WallRun[] = [];
  const { x0, x1, y0, y1 } = fp.bounds;
  for (const side of SIDES) {
    const [dx, dy] = OUT[side];
    const horizontal = dy !== 0;
    // across the wall: the rows (or columns) of tiles; along it: the tiles in each
    const [c0, c1, t0, t1] = horizontal ? [y0, y1, x0, x1] : [x0, x1, y0, y1];
    for (let c = c0; c <= c1; c++) {
      let start: number | null = null;
      for (let t = t0; t <= t1 + 1; t++) {
        const [x, y] = horizontal ? [t, c] : [c, t];
        const edge = t <= t1 && inFootprint(fp, x, y) && !inFootprint(fp, x + dx, y + dy);
        if (edge && start === null) start = t;
        if (!edge && start !== null) {
          runs.push({ side, horizontal, line: c + (dx + dy > 0 ? 1 : 0), a: start, b: t });
          start = null;
        }
      }
    }
  }
  return runs;
}

/**
 * Where the runs of outer wall meet, each corner once. At an outside corner, the two walls wrap round a tile of the
 * building; at an inside corner they wrap round a tile of outdoors, as in the crook of an L.
 */
export function wallCorners(fp: Footprint, runs: readonly WallRun[] = wallRuns(fp)): WallCorner[] {
  /** The ends of runs at each point where tile edges cross. */
  const ends = new Map<string, { run: WallRun; end: 'a' | 'b' }[]>();
  for (const run of runs) {
    for (const end of ['a', 'b'] as const) {
      const along = run[end];
      const key = run.horizontal ? `${along},${run.line}` : `${run.line},${along}`;
      ends.set(key, [...(ends.get(key) ?? []), { run, end }]);
    }
  }
  const corners: WallCorner[] = [];
  for (const here of ends.values()) {
    const hs = here.filter((e) => e.run.horizontal);
    const vs = here.filter((e) => !e.run.horizontal);
    for (const h of hs) {
      // round the corner of one tile: its west side if the horizontal run starts here, its north if the tile is below
      const wrap = vs.find(
        (v) => v.run.side === (h.end === 'a' ? 'west' : 'east') && v.end === (h.run.side === 'north' ? 'a' : 'b'),
      );
      // where two tiles touch only at a corner, both meet here, each round its own tile; otherwise there is one of each
      const v = wrap ?? (vs.length === 1 ? vs[0] : undefined);
      if (v) corners.push({ h: h.run, hEnd: h.end, v: v.run, vEnd: v.end, outside: wrap !== undefined });
    }
  }
  return corners;
}
