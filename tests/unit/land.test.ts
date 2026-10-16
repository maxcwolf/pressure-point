// More land: the plots next to a building, buying them, and the building growing into them.
import { describe, expect, it } from 'vitest';

import { CENTERS, LAND_LIMITS, LAND_STEP, LAND_TILE_PRICE, type Plot } from '../../src/core/data';
import { grownBy, landLimits, nextPlot, plotWith, roomToGrow } from '../../src/core/land';
import { newGame } from '../../src/core/state/game';
import { upgradeSave } from '../../src/core/state/upgrade';
import { Z_CORRIDOR } from '../../src/core/world';
import { landColor } from '../../src/render/heatmap';
import { LAND_NAMES, landSignSpots, landSize, landTiles } from '../../src/ui/lib/land';
import { buildRoom, freshSim, inconsistencies, openCenter, run, toasts } from './helpers';

const PLOT: Plot = { x0: 7, x1: 22, y0: 8, y1: 17, door: [14, 15] };

describe('the plots next to a building', () => {
  it('are LAND_STEP deep, the last on a side taking what is left rather than leaving a sliver', () => {
    const limits = { west: 1, east: 30, back: 1 };
    expect(roomToGrow(PLOT, 'west', limits)).toBe(6);
    expect(nextPlot(PLOT, 'west', limits)).toMatchObject({ x0: 3, x1: 6, y0: 8, y1: 17, depth: LAND_STEP });
    expect(nextPlot({ ...PLOT, x0: 6 }, 'west', limits), 'five left').toMatchObject({ x0: 1, x1: 5, depth: 5 });
    expect(nextPlot({ ...PLOT, x0: 3 }, 'west', limits), 'two left').toMatchObject({ x0: 1, x1: 2, depth: 2 });
    expect(nextPlot({ ...PLOT, x0: 2 }, 'west', limits), 'a single tile is no plot').toBeNull();
    expect(nextPlot(PLOT, 'east', limits)).toMatchObject({ x0: 23, x1: 26, y0: 8, y1: 17 });
    expect(nextPlot(PLOT, 'back', limits)).toMatchObject({ x0: 7, x1: 22, y0: 4, y1: 7 });
  });

  it('cost the same for every tile', () => {
    const offer = nextPlot(PLOT, 'west', LAND_LIMITS);
    expect(offer?.price).toBe(4 * 10 * LAND_TILE_PRICE);
  });

  it('grow the building without moving its front or its door', () => {
    const limits = LAND_LIMITS;
    const grown = plotWith(PLOT, ['west', 'back', 'east', 'west'], limits);
    expect(grown).toEqual({ x0: 1, x1: 26, y0: 4, y1: 17, door: [14, 15] });
    const west = nextPlot(PLOT, 'west', limits);
    expect(west && grownBy(PLOT, west)).toEqual({ ...PLOT, x0: 3 });
    // a plot recorded with no room left for it, as a save could have, changes nothing
    expect(plotWith({ ...PLOT, x0: 2 }, ['west'], limits)).toEqual({ ...PLOT, x0: 2 });
  });

  it('stop short of the beach huts at The Boardwalk', () => {
    const s = newGame('boardwalk');
    expect(landLimits(s).back).toBe(3);
    expect(landLimits(newGame('willow')).back).toBe(LAND_LIMITS.back);
    expect(plotWith(CENTERS.boardwalk.plot, ['back', 'back', 'back'], landLimits(s)).y0).toBe(3);
  });

  it('leave room for every center to grow, the sandbox included', () => {
    for (const c of Object.values(CENTERS)) {
      const s = newGame(c.id);
      const sides = (['west', 'east', 'back'] as const).filter((side) => nextPlot(c.plot, side, landLimits(s)));
      expect(sides.length, c.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('buying land', () => {
  it('is for sale from the first star', () => {
    const sim = freshSim();
    expect(sim.landForSale()).toBe(false);
    expect(sim.landOffers()).toEqual([]);
    expect(sim.buyLand('east')).toBe(false);
    sim.s.stars = 1;
    expect(sim.landOffers().map((o) => o.side)).toEqual(['west', 'east', 'back']);
  });

  it('grows the building into the plot, for its price, as corridor ready to build on', () => {
    const { sim, s } = openCenter(2);
    s.stars = 1;
    s.money = 50000;
    const offer = sim.landOffers().find((o) => o.side === 'east');
    if (!offer) throw new Error('no land for sale on the east');
    const building = s.ledger.building;
    expect(sim.world.zoneAt(offer.x0, offer.y0)).not.toBe(Z_CORRIDOR);
    sim.drain();
    expect(sim.buyLand('east')).toBe(true);
    expect(toasts(sim.drain())).toContain('The land is yours, and the building has grown into it.');
    expect(s.money).toBe(50000 - offer.price);
    expect(s.ledger.building - building).toBe(offer.price);
    expect(s.land).toEqual(['east']);
    expect(sim.world.building.bounds.x1).toBe(offer.x1);
    expect(sim.world.zoneAt(offer.x1, offer.y1)).toBe(Z_CORRIDOR);
    // a room can go right up to the new wall, and guests can walk there
    const room = buildRoom(
      sim,
      'staffroom',
      { x: offer.x1 - 2, y: 5, w: 3, h: 3 },
      { x: offer.x1 - 1, y: 7, dx: 0, dy: 1 },
      [],
    );
    expect(room.x + room.w - 1).toBe(offer.x1);
    expect(sim.world.findPath(15, 16, offer.x1, offer.y1)).not.toBeNull();
    run(sim, 30);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('cannot be bought without the money, and the plot stays for sale', () => {
    const sim = freshSim();
    sim.s.stars = 1;
    sim.s.money = 100;
    sim.drain();
    expect(sim.buyLand('back')).toBe(false);
    expect(toasts(sim.drain())).toContain('Not enough money for that land.');
    expect(sim.s.land).toEqual([]);
    expect(sim.landOffers().some((o) => o.side === 'back')).toBe(true);
  });

  it('runs out on a side once the building reaches the edge of its lot', () => {
    const sim = freshSim();
    sim.s.stars = 1;
    sim.s.money = 1e6;
    while (sim.buyLand('east')) void 0;
    expect(sim.world.building.bounds.x1).toBe(LAND_LIMITS.east);
    expect(sim.landOffers().map((o) => o.side)).toEqual(['west', 'back']);
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

describe('how land for sale is shown', () => {
  const offer = { side: 'east' as const, x0: 23, x1: 25, y0: 8, y1: 9, depth: 3, price: 1500 };

  it('names each side and sizes a plot across by deep', () => {
    expect(LAND_NAMES.back).toBe('Out the back');
    expect(landSize(offer)).toBe('3 × 2 tiles');
  });

  it('outlines every tile of each plot, the one pointed at in its own color', () => {
    const tiles = landTiles([offer, { ...offer, side: 'west', x0: 3, x1: 3 }], 'east');
    expect(tiles).toHaveLength(6 + 2);
    expect(tiles.filter(([, , v]) => v === 1)).toHaveLength(6);
    expect(landColor(1).getHex()).not.toBe(landColor(0).getHex());
  });

  it('stands a sign in the middle of each plot', () => {
    expect(landSignSpots([offer])).toEqual([{ x: 24.5, z: 9 }]);
  });
});
