// Class-goers find their way to a Qi Gong Studio built on land apart from the main building.
import { describe, expect, it } from 'vitest';

import { DAY_SECONDS } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { streetEnds } from '../../src/core/sim/chars';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import { hire, runUntil } from './helpers';

/** The Orchard Estate with its orangery bought and built on, and a Qi Gong Studio with an Instructor in it. */
function orangeryStudio() {
  setSeed(1);
  const s = newGame('orchard');
  s.challengesOn = false;
  s.rivalOn = false;
  s.mishapsOn = false;
  s.nextApplicant = 1e9;
  s.money = 500_000;
  const sim = new Sim(s);
  expect(sim.buyPlot('orangery')).toBe(true);
  runUntil(sim, () => sim.landOffers().find((o) => o.def.id === 'orangery')?.state === 'owned', 60 * DAY_SECONDS);
  const room = sim.createRoom('qigong', { x: 32, y: 5, w: 6, h: 6 }, { x: 34, y: 10, dx: 0, dy: 1 });
  let mat = false;
  let spots = 0;
  for (let y = room.y; y < room.y + room.h && spots < 4; y++)
    for (let x = room.x; x < room.x + room.w && spots < 4; x++) {
      const t = mat ? 'practice_spot' : 'instructor_mat';
      if (!sim.placeItem(t, x, y, 0, { free: true, roomId: room.id })) continue;
      if (mat) spots++;
      mat = true;
    }
  sim.finishRoom(room);
  hire(sim, 'instructor');
  return { sim, s, ctx: (sim as unknown as { ctx: SimContext }).ctx };
}

describe('a Qi Gong Studio on land apart', () => {
  it('has its class-goers come along the pavement from the nearer end and go straight in, in time for the class', () => {
    const { sim, s, ctx } = orangeryStudio();
    const fp = ctx.world.building;
    const front = fp.entrances[0];
    const own = fp.entrances[1];
    expect(own?.x).toBeGreaterThan(front?.x ?? 0);
    const g = spawnGuest(ctx, undefined, false, Math.floor(s.day) + 2);
    if (!g) throw new Error('no class-goer');
    // from the end of the pavement nearer the orangery's own way in, which lies past it, at the edge of the lot
    const end = streetEnds(fp, ctx.world.w)[1];
    expect(end).toBe(ctx.world.w - 1);
    expect(end).toBeGreaterThan(own?.x ?? Infinity);
    expect(Math.abs(g.x - end)).toBeLessThan(1.5);
    const start = s.day;
    let byFrontDoor = false;
    runUntil(
      sim,
      () => {
        if (front && Math.abs(g.x - front.x) <= 1.5 && Math.abs(g.y - front.y) <= 1.5) byFrontDoor = true;
        return g.state === 'waiting' || g.state === 'served';
      },
      6 * DAY_SECONDS,
    );
    // never by way of the main building's front door, and there before the day of their class: from the edge of the
    // lot, 13 tiles past the orangery's door, about a day and a half
    expect(byFrontDoor).toBe(false);
    expect(s.day - start).toBeLessThan(1.75);
    expect(s.day).toBeLessThan(Math.floor(start) + 2);
    const spot = ctx.world.item(g.station);
    expect(spot?.type).toBe('practice_spot');
  });
});
