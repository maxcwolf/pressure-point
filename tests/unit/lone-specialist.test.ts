import { describe, expect, it } from 'vitest';

import { createContext } from '../../src/core/sim/context';
import { leftForSpecialist, pickStation } from '../../src/core/sim/stations';
import { must } from '../../src/core/util';
import { addConsult, addRecovery, addStaffRoom, buildRoom, freshSim, hire, run } from './helpers';

/** Reception, a Consultation Room and a Massage Suite with two tables, a therapist at each. */
function twoTables(seed = 1) {
  const sim = freshSim(seed);
  sim.s.money = 100_000;
  sim.s.stars = 1;
  sim.placeItem('reception_desk', 14, 13, 0);
  addConsult(sim);
  buildRoom(sim, 'massage', { x: 11, y: 5, w: 6, h: 4 }, { x: 12, y: 8, dx: 0, dy: 1 }, [
    ['massage_table', 12, 5],
    ['massage_table', 15, 5],
    ['oil_trolley', 13, 5],
  ]);
  addRecovery(sim);
  addStaffRoom(sim);
  hire(sim, 'receptionist');
  hire(sim, 'consultant');
  const specialist = hire(sim, 'therapist');
  const untrained = hire(sim, 'therapist');
  specialist.quals = ['swedish', 'deep'];
  untrained.quals = ['swedish'];
  return { sim, s: sim.s, specialist, untrained };
}

describe('a lone specialist', () => {
  it('sees every guest who needs their treatment, however long their line', () => {
    const { sim, s, specialist, untrained } = twoTables();
    const seenBy = new Map<number, number>();
    for (let i = 0; i < 900; i++) {
      for (const g of s.guests) {
        if (g.diagnosis === 0) g.condition = 'knotted';
        // patient and holding up, so the line grows long rather than walking out
        g.patience = 100;
        g.health = 100;
      }
      run(sim, 1);
      for (const it of s.items) {
        const g = s.guests.find((q) => q.id === it.serving && q.state === 'served');
        if (it.type === 'massage_table' && g) seenBy.set(g.id, it.staffId);
      }
    }
    const seers = [...seenBy.values()];
    // enough guests for the line to have grown long, all of them seen by the one trained in Deep Tissue
    expect(seers.length).toBeGreaterThan(6);
    expect(seers.every((id) => id === specialist.id)).toBe(true);
    expect(seers).not.toContain(untrained.id);
  });

  it('is waited for only while they are about, and not by a guest the player placed', () => {
    const { sim, s, specialist, untrained } = twoTables();
    run(sim, 200);
    const ctx = createContext(s);
    const g = must(s.guests[0], 'a guest');
    g.condition = 'knotted';
    g.placed = false;
    expect(leftForSpecialist(ctx, untrained, g)).toBe(true);
    expect(leftForSpecialist(ctx, specialist, g)).toBe(false);
    // a guest the player put in the line is seen there
    g.placed = true;
    expect(leftForSpecialist(ctx, untrained, g)).toBe(false);
    g.placed = false;
    // away on a course, the specialist is not waited for
    specialist.state = 'training';
    expect(leftForSpecialist(ctx, untrained, g)).toBe(false);
    // and with nobody trained, the untrained one is better than nobody
    specialist.state = 'idle';
    specialist.quals = ['swedish'];
    expect(leftForSpecialist(ctx, untrained, g)).toBe(false);
    g.goal = 'treat';
    expect(pickStation(ctx, g)).not.toBeNull();
  });
});
