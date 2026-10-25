// The storm at The Boardwalk floods a restroom as it starts, unless the center boarded up and sandbagged: water on the
// floor, the room's lamp red and its toilets out of action, until a Caretaker has mopped every puddle up.
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { FLOOD_PUDDLES, MISHAP_NOTICE_DAYS, type MishapId, MISHAPS, PUDDLE_SLOW } from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { spawnGuest } from '../../src/core/sim/guests';
import { floodRestroom, floodTiles, newMishap, updateMishaps } from '../../src/core/sim/mishaps';
import { puddleSlow } from '../../src/core/sim/novelties';
import { buildPuddle, floodParts, rippleFlood } from '../../src/render/models/puddle';
import { lampStates } from '../../src/render/room-lamp';
import { staffStatus } from '../../src/ui/lib/status';
import { addRestroom, hire, openCenter, run, runUntil, toasts } from './helpers';

/** An open center with mishaps on, a furnished restroom, and a context on it. */
function withRestroom(seed = 1) {
  const c = openCenter(seed);
  c.s.mishapsOn = true;
  const restroom = addRestroom(c.sim);
  return { ...c, restroom, ctx: createContext(c.s) };
}

/** A mishap of this kind announced long enough ago that it is due to start today. */
const dueToday = (day: number, kind: MishapId) => newMishap(day - MISHAP_NOTICE_DAYS, kind);

/** The puddles of flood water lying about. */
const water = (c: ReturnType<typeof withRestroom>) => c.s.litter.filter((l) => l.flood);

describe('a storm', () => {
  it('floods a restroom as it starts: puddles on its open floor, its toilet out of action and its lamp red', () => {
    const c = withRestroom();
    const { sim, s, ctx, restroom } = c;
    const toilet = s.items.find((i) => i.type === 'toilet')!;
    expect(sim.world.usable(toilet)).toBe(true);
    expect(lampStates(sim).get(restroom.id)).toBe('working');
    s.mishap = dueToday(s.day, 'storm');
    drainEvents(ctx);
    updateMishaps(ctx);
    expect(water(c)).toHaveLength(FLOOD_PUDDLES);
    for (const l of water(c)) {
      expect(l.flood).toBe(restroom.id);
      expect(sim.world.roomAt(l.x, l.y)).toBe(restroom);
      expect(sim.world.walkable(l.x, l.y)).toBe(true);
    }
    expect(new Set(water(c).map((l) => `${l.x},${l.y}`)).size, 'one to a tile').toBe(FLOOD_PUDDLES);
    expect(sim.world.flooded(restroom)).toBe(true);
    expect(sim.world.usable(toilet)).toBe(false);
    expect(lampStates(sim).get(restroom.id)).toBe('broken');
    const events = drainEvents(ctx);
    expect(toasts(events).join(' ')).toContain('flooded a restroom');
    // the toast takes the player to the room
    expect(events).toContainEqual(expect.objectContaining({ type: 'toast', about: { kind: 'room', id: restroom.id } }));
  });

  it('floods nothing once the center has boarded up and sandbagged, or a ward holds', () => {
    const c = withRestroom();
    c.s.mishap = { ...dueToday(c.s.day, 'storm'), prepared: true };
    updateMishaps(c.ctx);
    expect(water(c)).toEqual([]);
    const warded = withRestroom(2);
    // a ward that is done holds most of the time; whether it held is what prepared says once it starts
    warded.s.mishap = { ...dueToday(warded.s.day, 'storm'), ward: 'done' };
    updateMishaps(warded.ctx);
    expect(water(warded).length).toBe(warded.s.mishap.prepared ? 0 : FLOOD_PUDDLES);
  });

  it('floods one restroom at a time, and none that is already under water', () => {
    const c = withRestroom();
    expect(floodRestroom(c.ctx, MISHAPS.storm)).toBe(c.restroom);
    expect(floodRestroom(c.ctx, MISHAPS.storm), 'already flooded').toBeUndefined();
    expect(water(c)).toHaveLength(FLOOD_PUDDLES);
  });

  it('floods nothing, and draws nothing more, with no restroom to flood', () => {
    const c = openCenter(1);
    const ctx = createContext(c.s);
    const rng = c.s.rng;
    expect(floodRestroom(ctx, MISHAPS.storm)).toBeUndefined();
    expect(c.s.rng).toBe(rng);
    expect(c.s.litter).toEqual([]);
  });

  it('spreads its puddles over the open floor, never where something stands', () => {
    const { sim, ctx, restroom } = withRestroom();
    const tiles = floodTiles(ctx, restroom);
    expect(tiles).toHaveLength(FLOOD_PUDDLES);
    for (const [x, y] of tiles) expect(sim.world.itemAt(x, y)).toBeUndefined();
  });

  it('leaves the restroom flooded after it has passed, until it is mopped out', () => {
    const c = withRestroom();
    c.s.mishap = dueToday(c.s.day, 'storm');
    updateMishaps(c.ctx);
    c.s.day = c.s.mishap.ends;
    updateMishaps(c.ctx);
    expect(c.s.mishap).toBeNull();
    expect(c.sim.world.flooded(c.restroom)).toBe(true);
  });

  it('says what it will do, and what preparing for it saves', () => {
    expect(MISHAPS.storm.floods).toBe(true);
    expect(MISHAPS.storm.harm).toContain('floods a restroom');
    expect(MISHAPS.storm.prepare.effect).toContain('flooded');
    // no other mishap floods anything
    expect(Object.values(MISHAPS).filter((m) => m.floods)).toEqual([MISHAPS.storm]);
  });
});

describe('a flooded restroom', () => {
  it('is mopped out by a Caretaker, ahead of ordinary litter, and works again', () => {
    const c = withRestroom();
    const { sim, s, restroom } = c;
    floodRestroom(c.ctx, MISHAPS.storm);
    // a wrapper right where the Caretaker starts, and the flood further off
    const caretaker = hire(sim, 'caretaker');
    run(sim, 2);
    s.litter.push({ id: s.nextId++, x: caretaker.tx, y: caretaker.ty + 1, claimedBy: 0 });
    runUntil(sim, () => caretaker.job?.kind === 'litter', 60);
    expect(s.litter.find((l) => l.id === caretaker.job?.id)?.flood).toBe(restroom.id);
    expect(staffStatus(caretaker, sim)).toContain('the flooded Restroom');
    runUntil(sim, () => !sim.world.flooded(restroom), 300);
    const toilet = s.items.find((i) => i.type === 'toilet')!;
    expect(sim.world.usable(toilet)).toBe(true);
    expect(lampStates(sim).get(restroom.id)).toBe('working');
  });

  it('slows a guest who wades through it, who minds and says so', () => {
    const c = withRestroom();
    floodRestroom(c.ctx, MISHAPS.storm);
    expect(toasts(drainEvents(c.ctx)).join(' ')).toContain('and the guests will mind');
    const g = spawnGuest(c.ctx)!;
    const [puddle] = water(c);
    if (!puddle) throw new Error('no flood water');
    Object.assign(g, { tx: puddle.x, ty: puddle.y, path: [[puddle.x + 0.5, puddle.y + 0.5, 0]] });
    expect(puddleSlow(c.ctx, g)).toBe(PUDDLE_SLOW);
    expect(g.feelings).toContain('wet-feet');
    expect(g.feelings).not.toContain('puddle');
    expect(g.bubble).toBe('bubble-sweaty');
  });

  it('leaves a guest who needs the toilet, with nowhere else to go, minding that too', () => {
    const c = withRestroom();
    const { sim, s } = c;
    // nobody to see them, so they wait
    sim.fire(c.consultant.id);
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    floodRestroom(c.ctx, MISHAPS.storm);
    const g = s.guests.find((x) => x.state === 'waiting')!;
    g.bladder = 90;
    runUntil(sim, () => g.feelings.includes('no-restroom'), 20);
    expect(g.feelings).toContain('no-restroom');
    // with no restroom at all, nothing is said of a flood
    const dry = openCenter(2);
    dry.sim.fire(dry.consultant.id);
    runUntil(dry.sim, () => dry.s.guests.some((x) => x.state === 'waiting'), 300);
    const h = dry.s.guests.find((x) => x.state === 'waiting')!;
    h.bladder = 90;
    run(dry.sim, 10);
    expect(h.feelings).not.toContain('no-restroom');
  });

  it('has the advisor ask for a Caretaker when there is none to mop it out', () => {
    const c = withRestroom();
    floodRestroom(c.ctx, MISHAPS.storm);
    expect(advice(c.ctx)).toContain('Hire a Caretaker to mop it out');
    hire(c.sim, 'caretaker');
    expect(advice(c.ctx)).toContain('until a Caretaker mops it out');
  });
});

describe('flood water, drawn', () => {
  /** The pools of a puddle: of flood water, those that are not its rings; of anything else, every part. */
  const poolsOf = (g: THREE.Group) => floodParts(g).pools ?? (g.children as THREE.Mesh[]);
  /** The radius of each pool in a puddle. */
  const radii = (g: THREE.Group) => poolsOf(g).map((m) => (m.geometry as THREE.CylinderGeometry).parameters.radiusTop);

  it('lies in wider pools than a puddle of kombucha, and is blue', () => {
    for (let id = 1; id < 20; id++)
      expect(Math.min(...radii(buildPuddle(id, true)))).toBeGreaterThan(Math.max(...radii(buildPuddle(id))));
    const pool = poolsOf(buildPuddle(1, true))[0]!;
    const color = (pool.material as THREE.MeshStandardMaterial).color;
    expect(color.b).toBeGreaterThan(color.r);
    // a light cyan, not a dark blue that reads as a rug
    expect(color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.45);
  });

  it('stays inside its tile, so none shows through a wall beside it, however far it has swollen', () => {
    for (let id = 1; id < 50; id++) {
      const g = buildPuddle(id, true);
      for (const t of [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4]) {
        rippleFlood(g, t, id);
        for (const pool of poolsOf(g)) {
          const r = (pool.geometry as THREE.CylinderGeometry).parameters.radiusTop * pool.scale.x;
          expect(Math.max(Math.abs(pool.position.x), Math.abs(pool.position.z)) + r).toBeLessThanOrEqual(0.5);
        }
        for (const ring of floodParts(g).rings ?? []) expect(ring.scale.x).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('moves: a glow that wobbles, pools that swell a little and rings that spread, with no part more, starting still', () => {
    const g = buildPuddle(3, true);
    const { pools = [], rings = [] } = floodParts(g);
    const pool = pools[0]!;
    const water = pool.material as THREE.MeshStandardMaterial;
    expect(water.emissiveIntensity).toBe(0);
    expect(rings.every((r) => !r.visible)).toBe(true);
    // one material for the whole puddle, its own
    expect(pools.every((m) => m.material === water)).toBe(true);
    expect(poolsOf(buildPuddle(4, true))[0]).not.toHaveProperty('material', water);
    const glows = new Set<number>();
    const sizes = new Set<number>();
    const spread = new Set<number>();
    for (let t = 0; t < 5; t += 0.25) {
      rippleFlood(g, t, 3);
      expect(water.emissiveIntensity).toBeGreaterThanOrEqual(0.2);
      expect(water.emissiveIntensity).toBeLessThanOrEqual(0.4);
      expect(Math.abs(pool.scale.x - 1)).toBeLessThanOrEqual(0.03);
      glows.add(Math.round(water.emissiveIntensity * 100));
      sizes.add(Math.round(pool.scale.x * 1000));
      spread.add(Math.round(rings[0]!.scale.x * 100));
    }
    expect(glows.size).toBeGreaterThan(3);
    expect(sizes.size).toBeGreaterThan(3);
    expect(spread.size).toBeGreaterThan(5);
    expect(g.children).toHaveLength(pools.length + rings.length);
  });
});
