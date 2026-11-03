// Two or more therapists sharing a Massage Suite: a line at its tables is always seen to.

import { describe, expect, it, vi } from 'vitest';

import type { ItemType } from '../../src/core/data';
import { spawnGuest } from '../../src/core/sim/arrivals';
import { createContext } from '../../src/core/sim/context';
import { goWait } from '../../src/core/sim/lines';
import type { Sim } from '../../src/core/sim/sim';
import type { Item, Staff } from '../../src/core/state/types';
import { must } from '../../src/core/util';
import { addConsult, addRecovery, addStaffRoom, buildRoom, freshSim, hire, run, runUntil } from './helpers';

/** Reception, a Consultation Room and a Massage Suite with this many tables. */
function suite(tables: number, seed = 1) {
  const sim = freshSim(seed);
  sim.s.money = 100_000;
  sim.s.stars = 1;
  sim.placeItem('reception_desk', 14, 13, 0);
  addConsult(sim);
  const second: [ItemType, number, number][] = tables > 1 ? [['massage_table', 15, 5]] : [];
  buildRoom(sim, 'massage', { x: 11, y: 5, w: 6, h: 4 }, { x: 12, y: 8, dx: 0, dy: 1 }, [
    ['massage_table', 12, 5],
    ...second,
    ['oil_trolley', 13, 5],
  ]);
  addRecovery(sim);
  addStaffRoom(sim);
  hire(sim, 'receptionist');
  hire(sim, 'consultant');
  return sim;
}

/** The suite's tables. */
const tablesOf = (sim: Sim): Item[] => sim.s.items.filter((it) => it.type === 'massage_table');

/** Everyone who comes needs Deep Tissue, and is patient and holding up, so a line grows rather than walking out. */
function deepTissueOnly(sim: Sim) {
  for (const g of sim.s.guests) {
    if (g.diagnosis === 0) g.condition = 'knotted';
    g.patience = 100;
    g.health = 100;
  }
}

/** Run the center for some seconds, counting the treatments started at the suite's tables and who gave them. */
function treatments(sim: Sim, seconds: number) {
  const seen = new Map<number, number>();
  for (let i = 0; i < seconds; i++) {
    deepTissueOnly(sim);
    run(sim, 1);
    for (const it of tablesOf(sim)) {
      const g = sim.s.guests.find((q) => q.id === it.serving && q.state === 'served');
      if (g) seen.set(g.id, it.staffId);
    }
  }
  return [...seen.values()];
}

describe('two therapists at one table', () => {
  it('see to a line that needs the one trained in it, though the other took the table first', () => {
    const sim = suite(1);
    const untrained: Staff = hire(sim, 'therapist');
    untrained.quals = ['swedish'];
    runUntil(sim, () => untrained.state === 'atPost', 120);
    const specialist: Staff = hire(sim, 'therapist');
    specialist.quals = ['swedish', 'deep'];
    const seers = treatments(sim, 600);
    // the line used to wait for good: the untrained one held the table and passed over everyone in it
    expect(seers.length).toBeGreaterThan(4);
    expect(seers.filter((id) => id === specialist.id).length).toBeGreaterThan(4);
    expect(seers).not.toContain(untrained.id);
  });
});

describe('three therapists at two tables', () => {
  it('see to lines that need the one trained in them, though both tables were taken by the others first', () => {
    const sim = suite(2);
    const first = hire(sim, 'therapist');
    const second = hire(sim, 'therapist');
    first.quals = ['swedish'];
    second.quals = ['swedish'];
    runUntil(sim, () => first.state === 'atPost' && second.state === 'atPost', 120);
    // two guests waiting at each table who need Deep Tissue, which neither of them knows
    const ctx = createContext(sim.s);
    for (const it of tablesOf(sim))
      for (let i = 0; i < 2; i++) {
        const g = must(spawnGuest(ctx, 'knotted'), 'a guest');
        Object.assign(g, { goal: 'treat', diagnosis: 1, station: it.id });
        it.queue.push(g.id);
        goWait(ctx, g);
      }
    const specialist = hire(sim, 'therapist');
    specialist.quals = ['swedish', 'deep'];
    const seers = treatments(sim, 120);
    expect(seers.filter((id) => id === specialist.id).length).toBeGreaterThanOrEqual(2);
    expect(seers).not.toContain(first.id);
    expect(seers).not.toContain(second.id);
  });
});

describe('a therapist trained in what a line needs, who cannot get to its table', () => {
  it('leaves the one posted there at it, rather than stand them down for nobody', () => {
    const sim = suite(1);
    const untrained = hire(sim, 'therapist');
    untrained.quals = ['swedish'];
    runUntil(sim, () => untrained.state === 'atPost', 120);
    const specialist = hire(sim, 'therapist');
    specialist.quals = ['swedish', 'deep'];
    runUntil(sim, () => specialist.state === 'idle' || specialist.state === 'wander', 120);
    const table = must(tablesOf(sim)[0], 'a table');
    const ctx = createContext(sim.s);
    const g = must(spawnGuest(ctx, 'knotted'), 'a guest');
    Object.assign(g, { goal: 'treat', diagnosis: 1, station: table.id });
    table.queue.push(g.id);
    goWait(ctx, g);
    // no way anywhere from where the specialist stands
    const find = sim.world.findPath.bind(sim.world);
    vi.spyOn(sim.world, 'findPath').mockImplementation((sx, sy, tx, ty) =>
      sx === specialist.tx && sy === specialist.ty ? null : find(sx, sy, tx, ty),
    );
    for (let i = 0; i < 100; i++) {
      deepTissueOnly(sim);
      sim.tick(0.1);
      expect(table.staffId).toBe(untrained.id);
      expect(untrained.state).toBe('atPost');
    }
  });
});
