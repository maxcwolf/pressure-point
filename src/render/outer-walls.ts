// The building's outer walls, worked out from the edges of its tiles: each straight run of wall, tall across from the
// camera and low facing it, joined at the corners, with a gap for each entrance. Where its windows go is the game's to
// say (`buildingWindows()` in core/footprint.ts). Nothing here draws anything, so it can be tested without a renderer.

import { entrancesIn, type Footprint, wallCorners, type WallRun, wallRuns } from '../core/footprint';
import { OUTER_T } from './shared';
import type { Side, Sides } from './turn';

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
    for (const d of entrancesIn(fp, run)) {
      out.push({ ...base, a: from, b: d.a });
      from = d.b;
    }
    out.push({ ...base, a: from, b });
  }
  return out;
}
