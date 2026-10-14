import { beforeEach, describe, expect, it } from 'vitest';

import { type ConditionId, conditionOf, CONDITIONS, DISCIPLINES, ITEMS, MODALITIES, ROOMS } from '../../src/core/data';
import type { Sim } from '../../src/core/sim/sim';
import { disciplineOn, newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { loadDisciplinePrefs, saveDisciplinePref } from '../../src/storage/settings';
import {
  addAcupuncture,
  addPostureLab,
  addStaffRoom,
  addTraining,
  hire,
  LONG_RUN,
  openCenter,
  run,
  runUntil,
} from './helpers';

/** The discipline that treats a condition. */
const disciplineOf = (condition: ConditionId) => MODALITIES[conditionOf(condition).modality].discipline;

/** Play for a while and report which disciplines' guests turned up. */
function watchArrivals(sim: Sim, seconds: number) {
  const seen = new Set<string>();
  for (let i = 0; i < seconds; i++) {
    // hold the healed count down so no further star is earned mid-test
    sim.s.stats.healed = Math.min(sim.s.stats.healed, 5);
    run(sim, 1);
    for (const g of sim.s.guests) seen.add(disciplineOf(g.condition));
  }
  return seen;
}

describe('offering acupuncture', () => {
  it('brings no acupuncture guests until a clinic has been built', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    expect(sim.offered('acupuncture')).toBe(false);
    expect([...watchArrivals(sim, 600)]).toEqual(['massage']);
    addAcupuncture(sim);
    hire(sim, 'acupuncturist');
    expect(sim.offered('acupuncture')).toBe(true);
    expect(watchArrivals(sim, 900).has('acupuncture')).toBe(true);
  });

  it('is locked until the first star', () => {
    const { sim, s } = openCenter(1);
    expect(ROOMS.acupuncture.unlock).toBe(1);
    expect(sim.unlocked('needling')).toBe(false);
    s.stars = 1;
    expect(sim.unlocked('needling')).toBe(true);
    expect(sim.unlocked('cupping')).toBe(true);
    expect(sim.unlocked('moxa')).toBe(false);
    s.stars = 2;
    expect(sim.unlocked('electro')).toBe(true);
  });

  it('nudges the player to set it up once it is available', () => {
    const { sim, s } = openCenter(1);
    addStaffRoom(sim);
    expect(sim.advice()).not.toMatch(/Acupuncture/);
    s.stars = 1;
    expect(sim.advice()).toMatch(/Acupuncture is now available/);
    addAcupuncture(sim);
    expect(sim.advice()).not.toMatch(/Acupuncture is now available/);
  });
});

describe('treating acupuncture guests', () => {
  it('sends them to the clinic and massage guests to the suite, never the other way round', () => {
    const { sim, s } = openCenter(3);
    s.stars = 1;
    addAcupuncture(sim);
    addStaffRoom(sim);
    hire(sim, 'acupuncturist');
    const treatedAt = { massage: new Set<string>(), acupuncture: new Set<string>(), reiki: new Set<string>() };
    for (let i = 0; i < 1500; i++) {
      s.stats.healed = Math.min(s.stats.healed, 20);
      run(sim, 1);
      for (const g of s.guests) {
        if (g.goal !== 'treat' || g.state !== 'served') continue;
        treatedAt[disciplineOf(g.condition)].add(sim.world.item(g.station)!.type);
      }
    }
    expect([...treatedAt.massage]).toEqual(['massage_table']);
    expect([...treatedAt.acupuncture]).toEqual(['acu_table']);
  });

  it('staffs the clinic with acupuncturists and the suite with therapists', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 1;
    addAcupuncture(sim);
    const acupuncturist = hire(sim, 'acupuncturist');
    runUntil(sim, () => acupuncturist.state === 'atPost' && therapist.state === 'atPost', 200);
    expect(sim.world.item(acupuncturist.post)!.type).toBe('acu_table');
    expect(sim.world.item(therapist.post)!.type).toBe('massage_table');
  });

  it('heals them and takes the fee', () => {
    const { sim, s } = openCenter(5);
    s.stars = 1;
    addAcupuncture(sim);
    const acu = hire(sim, 'acupuncturist');
    acu.skill = 4;
    let healedAcu = 0;
    runUntil(
      sim,
      () => {
        for (const g of s.guests) if (g.diagnosis === 0) g.condition = 'qi';
        healedAcu = s.guests.filter((g) => g.outcome === 'healed' && g.condition === 'qi').length;
        return healedAcu > 0;
      },
      900,
    );
    expect(acu.served).toBeGreaterThan(0);
    expect(s.ledger.treatment + s.lastLedger.treatment).toBeGreaterThan(0);
  });

  it('needs the right equipment in the clinic, not in the massage suite', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    addAcupuncture(sim);
    const acu = hire(sim, 'acupuncturist');
    acu.quals = ['needling', 'cupping'];
    const table = s.items.find((i) => i.type === 'acu_table')!;
    expect(sim.deliveryProblem(table, acu, MODALITIES.needling)).toBe('');
    expect(sim.deliveryProblem(table, acu, MODALITIES.cupping)).toBe('no-equipment');
    expect(sim.world.canPlaceItem('cupping_cart', 14, 7, 0).reason).toMatch(/Acupuncture Clinic/);
    expect(sim.placeItem('cupping_cart', 27, 10, 0)).not.toBeNull();
    expect(sim.deliveryProblem(table, acu, MODALITIES.cupping)).toBe('');
    expect(sim.deliveryProblem(table, acu, MODALITIES.moxa)).toBe('no-equipment');
    acu.quals = ['needling'];
    expect(sim.deliveryProblem(table, acu, MODALITIES.cupping)).toBe('unqualified');
  });
});

describe('acupuncturists', () => {
  it('arrive knowing needling, and train only in acupuncture techniques', () => {
    const { sim, s, therapist } = openCenter(1);
    s.stars = 2;
    const acu = hire(sim, 'acupuncturist');
    expect(acu.quals).toContain('needling');
    acu.quals = ['needling'];
    therapist.quals = ['swedish'];
    expect(sim.courses(acu).map((c) => c.id)).toEqual([
      'cupping',
      'moxa',
      'electro',
      ...(acu.skill < 5 ? ['skill'] : []),
    ]);
    expect(sim.courses(therapist).map((c) => c.id)).toEqual([
      'deep',
      'sports',
      'stone',
      'cranio',
      ...(therapist.skill < 5 ? ['skill'] : []),
    ]);
    expect(sim.courses(acu).find((c) => c.id === 'cupping')!.name).toBe('Cupping');
    expect(sim.courses(therapist).find((c) => c.id === 'deep')!.name).toBe('Deep Tissue massage');
  });

  it('can be trained in a new technique', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    addTraining(sim);
    const acu = hire(sim, 'acupuncturist');
    acu.quals = ['needling'];
    expect(sim.train(acu.id, 'cupping')).toBe(true);
    runUntil(sim, () => acu.training === null, 300);
    expect(acu.quals).toEqual(['needling', 'cupping']);
    expect(sim.fairPay(acu)).toBeGreaterThan(acu.salary);
  });

  it('never get offered a massage course, and are refused one', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    addTraining(sim);
    const acu = hire(sim, 'acupuncturist');
    expect(sim.train(acu.id, 'deep')).toBe(false);
    expect(acu.training).toBeNull();
  });
});

describe('emergencies with acupuncture', () => {
  it('can be acupuncture cases once a clinic and a qualified acupuncturist exist', () => {
    const { sim, s, therapist } = openCenter(2);
    s.stars = 1;
    addAcupuncture(sim);
    hire(sim, 'acupuncturist');
    // with no therapist left, only acupuncture cases can be offered
    sim.fire(therapist.id);
    for (let i = 0; i < 10; i++) {
      expect(sim.offerEmergency()).toBe(true);
      expect(disciplineOf(s.offer!.condition)).toBe('acupuncture');
      sim.declineEmergency();
    }
  });
});

describe('switching acupuncture off', () => {
  it('stops its guests arriving and hides its courses, but leaves the clinic standing', () => {
    const { sim, s } = openCenter(4);
    s.stars = 2;
    const clinic = addAcupuncture(sim);
    const acu = hire(sim, 'acupuncturist');
    acu.quals = ['needling'];
    expect(sim.enabled('acupuncture')).toBe(true);
    sim.setDiscipline('acupuncture', false);
    expect(sim.enabled('acupuncture')).toBe(false);
    expect(sim.offered('acupuncture')).toBe(false);
    expect(sim.unlocked('needling')).toBe(false);
    expect(sim.courses(acu).every((c) => c.id === 'skill')).toBe(true);
    // let anyone already inside finish, then nobody new should need acupuncture
    run(sim, 300);
    s.guests = s.guests.filter((g) => disciplineOf(g.condition) === 'massage');
    expect([...watchArrivals(sim, 600)]).toEqual(['massage']);
    expect(s.rooms).toContain(clinic);
    expect(s.staff).toContain(acu);
    expect(sim.advice()).not.toMatch(/Acupuncture/);

    sim.setDiscipline('acupuncture', true);
    expect(watchArrivals(sim, 900).has('acupuncture')).toBe(true);
  });

  it('cannot switch massage off', () => {
    const { sim } = openCenter(1);
    sim.setDiscipline('massage', false);
    expect(sim.enabled('massage')).toBe(true);
    expect(DISCIPLINES.massage.optional).toBe(false);
  });

  it('never offers an acupuncture emergency while off', () => {
    const { sim, s } = openCenter(1);
    s.stars = 2;
    addAcupuncture(sim);
    hire(sim, 'acupuncturist');
    sim.setDiscipline('acupuncture', false);
    for (let i = 0; i < 20; i++) {
      sim.offerEmergency();
      expect(disciplineOf(s.offer!.condition)).toBe('massage');
      sim.declineEmergency();
    }
  });
});

describe('settings', () => {
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

  it('remember which treatments are switched off, defaulting to on', () => {
    expect(loadDisciplinePrefs()).toEqual({});
    saveDisciplinePref('acupuncture', false);
    expect(loadDisciplinePrefs()).toEqual({ acupuncture: false });
    saveDisciplinePref('acupuncture', true);
    expect(loadDisciplinePrefs()).toEqual({ acupuncture: true });
  });

  it('ignore junk and anything that is not optional', () => {
    store.set('pressure-point-settings', 'not json');
    expect(loadDisciplinePrefs()).toEqual({});
    store.set(
      'pressure-point-settings',
      JSON.stringify({ disciplines: { massage: false, acupuncture: 'no', tarot: false } }),
    );
    expect(loadDisciplinePrefs()).toEqual({});
  });

  it('apply to a game through its options', () => {
    const s = newGame();
    expect(disciplineOn(s, 'acupuncture')).toBe(true);
    s.options = { acupuncture: false };
    expect(disciplineOn(s, 'acupuncture')).toBe(false);
    expect(disciplineOn(s, 'massage')).toBe(true);
  });

  it('default to everything on for saves from before settings existed', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as Record<string, any>;
    delete old.options;
    upgradeSave(old as GameState);
    expect(disciplineOn(old as GameState, 'acupuncture')).toBe(true);
  });
});

describe('the data', () => {
  it('gives every modality conditions to treat and every condition a real modality', () => {
    for (const m of Object.keys(MODALITIES))
      expect(
        CONDITIONS.some((c) => c.modality === m),
        m,
      ).toBe(true);
    for (const c of CONDITIONS) expect(MODALITIES[c.modality], c.id).toBeDefined();
  });

  it("puts each discipline's equipment in its own room", () => {
    for (const def of Object.values(MODALITIES)) {
      if (!def.equipment) continue;
      expect(ITEMS[def.equipment].where, def.id).toBe(DISCIPLINES[def.discipline].room);
    }
    for (const d of Object.values(DISCIPLINES)) {
      expect(ROOMS[d.room].discipline).toBe(d.id);
      expect(MODALITIES[d.base].discipline).toBe(d.id);
      expect(MODALITIES[d.base].trainCost).toBe(0);
    }
  });
});

describe('a long session with both disciplines', () => {
  it.each([1, 2])('stays healthy for an hour of play (seed %i)', { timeout: LONG_RUN }, (seed) => {
    const { sim, s, therapist } = openCenter(seed);
    s.stars = 2;
    addStaffRoom(sim);
    addTraining(sim);
    addPostureLab(sim);
    addAcupuncture(sim);
    hire(sim, 'caretaker');
    hire(sim, 'consultant');
    const acu = hire(sim, 'acupuncturist');
    acu.quals = ['needling', 'cupping', 'moxa', 'electro'];
    therapist.quals = ['swedish', 'deep', 'sports', 'stone', 'cranio'];
    for (const [type, x, y] of [
      ['stretch_rack', 14, 7],
      ['stone_warmer', 14, 6],
      ['cupping_cart', 27, 10],
      ['moxa_burner', 27, 9],
      ['stim_unit', 24, 8],
      ['bench', 10, 9],
      ['bench', 20, 9],
    ] as const)
      expect(sim.placeItem(type, x, y, 0), type).not.toBeNull();
    const healedBy = { massage: 0, acupuncture: 0, reiki: 0 };
    const counted = new Set<number>();
    for (let second = 0; second < 3600; second++) {
      if (s.offer) sim.acceptEmergency();
      for (const st of s.staff) if (st.raiseAsked) sim.giveRaise(st.id);
      run(sim, 1);
      for (const g of s.guests) {
        if (g.outcome === 'healed' && !counted.has(g.id)) {
          counted.add(g.id);
          healedBy[disciplineOf(g.condition)]++;
        }
        expect(Number.isFinite(g.x + g.y), g.name).toBe(true);
      }
    }
    expect(Number.isFinite(s.money) && Number.isFinite(s.reputation)).toBe(true);
    expect(healedBy.massage).toBeGreaterThan(10);
    expect(healedBy.acupuncture).toBeGreaterThan(10);
    expect(s.stats.healed).toBeGreaterThan(s.stats.stormed);
    for (const item of s.items) {
      for (const id of item.queue) expect(sim.guest(id), 'queued guest exists').toBeDefined();
      if (item.staffId) expect(sim.staff(item.staffId)?.post).toBe(item.id);
    }
  });
});
