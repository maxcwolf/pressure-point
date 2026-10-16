// The building as a set of tiles: its runs of outer wall and their corners, in a rectangle, an L, two buildings and
// round a courtyard, and the walls, windows and rooms built from them at every turn of the camera.
import { describe, expect, it } from 'vitest';

import { type Plot, type Rect, SANDBOX_PLOT } from '../../src/core/data';
import {
  type Footprint,
  footprintOf,
  footprintTiles,
  inFootprint,
  wallCorners,
  wallRuns,
} from '../../src/core/footprint';
import type { Room } from '../../src/core/state/types';
import { outerPanes, type ShellStretch, shellStretches } from '../../src/render/outer-walls';
import { roomShape } from '../../src/render/room-walls';
import { OUTER_T, WALL_T } from '../../src/render/shared';
import { nearSides, type Turn } from '../../src/render/turn';

const TURNS: readonly Turn[] = [0, 1, 2, 3];

/** A small building, its door in the middle of its front. */
const BASE: Plot = { x0: 4, x1: 11, y0: 4, y1: 9, door: [7, 8] };

/** The shapes to try: a rectangle, an L with a wing out the back, two buildings apart, and a ring round a courtyard. */
const SHAPES: Readonly<Record<string, Footprint>> = {
  rectangle: footprintOf(BASE),
  'an L': footprintOf(BASE, [{ x0: 4, x1: 7, y0: 1, y1: 3 }]),
  'two buildings': footprintOf(BASE, [{ x0: 14, x1: 17, y0: 2, y1: 5 }]),
  'a courtyard': footprintOf(BASE, [
    { x0: 4, x1: 11, y0: 0, y1: 0 },
    { x0: 4, x1: 4, y0: 1, y1: 3 },
    { x0: 11, x1: 11, y0: 1, y1: 3 },
  ]),
};

/** The ground a stretch of wall stands on, seen from above. */
function groundOf(w: ShellStretch): Rect {
  const across = [w.at - OUTER_T / 2, w.at + OUTER_T / 2] as const;
  return w.horizontal
    ? { x0: w.a, x1: w.b, y0: across[0], y1: across[1] }
    : { x0: across[0], x1: across[1], y0: w.a, y1: w.b };
}

/** How much two pieces of ground overlap. */
function overlap(p: Rect, q: Rect): number {
  const w = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0);
  const h = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

describe("a building's tiles", () => {
  it('are the rectangles it is built from, each tile once', () => {
    const l = SHAPES['an L']!;
    expect(footprintTiles(l)).toHaveLength(8 * 6 + 4 * 3);
    expect(inFootprint(l, 5, 2)).toBe(true);
    expect(inFootprint(l, 9, 2)).toBe(false);
    expect(l.bounds).toEqual({ x0: 4, x1: 11, y0: 1, y1: 9 });
    expect(l.front).toBe(BASE.y1);
    expect(l.door).toEqual(BASE.door);
  });
});

describe("a building's runs of outer wall", () => {
  it('are one a side for a rectangle, meeting at four outside corners', () => {
    const fp = SHAPES.rectangle!;
    expect(wallRuns(fp)).toEqual([
      { side: 'north', horizontal: true, line: 4, a: 4, b: 12 },
      { side: 'south', horizontal: true, line: 10, a: 4, b: 12 },
      { side: 'west', horizontal: false, line: 4, a: 4, b: 10 },
      { side: 'east', horizontal: false, line: 12, a: 4, b: 10 },
    ]);
    const corners = wallCorners(fp);
    expect(corners).toHaveLength(4);
    expect(corners.every((c) => c.outside)).toBe(true);
  });

  it('turn an inside corner in the crook of an L', () => {
    const fp = SHAPES['an L']!;
    expect(wallRuns(fp)).toHaveLength(6);
    const corners = wallCorners(fp);
    expect(corners.filter((c) => c.outside)).toHaveLength(5);
    const [inside] = corners.filter((c) => !c.outside);
    expect(inside).toMatchObject({ h: { side: 'north', line: 4, a: 8 }, v: { side: 'east', line: 8, b: 4 } });
  });

  it('go all the way round each of two buildings', () => {
    const fp = SHAPES['two buildings']!;
    expect(wallRuns(fp)).toHaveLength(8);
    expect(wallCorners(fp).filter((c) => c.outside)).toHaveLength(8);
  });

  it('face into a courtyard from all round it', () => {
    const fp = SHAPES['a courtyard']!;
    const inward = wallRuns(fp).filter((r) => r.line > 0 && r.line < 12 && r.a >= 1 && r.b <= 4 + 7);
    expect(inward.map((r) => r.side).sort()).toEqual(['east', 'north', 'south', 'west']);
    expect(wallCorners(fp).filter((c) => !c.outside)).toHaveLength(4);
  });
});

describe("a building's outer walls, as built", () => {
  for (const [name, fp] of Object.entries(SHAPES)) {
    it(`never stand in each other, and close every edge, for ${name} at every turn`, () => {
      for (const t of TURNS) {
        const walls = shellStretches(fp, nearSides(t));
        for (let i = 0; i < walls.length; i++)
          for (let j = i + 1; j < walls.length; j++)
            expect(overlap(groundOf(walls[i]!), groundOf(walls[j]!)), `turn ${t}: ${i} and ${j}`).toBeCloseTo(0);
        // every edge between a tile inside and one outside has wall along it, except the entrance
        for (const run of wallRuns(fp)) {
          const out = run.side === 'south' || run.side === 'east' ? 1 : -1;
          for (let along = run.a; along < run.b; along++) {
            if (run.side === 'south' && run.line === fp.front + 1 && fp.door.includes(along)) continue;
            const across = run.line + (out * OUTER_T) / 2;
            const [x, y] = run.horizontal ? [along + 0.5, across] : [across, along + 0.5];
            const covered = walls.some((w) => {
              const g = groundOf(w);
              return x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1;
            });
            expect(covered, `turn ${t}: ${run.side} wall at ${along}`).toBe(true);
          }
        }
      }
    });
  }

  it('take in the crook of an L with the tall wall, the low one stopping short', () => {
    const fp = SHAPES['an L']!;
    const walls = shellStretches(fp, nearSides(0));
    // looking from the south-east, the wing's east wall faces the camera and the main building's back wall does not
    const back = walls.find((w) => w.side === 'north' && w.at > 3 && w.at < 4);
    const wing = walls.find((w) => w.side === 'east' && w.at > 8 && w.at < 9);
    expect(back).toMatchObject({ tall: true, a: 8 });
    expect(wing?.tall).toBe(false);
    expect(wing?.b).toBeCloseTo(4 - OUTER_T);
  });

  it('put windows in the tall walls of the wing too', () => {
    const panes = outerPanes(SHAPES['an L']!, [], nearSides(0));
    expect(panes.some((p) => p.side === 'north' && p.line === 1)).toBe(true);
    expect(panes.some((p) => p.side === 'north' && p.line === 4)).toBe(true);
  });
});

describe('a room in the crook of an L', () => {
  /** The sandbox's building with a wing out the back at its west end. */
  const fp = footprintOf(SANDBOX_PLOT, [{ x0: 3, x1: 10, y0: 0, y1: 2 }]);
  /** A room along the back wall, partly under the wing. */
  const room: Room = {
    id: 1,
    type: 'staffroom',
    x: 8,
    y: 3,
    w: 5,
    h: 4,
    door: { x: 10, y: 6, dx: 0, dy: 1 },
    done: true,
    windows: [{ x: 12, y: 3, dx: 0, dy: -1 }],
  } as Room;

  it('has a wall of its own where the wing is beyond it, and leaves the rest to the outer wall', () => {
    const { boxes } = roomShape(room, fp, nearSides(0));
    const north = boxes.filter(
      (b) => b.horizontal && b.material === 'wall' && Math.abs(b.fixed - (3 + WALL_T / 2)) < 1e-9,
    );
    expect(north.length).toBeGreaterThan(0);
    expect(Math.min(...north.map((b) => b.a))).toBe(8);
    expect(Math.max(...north.map((b) => b.b))).toBe(11);
    // its window is in the outer wall, past the wing
    const glass = boxes.find((b) => b.material === 'glass' && b.horizontal && b.a > 12 && b.a < 13);
    expect(glass?.fixed).toBeCloseTo(3 + 0.02);
  });

  it('keeps the building’s windows out of the outer wall it stands against', () => {
    const panes = outerPanes(fp, [room], nearSides(0));
    expect(panes.some((p) => p.side === 'north' && p.line === 3 && p.a < 13 && p.b > 11)).toBe(false);
  });
});
