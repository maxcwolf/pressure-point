// Buildings standing apart: their own doors, the paths out to them, walking outside between buildings, the walls that
// keep warmth and noise in, and the weather on the way.
import { describe, expect, it } from 'vitest';

import { CENTERS, DAY_SECONDS, SIDEWALK_Y } from '../../src/core/data';
import { entranceSpan, entranceSteps, footprintOf, onPath } from '../../src/core/footprint';
import { buildingsOf } from '../../src/core/land';
import { spawnGuest } from '../../src/core/sim/guests';
import { badWeather, updateOutdoors } from '../../src/core/sim/outdoors';
import type { Sim } from '../../src/core/sim/sim';
import { spreader } from '../../src/core/sim/spread';
import { indoorTemp, outdoorTemp, warmthAt } from '../../src/core/sim/warmth';
import { Z_CORRIDOR, Z_OUTSIDE, Z_SCENERY } from '../../src/core/world';
import { shellStretches } from '../../src/render/outer-walls';
import { nearSides } from '../../src/render/turn';
import { addConsult, buildRoom, freshSim, hire, inconsistencies, run, runUntil, toasts } from './helpers';

/** The sandbox with the east wing built on, and the garden pavilion past it: built too, or the builders still at it. */
function withPavilion(finished = true): Sim {
  const sim = freshSim();
  sim.s.stars = 1;
  sim.s.money = 1e6;
  for (const id of ['east-wing', 'garden-block']) {
    expect(sim.buyPlot(id), id).toBe(true);
    if (id === 'garden-block' && !finished) break;
    for (const l of sim.s.land) if (l.ready !== undefined) l.ready = sim.s.day;
    run(sim, 1.1);
  }
  return sim;
}

/** A new guest, standing on a tile. */
function guestAt(ctx: Parameters<typeof spawnGuest>[0], x: number, y: number) {
  const g = spawnGuest(ctx);
  if (!g) throw new Error('no guest came');
  g.tx = x;
  g.ty = y;
  return g;
}

describe('an entrance', () => {
  it('is two tiles of a wall, each with a step from inside to out', () => {
    expect(entranceSteps({ side: 'west', x: 38, y: 12 })).toEqual([
      { inside: [38, 12], outside: [37, 12] },
      { inside: [38, 13], outside: [37, 13] },
    ]);
    expect(entranceSteps({ side: 'south', x: 14, y: 17 })).toEqual([
      { inside: [14, 17], outside: [14, 18] },
      { inside: [15, 17], outside: [15, 18] },
    ]);
    // where it is in its wall, as a run of wall has it
    expect(entranceSpan({ side: 'west', x: 38, y: 12 })).toEqual({ side: 'west', line: 38, a: 12, b: 14 });
    expect(entranceSpan({ side: 'south', x: 14, y: 17 })).toEqual({ side: 'south', line: 18, a: 14, b: 16 });
  });

  it('is only the front door, for a building with nothing standing apart', () => {
    const fp = footprintOf(CENTERS.sandbox.plot);
    expect(fp.entrances).toEqual([{ side: 'south', x: 14, y: 17 }]);
    expect(fp.paths).toEqual([]);
  });
});

describe('the outer walls', () => {
  it('leave a gap for a door in any of them, at every turn of the camera', () => {
    const fp = footprintOf(CENTERS.sandbox.plot, [{ x0: 38, x1: 42, y0: 8, y1: 17 }], {
      entrances: [{ side: 'west', x: 38, y: 12 }],
    });
    for (const turn of [0, 1, 2, 3] as const) {
      const west = shellStretches(fp, nearSides(turn)).filter((w) => w.side === 'west' && w.at > 37 && w.at < 39);
      expect(west.map((w) => [w.a, w.b]).flat(), `turn ${turn}`).toContain(12);
      expect(west.some((w) => w.a < 13 && w.b > 13)).toBe(false);
      expect(west.some((w) => w.a === 14)).toBe(true);
    }
  });
});

describe('a building standing apart', () => {
  it('has its own door and a path out to it, once the builders are done', () => {
    const sim = withPavilion(false);
    // neither the door nor the path is there while the builders are at work
    expect(sim.s.land[1]?.ready).toBeGreaterThan(sim.s.day);
    expect(buildingsOf(sim.s).entrances).toHaveLength(1);
    expect(buildingsOf(sim.s).paths).toEqual([]);
    // however often the grids are worked out again meanwhile, as building a room does
    sim.world.rebuild();
    expect(sim.world.zoneAt(39, 18)).toBe(Z_SCENERY);
    expect(sim.world.zoneAt(40, 12)).toBe(Z_SCENERY);
    sim.drain();
    run(sim, 3 * DAY_SECONDS + 1);
    expect(toasts(sim.drain())).toContain(
      'Work on the garden pavilion is done: it has a door of its own, and a path out to it.',
    );
    const { world } = sim;
    expect(buildingsOf(sim.s).entrances).toHaveLength(2);
    expect(world.zoneAt(39, 18)).toBe(Z_OUTSIDE);
    expect(world.zoneAt(40, 19)).toBe(Z_OUTSIDE);
    expect(world.zoneAt(40, 12)).toBe(Z_CORRIDOR);
    // in and out only through the door, and nowhere else: the lawn round it is not walked on
    expect(world.canStep(39, 18, 39, 17)).toBe(true);
    expect(world.canStep(40, 18, 40, 17)).toBe(true);
    expect(world.walkable(41, 18)).toBe(false);
    // the tiles just inside are kept clear
    expect(world.reserved[world.idx(39, 17)]).toBe(1);
    expect(world.reserved[world.idx(40, 16)]).toBe(1);
    expect(world.connected()).toBe(true);
  });

  it('is numbered apart from the building with the front door, and the outdoors is neither', () => {
    const { world } = withPavilion();
    expect(world.buildingAt(14, 10)).toBe(1);
    expect(world.buildingAt(32, 10)).toBe(1);
    expect(world.buildingAt(40, 10)).toBe(2);
    expect(world.buildingAt(36, 10)).toBe(0);
    expect(world.buildingAt(-1, 0)).toBe(0);
  });

  it('is walked to outside, along the path, from the front door', () => {
    const { world } = withPavilion();
    const path = world.findPath(14, 15, 41, 15);
    expect(path).not.toBeNull();
    const tiles = (path ?? []).map(([x, y]) => [Math.floor(x), Math.floor(y)] as const);
    expect(tiles.some(([x, y]) => onPath(world.building, x, y))).toBe(true);
    expect(tiles.some(([x, y]) => world.zoneAt(x, y) === Z_OUTSIDE)).toBe(true);
  });

  it('holds back warmth through its walls, and lets the weather in outside', () => {
    const sim = withPavilion();
    const { world } = sim;
    const grid = new Float32Array(world.w * world.h);
    const ctx = (sim as unknown as { ctx: Parameters<typeof spreader>[0] }).ctx;
    // from just inside the pavilion's west wall: three tiles on inside it, and three tiles across the path in the wing
    spreader(ctx, () => 1, 0.5)(grid, 38, 15, 10, 4);
    const within = grid[world.idx(41, 15)] ?? 0;
    expect(within).toBeGreaterThan(0);
    expect(grid[world.idx(35, 15)]).toBeCloseTo(within * 0.5);
    sim.s.weatherOn = true;
    sim.s.day = 0;
    run(sim, 1.1);
    const outside = outdoorTemp(CENTERS.sandbox.climate, sim.s.day);
    // with nothing to warm or cool them: the weather itself out of doors, some of the way toward just right inside
    expect(warmthAt(ctx, 39, 19)).toBeCloseTo(outside, 1);
    expect(warmthAt(ctx, 40, 15)).toBeCloseTo(indoorTemp(outside), 1);
    expect(indoorTemp(outside)).not.toBeCloseTo(outside, 0);
  });

  it('has guests treated in it, walking out and back along the path', () => {
    const sim = withPavilion();
    sim.placeItem('reception_desk', 14, 13, 0);
    addConsult(sim);
    // the only massage room is in the pavilion
    buildRoom(sim, 'massage', { x: 39, y: 8, w: 4, h: 4 }, { x: 40, y: 11, dx: 0, dy: 1 }, [
      ['massage_table', 40, 8],
      ['oil_trolley', 42, 8],
    ]);
    for (const role of ['receptionist', 'consultant', 'therapist'] as const) hire(sim, role);
    let outside = false;
    runUntil(
      sim,
      () => {
        outside ||= sim.s.guests.some((g) => onPath(sim.world.building, g.tx, g.ty));
        return outside && sim.s.tally.healed > 0;
      },
      900,
    );
    expect(outside, 'someone walked the path').toBe(true);
    expect(sim.s.tally.healed).toBeGreaterThan(0);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('the weather', () => {
  it('is minded by guests walking the paths in a storm, not on the pavement', () => {
    const sim = withPavilion();
    const ctx = (sim as unknown as { ctx: Parameters<typeof updateOutdoors>[0] }).ctx;
    sim.s.weatherOn = false;
    expect(badWeather(ctx)).toBe(false);
    sim.s.mishap = { kind: 'storm', starts: 0, ends: 99, prepared: false, started: true };
    expect(badWeather(ctx)).toBe(true);
    const onThePath = guestAt(ctx, 39, 18);
    const onThePavement = guestAt(ctx, 30, SIDEWALK_Y);
    updateOutdoors(ctx);
    expect(onThePath.feelings).toContain('out-in-weather');
    expect(onThePavement.feelings).not.toContain('out-in-weather');
  });

  it('is not minded on a fine day without a storm', () => {
    const sim = withPavilion();
    const ctx = (sim as unknown as { ctx: Parameters<typeof updateOutdoors>[0] }).ctx;
    sim.s.weatherOn = true;
    // the sandbox's climate never strays far from just right
    expect(badWeather(ctx)).toBe(false);
    const g = guestAt(ctx, 39, 18);
    updateOutdoors(ctx);
    expect(g.feelings).not.toContain('out-in-weather');
    // up in the mountains in winter is another matter
    sim.s.center = 'highpines';
    expect(badWeather(ctx)).toBe(true);
  });
});
