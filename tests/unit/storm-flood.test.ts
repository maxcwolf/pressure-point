// The storm at The Boardwalk floods a restroom as it starts, unless the center boarded up and sandbagged: water on the
// floor, the room's lamp red and its toilets out of action, until a Caretaker has mopped every puddle up.
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { FLOOD_PUDDLES, MISHAP_NOTICE_DAYS, type MishapId, MISHAPS } from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { floodRestroom, floodTiles, newMishap, updateMishaps } from '../../src/core/sim/mishaps';
import { buildPuddle, rippleFlood } from '../../src/render/models/puddle';
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
    expect(staffStatus(caretaker, sim)).toContain('flooded restroom');
    runUntil(sim, () => !sim.world.flooded(restroom), 300);
    const toilet = s.items.find((i) => i.type === 'toilet')!;
    expect(sim.world.usable(toilet)).toBe(true);
    expect(lampStates(sim).get(restroom.id)).toBe('working');
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
  /** The radius of each pool in a puddle. */
  const radii = (g: THREE.Group) =>
    g.children.map((m) => ((m as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters.radiusTop);

  it('lies in wider pools than a puddle of kombucha, and is blue', () => {
    for (let id = 1; id < 20; id++)
      expect(Math.min(...radii(buildPuddle(id, true)))).toBeGreaterThan(Math.max(...radii(buildPuddle(id))));
    const pool = buildPuddle(1, true).children[0] as THREE.Mesh;
    const color = (pool.material as THREE.MeshStandardMaterial).color;
    expect(color.b).toBeGreaterThan(color.r);
  });

  it('stays inside its tile, so none shows through a wall beside it, however far it has swollen', () => {
    for (let id = 1; id < 50; id++) {
      const g = buildPuddle(id, true);
      for (const t of [0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4]) {
        rippleFlood(g, t, id);
        for (const pool of g.children as THREE.Mesh[]) {
          const r = (pool.geometry as THREE.CylinderGeometry).parameters.radiusTop * pool.scale.x;
          expect(Math.max(Math.abs(pool.position.x), Math.abs(pool.position.z)) + r).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it('moves: a glow that wobbles and pools that swell a little, with no part more, starting still', () => {
    const g = buildPuddle(3, true);
    const pool = g.children[0] as THREE.Mesh;
    const water = pool.material as THREE.MeshStandardMaterial;
    expect(water.emissiveIntensity).toBe(0);
    // one material for the whole puddle, its own
    expect(g.children.every((m) => (m as THREE.Mesh).material === water)).toBe(true);
    expect(buildPuddle(4, true).children[0]).not.toHaveProperty('material', water);
    const glows = new Set<number>();
    const sizes = new Set<number>();
    for (let t = 0; t < 5; t += 0.25) {
      rippleFlood(g, t, 3);
      expect(water.emissiveIntensity).toBeGreaterThanOrEqual(0.05);
      expect(water.emissiveIntensity).toBeLessThanOrEqual(0.15);
      expect(Math.abs(pool.scale.x - 1)).toBeLessThanOrEqual(0.03);
      glows.add(Math.round(water.emissiveIntensity * 100));
      sizes.add(Math.round(pool.scale.x * 1000));
    }
    expect(glows.size).toBeGreaterThan(3);
    expect(sizes.size).toBeGreaterThan(3);
    expect(g.children).toHaveLength(4);
  });
});
