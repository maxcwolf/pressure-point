import { describe, expect, it } from 'vitest';

import { type ConditionId, conditionOf, DAY_SECONDS, MODALITIES, STONE_USE } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import type { Sim } from '../../src/core/sim/sim';
import { graduate } from '../../src/core/sim/training';
import { addRecovery, addTraining, hire, openCenter, run, runUntil } from './helpers';

/** Play for a while, turning every arriving guest into one condition. */
function playWithCondition(sim: Sim, condition: ConditionId, seconds: number) {
  for (let i = 0; i < seconds; i++) {
    for (const g of sim.s.guests) if (g.diagnosis === 0) g.condition = condition;
    // fresh linens throughout, so only the treatment's own odds count
    for (const it of sim.s.items) it.dirt = 0;
    run(sim, 1);
  }
}

describe('unlocking modalities', () => {
  it('only sends guests whose condition can be treated at the current star level', () => {
    const { sim, s } = openCenter(1);
    const seen = new Set<string>();
    /** Play for a while, noting the modality each guest needs. */
    const watch = (seconds: number) => {
      for (let i = 0; i < seconds; i++) {
        // hold the healed count down so the next star (and its unlocks) cannot be earned mid-test
        s.stats.healed = Math.min(s.stats.healed, 5);
        run(sim, 1);
        for (const g of s.guests) seen.add(conditionOf(g.condition).modality);
      }
    };
    watch(400);
    expect([...seen]).toEqual(['swedish']);
    s.stars = 1;
    watch(900);
    expect(seen.has('deep') || seen.has('sports')).toBe(true);
    expect(seen.has('stone')).toBe(false);
    expect(seen.has('cranio')).toBe(false);
  });

  it('reports why a table cannot deliver a modality', () => {
    const { sim, therapist } = openCenter(1);
    const table = sim.s.items.find((i) => i.type === 'massage_table')!;
    therapist.quals = ['swedish'];
    expect(sim.deliveryProblem(table, therapist, MODALITIES.swedish)).toBe('');
    expect(sim.deliveryProblem(table, therapist, MODALITIES.deep)).toBe('unqualified');
    therapist.quals = ['swedish', 'sports', 'stone'];
    expect(sim.deliveryProblem(table, therapist, MODALITIES.sports)).toBe('no-equipment');
    sim.placeItem('stretch_rack', 14, 7, 0);
    expect(sim.deliveryProblem(table, therapist, MODALITIES.sports)).toBe('');
    const warmer = sim.placeItem('stone_warmer', 14, 6, 0)!;
    expect(sim.deliveryProblem(table, therapist, MODALITIES.stone)).toBe('');
    warmer.water = STONE_USE - 1;
    expect(sim.deliveryProblem(table, therapist, MODALITIES.stone)).toBe('cold');
    // equipment in a different suite does not count
    sim.moveItem(warmer.id, 14, 6, 0);
    expect(sim.deliveryProblem(table, undefined, MODALITIES.cranio)).toBe('');
  });

  it('makes unqualified treatment mostly fail and qualified treatment mostly work', () => {
    /** Play a center where every guest has knots and return its stats. */
    const outcome = (qualified: boolean) => {
      const { sim, s, therapist } = openCenter(11);
      s.stars = 1;
      therapist.skill = 3;
      therapist.quals = qualified ? ['swedish', 'deep'] : ['swedish'];
      // somewhere to rest after Deep Tissue, so only the therapist's training counts
      addRecovery(sim);
      playWithCondition(sim, 'knotted', 1500);
      return s.stats;
    };
    const bad = outcome(false);
    const good = outcome(true);
    expect(bad.healed + bad.failed).toBeGreaterThan(8);
    expect(bad.failed).toBeGreaterThan(bad.healed);
    expect(good.healed).toBeGreaterThan(good.failed * 2);
  });

  it('uses up the heat in a stone warmer, which a caretaker restores', () => {
    const { sim, s, therapist } = openCenter(12);
    s.stars = 2;
    therapist.quals = ['swedish', 'stone'];
    const warmer = sim.placeItem('stone_warmer', 14, 6, 0)!;
    const start = warmer.water;
    runUntil(
      sim,
      () => {
        for (const g of s.guests) if (g.diagnosis === 0) g.condition = 'steam';
        return s.stats.healed + s.stats.failed >= 2;
      },
      900,
    );
    expect(warmer.water).toBeLessThan(start - STONE_USE);
    warmer.water = 20;
    hire(sim, 'caretaker');
    runUntil(sim, () => warmer.water > 90, 300);
  });
});

describe('training', () => {
  it('needs a Training Room, a free desk and the money', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 1;
    const deep = sim.courses(therapist).find((c) => c.id === 'deep')!;
    expect(sim.trainBlocker(therapist, deep)).toMatch(/Training Room/);
    expect(sim.train(therapist.id, 'deep')).toBe(false);
    addTraining(sim);
    expect(sim.trainBlocker(therapist, deep)).toBe('');
    s.money = 100;
    expect(sim.trainBlocker(therapist, deep)).toMatch(/money/);
    s.money = 50_000;
    const other = hire(sim, 'therapist');
    expect(sim.train(other.id, 'deep')).toBe(true);
    expect(sim.trainBlocker(therapist, deep)).toMatch(/Study Desk/);
  });

  it('offers only unlocked modalities the therapist lacks, then the general courses for their role', () => {
    const { sim, s, therapist, consultant, receptionist } = openCenter(1);
    therapist.quals = ['swedish'];
    therapist.general = [];
    therapist.skill = 2;
    expect(sim.courses(therapist).map((c) => c.id)).toEqual(['bedside', 'motivation', 'stamina']);
    s.stars = 2;
    expect(sim.courses(therapist).map((c) => c.id)).toEqual([
      'deep',
      'sports',
      'stone',
      'cranio',
      'bedside',
      'motivation',
      'stamina',
    ]);
    therapist.quals.push('deep');
    therapist.general.push('stamina');
    expect(sim.courses(therapist).map((c) => c.id)).not.toContain('deep');
    expect(sim.courses(therapist).map((c) => c.id)).not.toContain('stamina');
    // and a course only some roles can take
    expect(sim.courses(receptionist).map((c) => c.id)).toContain('service');
    expect(sim.courses(consultant).map((c) => c.id)).not.toContain('service');
  });

  it('charges the fee, takes the stated time and grants the qualification', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 1;
    therapist.quals = ['swedish'];
    addTraining(sim);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    const before = s.money;
    expect(sim.train(therapist.id, 'deep')).toBe(true);
    expect(s.money).toBe(before - MODALITIES.deep.trainCost);
    expect(s.ledger.training).toBe(MODALITIES.deep.trainCost);
    runUntil(sim, () => therapist.state === 'training', 60);
    const started = s.day;
    runUntil(sim, () => therapist.training === null, 200);
    expect(therapist.quals).toContain('deep');
    expect((s.day - started) * DAY_SECONDS).toBeCloseTo(MODALITIES.deep.trainDays * DAY_SECONDS, 0);
    // they are worth more now, and will come asking
    expect(sim.fairPay(therapist)).toBeGreaterThan(therapist.salary);
  });

  it('still finishes a skill course begun before ranks, as a rank up', () => {
    const { sim, consultant } = openCenter(1);
    addTraining(sim);
    consultant.skill = 2;
    consultant.training = { course: 'skill', progress: 1, seconds: 30, cost: 1000 };
    graduate(createContext(sim.s), consultant);
    expect(consultant.training).toBeNull();
    expect(consultant.skill).toBe(3);
  });

  it('refunds the fee if the desk is taken away mid-course', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 1;
    therapist.quals = ['swedish'];
    const room = addTraining(sim);
    const before = s.money;
    sim.train(therapist.id, 'deep');
    runUntil(sim, () => therapist.state === 'training', 120);
    sim.removeRoom(room.id, 0);
    expect(therapist.training).toBeNull();
    expect(therapist.quals).not.toContain('deep');
    expect(s.money).toBe(before);
  });
});
