// A room that fits nowhere in the building at its smallest: the check behind the hint, and where the hint says the
// room for it would come from.
import { describe, expect, it } from 'vitest';

import { noFitHint } from '../../src/app/tools/hints';
import { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import { freshSim } from './helpers';

/** Willow Lane as a new game, with the money for anything. */
function willow(): Sim {
  const s = newGame('willow');
  s.money = 1e6;
  return new Sim(s);
}

/** Stand a plant on every tile of the floor that will take one, so that only the ways through are left clear. */
function plugFloor(sim: Sim) {
  const b = sim.world.building.bounds;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) sim.placeItem('plant', x, y, 0);
}

describe('a room that fits nowhere', () => {
  it('is told from the floor at its smallest, and the hint names the star the next plot comes up at', () => {
    const sim = willow();
    expect(sim.world.roomFitsAnywhere('massage')).toBe(true);
    expect(sim.world.roomFitsAnywhere('kneader')).toBe(true);
    plugFloor(sim);
    expect(sim.s.items.length).toBeGreaterThan(100);
    expect(sim.world.roomFitsAnywhere('massage')).toBe(false);
    expect(sim.world.roomFitsAnywhere('kneader')).toBe(false);
    expect(noFitHint('massage', sim.landOffers())).toBe(
      'Nowhere in the building fits a Massage Suite (at least 3×3). The empty unit next door comes up for sale at star 1.',
    );
    expect(noFitHint('kneader', [])).toBe(
      'Nowhere in the building fits a Kneadmaster Suite (at least 4×4). Every plot is yours: move a room, make one smaller or knock one down to make space.',
    );
  });

  it('points to the cheapest plot for sale, or the one being built on', () => {
    const sim = freshSim();
    sim.s.money = 1e6;
    expect(noFitHint('massage', sim.landOffers())).toBe(
      'Nowhere in the building fits a Massage Suite (at least 3×3). Expand, beside Rooms, sells the east wing for $24,000.',
    );
    expect(
      noFitHint(
        'massage',
        sim.landOffers().filter((o) => o.state === 'locked'),
      ),
    ).toMatch(/\. The back gallery comes up for sale at star 1\.$/);
    expect(sim.buyPlot('east-wing')).toBe(true);
    expect(noFitHint('massage', sim.landOffers())).toMatch(
      /\. The builders are still at work on the east wing, \d+ days to go\.$/,
    );
  });
});
