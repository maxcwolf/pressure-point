// Reiki: the third discipline, available from two stars, switched on and off in Settings.
import { beforeEach, describe, expect, it } from 'vitest';

import { type ConditionId, conditionOf, MODALITIES, ROOMS } from '../../src/core/data';
import type { Sim } from '../../src/core/sim/sim';
import { disciplineOn, newGame } from '../../src/core/state/game';
import { loadDisciplinePrefs, saveDisciplinePref } from '../../src/storage/settings';
import {
  addAcupuncture,
  addPostureLab,
  addReiki,
  addStaffRoom,
  addTraining,
  hire,
  inconsistencies,
  LAYOUT,
  openCenter,
  run,
  runUntil,
} from './helpers';
import { treatmentCourses } from './helpers';

/** The discipline that treats a condition. */
const disciplineOf = (condition: ConditionId) => MODALITIES[conditionOf(condition).modality].discipline;

/** Play for a while and report which disciplines' guests turned up. */
function watchArrivals(sim: Sim, seconds: number) {
  const seen = new Set<string>();
  for (let i = 0; i < seconds; i++) {
    // hold the healed count down so no further star is earned mid-test
    sim.s.stats.healed = Math.min(sim.s.stats.healed, 30);
    run(sim, 1);
    for (const g of sim.s.guests) seen.add(disciplineOf(g.condition));
  }
  return seen;
}

describe('offering reiki', () => {
  it('brings no reiki guests until a studio has been built', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    expect(sim.offered('reiki')).toBe(false);
    expect(watchArrivals(sim, 600).has('reiki')).toBe(false);
    addReiki(sim);
    hire(sim, 'practitioner');
    expect(sim.offered('reiki')).toBe(true);
    expect(watchArrivals(sim, 900).has('reiki')).toBe(true);
  });

  it('is locked until the second star, with chakra balancing and distance reiki at the third', () => {
    const { sim, s } = openCenter(1);
    expect(ROOMS.reiki.unlock).toBe(2);
    s.stars = 1;
    expect(sim.unlocked('usui')).toBe(false);
    s.stars = 2;
    expect(sim.unlocked('usui')).toBe(true);
    expect(sim.unlocked('crystal')).toBe(true);
    expect(sim.unlocked('distance')).toBe(false);
    expect(sim.unlocked('chakra')).toBe(false);
    s.stars = 3;
    expect(sim.unlocked('distance')).toBe(true);
    expect(sim.unlocked('chakra')).toBe(true);
  });

  it('nudges the player to set it up once it is available', () => {
    const { sim, s } = openCenter(1);
    addStaffRoom(sim);
    addAcupuncture(sim);
    hire(sim, 'acupuncturist');
    s.stars = 1;
    expect(sim.advice()).not.toMatch(/Reiki/);
    s.stars = 2;
    expect(sim.advice()).toBe(
      'Reiki is now available. Build a Reiki Studio and hire a Reiki Practitioner to bring in a new kind of guest.',
    );
    addReiki(sim);
    expect(sim.advice()).not.toMatch(/Reiki is now available/);
  });
});

describe('treating reiki guests', () => {
  it('staffs the studio with practitioners and heals their guests for a fee', () => {
    const { sim, s } = openCenter(5);
    s.stars = 2;
    addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    practitioner.skill = 4;
    runUntil(sim, () => practitioner.state === 'atPost', 200);
    expect(sim.world.item(practitioner.post)!.type).toBe('reiki_table');
    runUntil(
      sim,
      () => {
        for (const g of s.guests) if (g.diagnosis === 0) g.condition = 'drained';
        return s.guests.some((g) => g.outcome === 'healed' && g.condition === 'drained');
      },
      900,
    );
    expect(practitioner.served).toBeGreaterThan(0);
    expect(s.ledger.treatment + s.lastLedger.treatment).toBeGreaterThan(0);
  });

  it('needs its equipment in the studio', () => {
    const { sim, s } = openCenter(1);
    s.stars = 3;
    addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    practitioner.quals = ['usui', 'crystal', 'chakra', 'distance'];
    const table = s.items.find((i) => i.type === 'reiki_table')!;
    expect(sim.deliveryProblem(table, practitioner, MODALITIES.usui)).toBe('');
    expect(sim.deliveryProblem(table, practitioner, MODALITIES.chakra)).toBe('');
    expect(sim.deliveryProblem(table, practitioner, MODALITIES.crystal)).toBe('no-equipment');
    expect(sim.world.canPlaceItem('crystal_grid', 14, 7, 0).reason).toMatch(/Reiki Studio/);
    const { x, y, w, h } = LAYOUT.reiki.rect;
    expect(sim.placeItem('crystal_grid', x + w - 1, y + h - 1, 0)).not.toBeNull();
    expect(sim.deliveryProblem(table, practitioner, MODALITIES.crystal)).toBe('');
    expect(sim.deliveryProblem(table, practitioner, MODALITIES.distance), 'nothing needed at a distance').toBe('');
  });
});

describe('reiki practitioners', () => {
  it('arrive knowing Usui reiki, and train only in reiki techniques', () => {
    const { sim, s } = openCenter(1);
    s.stars = 3;
    const practitioner = hire(sim, 'practitioner');
    expect(practitioner.quals).toContain('usui');
    practitioner.quals = ['usui'];
    expect(treatmentCourses(sim.courses(practitioner))).toEqual(['crystal', 'chakra', 'distance']);
    expect(sim.train(practitioner.id, 'deep')).toBe(false);
  });

  it('can be trained in a new technique', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    addTraining(sim);
    const practitioner = hire(sim, 'practitioner');
    practitioner.quals = ['usui'];
    expect(sim.train(practitioner.id, 'crystal')).toBe(true);
    runUntil(sim, () => practitioner.training === null, 300);
    expect(practitioner.quals).toEqual(['usui', 'crystal']);
  });
});

describe('switching reiki off', () => {
  it('stops its guests arriving, but leaves the studio standing', () => {
    const { sim, s } = openCenter(4);
    s.stars = 2;
    const studio = addReiki(sim);
    const practitioner = hire(sim, 'practitioner');
    sim.setDiscipline('reiki', false);
    expect(sim.offered('reiki')).toBe(false);
    expect(sim.unlocked('usui')).toBe(false);
    run(sim, 300);
    s.guests = s.guests.filter((g) => disciplineOf(g.condition) !== 'reiki');
    expect(watchArrivals(sim, 600).has('reiki')).toBe(false);
    expect(s.rooms).toContain(studio);
    expect(s.staff).toContain(practitioner);

    sim.setDiscipline('reiki', true);
    expect(watchArrivals(sim, 900).has('reiki')).toBe(true);
  });
});

describe('the reiki setting', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
      /** Forget a stored value. */
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });

  it('is remembered on its own, and applies to a game through its options', () => {
    saveDisciplinePref('reiki', false);
    expect(loadDisciplinePrefs()).toEqual({ reiki: false });
    const s = newGame();
    s.options = loadDisciplinePrefs();
    expect(disciplineOn(s, 'reiki')).toBe(false);
    expect(disciplineOn(s, 'acupuncture')).toBe(true);
  });
});

describe('a long session with all three disciplines', () => {
  it.each([1, 2])('stays healthy for an hour of play (seed %i)', (seed) => {
    const { sim, s, therapist } = openCenter(seed);
    s.stars = 3;
    addStaffRoom(sim);
    addTraining(sim);
    addPostureLab(sim);
    addAcupuncture(sim);
    addReiki(sim);
    hire(sim, 'caretaker');
    hire(sim, 'consultant');
    hire(sim, 'acupuncturist');
    const practitioner = hire(sim, 'practitioner');
    practitioner.quals = ['usui', 'crystal', 'chakra', 'distance'];
    therapist.quals = ['swedish', 'deep', 'sports', 'stone', 'cranio'];
    for (const [type, x, y] of [
      ['crystal_grid', 27, 16],
      ['bench', 10, 9],
      ['bench', 20, 9],
    ] as const)
      expect(sim.placeItem(type, x, y, 0), type).not.toBeNull();
    let healedReiki = 0;
    const counted = new Set<number>();
    for (let second = 0; second < 3600; second++) {
      if (s.offer) sim.acceptEmergency();
      for (const st of s.staff) if (st.raiseAsked) sim.giveRaise(st.id);
      run(sim, 1);
      if (second % 60 === 0) expect(inconsistencies(sim)).toEqual([]);
      for (const g of s.guests) {
        if (g.outcome === 'healed' && !counted.has(g.id)) {
          counted.add(g.id);
          if (disciplineOf(g.condition) === 'reiki') healedReiki++;
        }
        expect(Number.isFinite(g.x + g.y), g.name).toBe(true);
      }
    }
    expect(Number.isFinite(s.money) && Number.isFinite(s.reputation)).toBe(true);
    expect(healedReiki).toBeGreaterThan(5);
    expect(s.stats.healed).toBeGreaterThan(s.stats.stormed);
    for (const item of s.items) {
      for (const id of item.queue) expect(sim.guest(id), 'queued guest exists').toBeDefined();
      if (item.staffId) expect(sim.staff(item.staffId)?.post).toBe(item.id);
    }
  });
});
