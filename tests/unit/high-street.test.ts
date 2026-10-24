// Willow Lane's lot is on a high street: its road and pavements run on past the lot, with hedges and lamp posts. The
// hedges break for the path to the door and for every plot that reaches the street, and no lamp post stands along the
// lot's own frontage, which the opening view looks over.
import { beforeAll, describe, expect, it } from 'vitest';

import { CENTERS, SIDEWALK_Y } from '../../src/core/data';
import { footprintOf } from '../../src/core/footprint';
import { lotWidth } from '../../src/core/land';
import { buildScenery, streetLamps, streetOpenings } from '../../src/render/scenery';
import { SETTINGS } from '../../src/render/setting';

const willow = CENTERS.willow;
const fp = footprintOf(willow.plot);
const width = lotWidth(willow);
const plots = willow.plots.flatMap((p) => [...p.rects, ...(p.path ?? [])]);

describe('the high street', () => {
  it('runs past Willow Lane alone', () => {
    const on = Object.values(CENTERS).filter((c) => c.highStreet);
    expect(on.map((c) => c.id)).toEqual(['willow']);
  });

  it('breaks its hedges for the path to the door and every plot that reaches the street', () => {
    const openings = streetOpenings(fp, plots);
    expect(openings.some(([a, b]) => a <= fp.door[0] && b >= fp.door[1] + 1)).toBe(true);
    for (const r of plots.filter((p) => p.y1 >= SIDEWALK_Y - 2))
      expect(openings.some(([a, b]) => a <= r.x0 && b >= r.x1 + 1)).toBe(true);
  });

  it('keeps its lamp posts off the lot and clear of every opening', () => {
    const openings = streetOpenings(fp, plots);
    const lamps = streetLamps(openings, width);
    expect(lamps.length).toBeGreaterThan(0);
    for (const { x } of lamps) {
      expect(x < -1 || x > width + 1, `a lamp post at ${x}`).toBe(true);
      expect(openings.every(([a, b]) => x <= a - 1 || x >= b + 1)).toBe(true);
    }
  });
});

/** Does nothing, for every call the sign makes to draw on its canvas. */
const nothing = () => undefined;
/** A 2D context whose every method does nothing. */
const context = new Proxy(
  {},
  {
    /** Whatever is asked for is a method that does nothing. */
    get: () => nothing,
  },
);
/** A canvas that draws nothing. */
function canvas() {
  return {
    /** The one context it has. */
    getContext: () => context,
  };
}

/** Willow Lane's scenery, on a high street or not. */
const scenery = (street: boolean) => buildScenery(fp, 'park', SETTINGS.park, width, plots, street);

describe("the high street's scenery", () => {
  // the sign is printed on a canvas, which Node has not got: one that draws nothing will do
  beforeAll(() => {
    Object.assign(globalThis, { document: { createElement: canvas } });
  });

  it('is built only for a center on a high street', () => {
    expect(scenery(true).getObjectByName('high-street')).toBeDefined();
    expect(scenery(false).getObjectByName('high-street')).toBeUndefined();
  });
});
