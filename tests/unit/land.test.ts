// Land: the plots each center sells around its building, when they come up for sale and what they cost, buying them
// from the world, and the strips older saves bought along a side.
import { describe, expect, it } from 'vitest';

import { CENTERS, type PlotDef, type Rect, SIDEWALK_Y } from '../../src/core/data';
import { footprintOf, inRect } from '../../src/core/footprint';
import { LAND_STEP, lotWidth, nextStrip, plotAt, plotOffers, plotTiles, stripRects } from '../../src/core/land';
import { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import { upgradeSave } from '../../src/core/state/upgrade';
import { Z_CORRIDOR, Z_SCENERY } from '../../src/core/world';
import { boardSpot, boardText } from '../../src/render/for-sale';
import { landColor } from '../../src/render/heatmap';
import {
  expandHint,
  PLOT_LOCKED,
  PLOT_OPEN,
  PLOT_POINTED,
  plotHeat,
  plotMiddle,
  plotSize,
} from '../../src/ui/lib/land';
import { buildRoom, freshSim, inconsistencies, openCenter, run, toasts } from './helpers';

/** Whether two plots, or a plot and the building, share a wall: a tile of one next to a tile of the other. */
function adjoins(a: readonly Rect[], b: readonly Rect[]): boolean {
  /** Whether a tile is in b. */
  const inB = (x: number, y: number) => b.some((r) => inRect(r, x, y));
  return plotTiles({ rects: a }).some(([x, y]) => inB(x + 1, y) || inB(x - 1, y) || inB(x, y + 1) || inB(x, y - 1));
}

/** Whether two sets of rectangles share a tile. */
const overlaps = (a: readonly Rect[], b: readonly Rect[]) =>
  plotTiles({ rects: a }).some(([x, y]) => b.some((r) => inRect(r, x, y)));

describe("each center's plots of land", () => {
  for (const center of Object.values(CENTERS)) {
    it(`fit the lot at ${center.name}, each joined to the building`, () => {
      const width = lotWidth(center);
      const base = center.plot;
      const ids = center.plots.map((p) => p.id);
      expect(center.plots.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      center.plots.forEach((p: PlotDef, i) => {
        expect(p.price, p.id).toBeGreaterThan(0);
        expect(p.star, p.id).toBeGreaterThanOrEqual(0);
        expect(p.star, p.id).toBeLessThanOrEqual(center.goals.length);
        for (const r of p.rects) {
          // on the lot, clear of the beach huts at The Boardwalk, and never in front of the building
          expect(r.x0, p.id).toBeGreaterThanOrEqual(1);
          expect(r.x1, p.id).toBeLessThanOrEqual(width - 2);
          expect(r.y0, p.id).toBeGreaterThanOrEqual(center.id === 'boardwalk' ? 3 : 1);
          expect(r.y1, p.id).toBeLessThanOrEqual(base.y1);
          expect(r.y1, p.id).toBeLessThan(SIDEWALK_Y - 1);
        }
        expect(overlaps(p.rects, [base]), `${p.id} over the building`).toBe(false);
        for (const q of center.plots.slice(0, i))
          expect(overlaps(p.rects, q.rects), `${p.id} over ${q.id}`).toBe(false);
        // it shares a wall with the building, or with the plot it comes after, which is listed before it
        const after = p.after ? center.plots.slice(0, i).find((q) => q.id === p.after) : undefined;
        if (p.after) expect(after, `${p.id} comes after ${p.after}`).toBeDefined();
        expect(adjoins(p.rects, after ? after.rects : [base]), `${p.id} joins the building`).toBe(true);
        if (after) expect(after.star).toBeLessThanOrEqual(p.star);
      });
    });

    it(`can all be bought at ${center.name}, and everything is still reachable`, () => {
      const s = newGame(center.id);
      s.unlockAll = true;
      s.money = 1e7;
      const sim = new Sim(s);
      for (const p of center.plots) expect(sim.buyPlot(p.id), p.id).toBe(true);
      expect(sim.landOffers().every((o) => o.state === 'owned')).toBe(true);
      expect(sim.world.connected()).toBe(true);
      for (const p of center.plots)
        for (const [x, y] of plotTiles(p)) expect(sim.world.zoneAt(x, y), `${p.id} at ${x},${y}`).toBe(Z_CORRIDOR);
    });
  }

  it('keep the courtyard at The Exchange outdoors, walled in on every side', () => {
    const s = newGame('exchange');
    s.unlockAll = true;
    s.money = 1e6;
    const sim = new Sim(s);
    expect(sim.buyPlot('courtyard-block')).toBe(true);
    expect(sim.world.inside(15, 4)).toBe(false);
    expect(sim.world.zoneAt(15, 4)).toBe(Z_SCENERY);
    expect(sim.world.inside(15, 2)).toBe(true);
  });
});

describe('land for sale', () => {
  it('opens as the stars come, a plot after another once that one is bought', () => {
    const sim = freshSim();
    /** Each plot's state, by id. */
    const state = () => Object.fromEntries(sim.landOffers().map((o) => [o.def.id, o.state]));
    expect(state()).toEqual({
      'east-wing': 'open',
      'back-gallery': 'locked',
      'garden-block': 'locked',
      'west-annex': 'locked',
    });
    expect(sim.landOffers().find((o) => o.def.id === 'back-gallery')?.why).toBe('Comes up for sale at star 1');
    sim.s.stars = 1;
    expect(state()['back-gallery']).toBe('open');
    expect(sim.landOffers().find((o) => o.def.id === 'garden-block')?.why).toBe(
      'Comes up for sale once the east wing is yours',
    );
    sim.s.money = 1e6;
    expect(sim.buyPlot('garden-block')).toBe(false);
    expect(sim.buyPlot('east-wing')).toBe(true);
    expect(state()['garden-block']).toBe('open');
  });

  it('grows the building into the plot, for its price, as corridor ready to build on', () => {
    const { sim, s } = openCenter(2);
    s.money = 50000;
    const offer = sim.landOffers().find((o) => o.def.id === 'east-wing');
    const rect = offer?.def.rects[0];
    if (!offer || !rect) throw new Error('no east wing');
    const building = s.ledger.building;
    expect(sim.world.zoneAt(rect.x0, rect.y0)).not.toBe(Z_CORRIDOR);
    sim.drain();
    expect(sim.buyPlot('east-wing')).toBe(true);
    expect(toasts(sim.drain())).toContain('The east wing is yours, and the building has grown into it.');
    expect(s.money).toBe(50000 - offer.price);
    expect(s.ledger.building - building).toBe(offer.price);
    expect(s.land).toEqual([{ plot: 'east-wing', rects: [rect] }]);
    expect(sim.world.building.bounds.x1).toBe(rect.x1);
    expect(sim.world.zoneAt(rect.x1, rect.y1)).toBe(Z_CORRIDOR);
    expect(sim.landOffers().find((o) => o.def.id === 'east-wing')?.state).toBe('owned');
    expect(sim.buyPlot('east-wing'), 'bought already').toBe(false);
    // a room can go right up to the new wall, and guests can walk there
    const room = buildRoom(
      sim,
      'staffroom',
      { x: rect.x1 - 2, y: 5, w: 3, h: 3 },
      { x: rect.x1 - 1, y: 7, dx: 0, dy: 1 },
      [],
    );
    expect(room.x + room.w - 1).toBe(rect.x1);
    expect(sim.world.findPath(15, 16, rect.x1, rect.y1)).not.toBeNull();
    run(sim, 30);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('can be bought while the game is paused', () => {
    const sim = freshSim();
    sim.s.speed = 0;
    sim.s.money = 1e6;
    expect(sim.buyPlot('east-wing')).toBe(true);
    expect(sim.world.inside(30, 10)).toBe(true);
  });

  it('cannot be bought without the money, and the plot stays for sale', () => {
    const sim = freshSim();
    sim.s.money = 100;
    sim.drain();
    expect(sim.buyPlot('east-wing')).toBe(false);
    expect(toasts(sim.drain())).toContain('Not enough money for that land.');
    expect(sim.s.land).toEqual([]);
    expect(sim.landOffers().find((o) => o.def.id === 'east-wing')?.state).toBe('open');
  });

  it('costs only its share for the tiles not already bought as strips, and nothing once they all are', () => {
    const s = newGame('sandbox');
    // a strip bought before plots, four tiles deep along the east wall, covering half of the east wing
    s.land = [{ plot: 'strip', rects: [{ x0: 28, x1: 31, y0: 3, y1: 17 }] }];
    const sim = new Sim(s);
    const wing = sim.landOffers().find((o) => o.def.id === 'east-wing');
    expect(wing?.state).toBe('open');
    expect(wing?.price).toBe(12000);
    s.land.push({ plot: 'strip', rects: [{ x0: 32, x1: 35, y0: 3, y1: 17 }] });
    sim.world.rebuild();
    expect(sim.landOffers().find((o) => o.def.id === 'east-wing')?.state).toBe('owned');
  });

  it('is kept in the save, and a save from before land was sold has none', () => {
    const sim = freshSim();
    const old = JSON.parse(JSON.stringify(sim.s)) as Record<string, unknown>;
    delete old.land;
    const s = old as unknown as ReturnType<typeof newGame>;
    upgradeSave(s);
    expect(s.land).toEqual([]);
  });
});

describe('strips, as land was sold up to version 0.26', () => {
  const PLOT = { x0: 7, x1: 22, y0: 8, y1: 17, door: [14, 15] as const };
  const limits = { west: 1, east: 30, back: 1 };

  it('were LAND_STEP deep, the last on a side taking what was left rather than leaving a sliver', () => {
    expect(nextStrip(PLOT, 'west', limits)).toEqual({ x0: 3, x1: 6, y0: 8, y1: 17 });
    expect(nextStrip({ ...PLOT, x0: 6 }, 'west', limits), 'five left').toMatchObject({ x0: 1, x1: 5 });
    expect(nextStrip({ ...PLOT, x0: 3 }, 'west', limits), 'two left').toMatchObject({ x0: 1, x1: 2 });
    expect(nextStrip({ ...PLOT, x0: 2 }, 'west', limits), 'a single tile is no strip').toBeNull();
    expect(nextStrip(PLOT, 'east', limits)).toEqual({ x0: 23, x1: 26, y0: 8, y1: 17 });
    expect(nextStrip(PLOT, 'back', limits)).toEqual({ x0: 7, x1: 22, y0: 4, y1: 7 });
    expect(LAND_STEP).toBe(4);
  });

  it('grew the building a side at a time, without moving its front', () => {
    const rects = stripRects(PLOT, ['west', 'back', 'east', 'west'], limits);
    expect(footprintOf(PLOT, rects).bounds).toEqual({ x0: 1, x1: 26, y0: 4, y1: 17 });
    // a strip recorded with no room left for it, as a save could have, adds nothing
    expect(stripRects({ ...PLOT, x0: 2 }, ['west'], limits)).toEqual([]);
  });

  it('keep the exact shape they had in a save that kept only the sides bought', () => {
    for (const center of ['sandbox', 'boardwalk'] as const) {
      const sides = ['west', 'back', 'east', 'east', 'back', 'back'] as const;
      const old = JSON.parse(JSON.stringify(newGame(center))) as Record<string, unknown>;
      old.version = 24;
      old.land = sides;
      const s = old as unknown as ReturnType<typeof newGame>;
      upgradeSave(s);
      expect(s.land.every((l) => l.plot === 'strip' && l.rects.length === 1)).toBe(true);
      // worked out on the 32-tile lot of the time, whatever size the lot is now, and short of the beach huts
      const was = { west: 1, east: 30, back: center === 'boardwalk' ? 3 : 1 };
      const bounds = footprintOf(CENTERS[center].plot, stripRects(CENTERS[center].plot, sides, was)).bounds;
      expect(new Sim(s).world.building.bounds, center).toEqual(bounds);
      if (center === 'boardwalk') expect(bounds.y0).toBe(3);
    }
  });
});

describe('how land is shown', () => {
  const sim = freshSim();
  sim.s.stars = 1;
  const offers = sim.landOffers();
  const wing = offers.find((o) => o.def.id === 'east-wing');
  const garden = offers.find((o) => o.def.id === 'garden-block');
  if (!wing || !garden) throw new Error('missing plots');

  it('sizes a plot across by deep, or in tiles when it is not a rectangle', () => {
    expect(plotSize(wing.def)).toBe('8 × 15 tiles');
    const courtyard = CENTERS.exchange.plots[0];
    expect(courtyard && plotSize(courtyard)).toBe('56 tiles');
  });

  it('outlines every tile of the plots not yet bought, by whether they are for sale, the one pointed at brightest', () => {
    const tiles = plotHeat(offers, 'east-wing');
    expect(tiles.filter(([, , v]) => v === PLOT_POINTED)).toHaveLength(8 * 15);
    expect(tiles.filter(([, , v]) => v === PLOT_LOCKED)).toHaveLength(plotTiles(garden.def).length + 2 * 12);
    expect(tiles.filter(([, , v]) => v === PLOT_OPEN)).toHaveLength(15 * 2);
    expect(new Set([PLOT_POINTED, PLOT_LOCKED, PLOT_OPEN].map((v) => landColor(v).getHex())).size).toBe(3);
  });

  it('finds the plot under a tile, and the middle of each', () => {
    expect(plotAt(CENTERS.sandbox.plots, 30, 10)?.id).toBe('east-wing');
    expect(plotAt(CENTERS.sandbox.plots, 15, 10)).toBeUndefined();
    expect(plotMiddle(wing.def)).toEqual([32, 10.5]);
  });

  it('puts up a board on each plot, saying whether it is for sale', () => {
    expect(boardSpot(wing.def)).toEqual({ x: 32, z: 10.5 });
    expect(boardText(wing)).toBe('FOR SALE');
    expect(boardText(garden)).toBe('SOON');
    const annex = offers.find((o) => o.def.id === 'west-annex');
    expect(annex && boardText(annex)).toBe('★ 2');
  });

  it('says what the plot pointed at costs, and how to buy it', () => {
    expect(expandHint(undefined)).toMatch(/point at a plot/);
    expect(expandHint(wing)).toBe('🏡 The east wing · 8 × 15 tiles · $24,000 · click to buy');
    expect(expandHint(garden)).not.toMatch(/click to buy/);
    expect(expandHint({ ...wing, state: 'owned' })).toBe('🏡 The east wing · 8 × 15 tiles · yours');
  });
});

describe('plot offers', () => {
  it('are worked out from the building as it stands', () => {
    const s = newGame('willow');
    s.stars = 3;
    const offers = plotOffers(s, footprintOf(CENTERS.willow.plot));
    expect(offers.map((o) => o.state)).toEqual(['open', 'open', 'open']);
    expect(offers.map((o) => o.price)).toEqual(CENTERS.willow.plots.map((p) => p.price));
  });
});
