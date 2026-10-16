// The building's outer walls, worked out from the edges of its tiles: each straight run of wall, tall across from the
// camera and low facing it, joined at the corners, with a gap for each entrance; and the windows in the tall ones,
// which make way for any room built against them. Nothing here draws anything, so it can be tested without a renderer.

import { entranceSpan, type Footprint, wallCorners, type WallRun, wallRuns } from '../core/footprint';
import type { Room } from '../core/state/types';
import { OUTER_T } from './shared';
import { nearSides, type Side, type Sides } from './turn';

/** One of the building's windows: which outer wall it is in, and where it starts and ends along it. */
export interface OuterPane {
  side: Side;
  /** True for the north and south walls, which run along x. */
  horizontal: boolean;
  /** Where the wall's inside face is, across it. */
  line: number;
  a: number;
  b: number;
}

/** A stretch of the building's outer wall to build, from a to b along it. */
export interface ShellStretch {
  side: Side;
  horizontal: boolean;
  /** Tall across the building from the camera, low facing it. */
  tall: boolean;
  /** Where the middle of the wall is, across it: just outside the building's tiles. */
  at: number;
  a: number;
  b: number;
}

/** How wide each of the building's windows is, and how far apart they start. */
const PANE_W = 1.5;
const PANE_EVERY = 3;

/** The entrances in a run of wall, as spans along it, from its start to its end. */
const doorsIn = (fp: Footprint, run: WallRun) =>
  fp.entrances
    .map(entranceSpan)
    .filter((d) => d.side === run.side && d.line === run.line && d.a >= run.a && d.b <= run.b)
    .sort((d, e) => d.a - e.a);

/** Whether a stretch of a run of wall takes in an entrance. */
const atEntrance = (fp: Footprint, run: WallRun, a: number, b: number) =>
  doorsIn(fp, run).some((d) => a < d.b && b > d.a);

/** Whether a room stands against a run of outer wall somewhere between a and b along it. */
function against(room: Room, run: WallRun, a: number, b: number): boolean {
  const { side, line } = run;
  const touches =
    side === 'north'
      ? room.y === line
      : side === 'south'
        ? room.y + room.h === line
        : side === 'west'
          ? room.x === line
          : room.x + room.w === line;
  if (!touches) return false;
  return run.horizontal ? room.x < b && room.x + room.w > a : room.y < b && room.y + room.h > a;
}

/**
 * The building's windows in its tall outer walls, the ones not facing the camera, leaving out any where a room runs
 * along the wall instead, and the entrance in the front wall.
 */
export function outerPanes(fp: Footprint, rooms: readonly Room[], near: Sides = nearSides(0)): OuterPane[] {
  const panes: OuterPane[] = [];
  for (const run of wallRuns(fp)) {
    if (near[run.side]) continue;
    for (let t = run.a + 2; t < run.b - 1; t += PANE_EVERY) {
      const a = t - 0.25;
      const b = a + PANE_W;
      if (rooms.some((r) => against(r, run, a, b)) || atEntrance(fp, run, a, b)) continue;
      panes.push({ side: run.side, horizontal: run.horizontal, line: run.line, a, b });
    }
  }
  return panes;
}

/**
 * The stretches of the building's outer walls, tall across from the camera and low facing it, with a gap for the
 * entrance. Where two walls meet at an outside corner, one runs on over it: a tall wall before a low one, and along x
 * before along z. Looking from the south-east, as the game always has, a rectangle's north wall runs the whole width,
 * the west wall takes the south-west corner and the low south wall the south-east one. At an inside corner, the same
 * wall runs right into the corner, and the other stops short of it.
 */
export function shellStretches(fp: Footprint, near: Sides): ShellStretch[] {
  const T = OUTER_T;
  const runs = wallRuns(fp);
  /** How strongly a wall claims a corner: a tall wall first, then along x. */
  const rank = (run: WallRun) => (near[run.side] ? 2 : 0) + (run.horizontal ? 0 : 1);
  /** How far each run's ends reach past its tiles: on over an outside corner, or short of an inside one. */
  const reach = new Map<WallRun, { a: number; b: number }>(runs.map((r) => [r, { a: 0, b: 0 }]));
  for (const c of wallCorners(fp, runs)) {
    const hOwns = rank(c.h) < rank(c.v);
    const [run, end] = c.outside === hOwns ? [c.h, c.hEnd] : [c.v, c.vEnd];
    const ends = reach.get(run);
    if (ends) ends[end] = c.outside ? T : -T;
  }
  const out: ShellStretch[] = [];
  for (const run of runs) {
    const ends = reach.get(run) ?? { a: 0, b: 0 };
    const a = run.a - ends.a;
    const b = run.b + ends.b;
    const outward = run.side === 'south' || run.side === 'east' ? 1 : -1;
    const base = {
      side: run.side,
      horizontal: run.horizontal,
      tall: !near[run.side],
      at: run.line + (outward * T) / 2,
    };
    // the wall in stretches either side of each entrance in it
    let from = a;
    for (const d of doorsIn(fp, run)) {
      out.push({ ...base, a: from, b: d.a });
      from = d.b;
    }
    out.push({ ...base, a: from, b });
  }
  return out;
}
