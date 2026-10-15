// Staff careers: experience and promotions, qualification slots, general courses, duties, the hiring pool and the
// habits some staff have.
import { describe, expect, it } from 'vitest';

import {
  AMANDA,
  APPLICANT_DAYS,
  BEDSIDE_PATIENCE,
  GENERAL_COURSES,
  MAINTENANCE_SPEED,
  PROMOTION_SULK,
  RANK_XP,
  STAMINA_DRAIN,
} from '../../src/core/data';
import { amandaAround, makeCandidate } from '../../src/core/people';
import {
  applicantCap,
  cheeredUp,
  gainXp,
  rankName,
  rankProgress,
  slotFree,
  trained,
  updateApplicants,
  updateHabits,
  xpToNext,
} from '../../src/core/sim/careers';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { courseSpeed, janitorSpeed, moraleTarget } from '../../src/core/sim/staffing';
import { serviceSeconds } from '../../src/core/sim/stations';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { addTraining, hire, inconsistencies, openCenter, run, runUntil } from './helpers';

describe('ranks', () => {
  it('run from Trainee to Expert, with experience to reach each', () => {
    expect(rankName(1)).toBe('Trainee');
    expect(rankName(5)).toBe('Expert');
    const { therapist } = openCenter(1);
    therapist.skill = 2;
    therapist.xp = RANK_XP[1]!;
    expect(xpToNext(therapist)).toBe(RANK_XP[2]! - RANK_XP[1]!);
    expect(rankProgress(therapist)).toBe(0);
    therapist.skill = 5;
    expect(xpToNext(therapist)).toBeNull();
    expect(rankProgress(therapist)).toBe(1);
  });

  it('give a qualification slot each, for treatments beyond the basic one and for general courses', () => {
    const { therapist } = openCenter(1);
    therapist.skill = 2;
    therapist.quals = ['swedish', 'deep'];
    therapist.general = [];
    expect(trained(therapist)).toBe(1);
    expect(slotFree(therapist)).toBe(true);
    therapist.general = ['stamina'];
    expect(trained(therapist)).toBe(2);
    expect(slotFree(therapist)).toBe(false);
  });

  it('come with experience: a full set of slots and enough of it means a promotion is asked for', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    therapist.skill = 1;
    therapist.quals = ['swedish'];
    therapist.general = [];
    therapist.xp = RANK_XP[1]! - 1;
    // a free slot: a nudge to train them, but no promotion yet
    gainXp(ctx, therapist, 1);
    expect(therapist.promotion).toBe(false);
    expect(drainEvents(ctx).some((e) => e.type === 'toast' && e.text.includes('fill every qualification slot'))).toBe(
      true,
    );
    therapist.general = ['bedside'];
    gainXp(ctx, therapist, 1);
    expect(therapist.promotion).toBe(true);
    expect(drainEvents(ctx).some((e) => e.type === 'toast' && e.text.includes('ready for promotion to Junior'))).toBe(
      true,
    );
  });

  it('are promoted into, with the raise that comes with it', () => {
    const { sim, s, therapist } = openCenter(1);
    therapist.skill = 1;
    therapist.salary = 100;
    therapist.morale = 50;
    expect(sim.promote(therapist.id)).toBe(false);
    therapist.promotion = true;
    // waiting on it sours them
    const waiting = moraleTarget(createContext(s), therapist);
    therapist.promotion = false;
    expect(moraleTarget(createContext(s), therapist) - waiting).toBe(PROMOTION_SULK);
    therapist.promotion = true;
    expect(sim.promote(therapist.id)).toBe(true);
    expect(therapist).toMatchObject({ skill: 2, promotion: false });
    expect(therapist.salary).toBe(sim.fairPay(therapist));
    expect(therapist.morale).toBeGreaterThan(50);
  });

  it('are earned in play, from guests served', () => {
    const { sim, therapist } = openCenter(1);
    const xp = therapist.xp;
    runUntil(sim, () => therapist.xp > xp, 300);
  });

  it('keep courses to the slots there are', () => {
    const { sim, therapist } = openCenter(1);
    addTraining(sim);
    therapist.skill = 1;
    therapist.quals = ['swedish'];
    therapist.general = ['stamina'];
    const course = sim.courses(therapist).find((c) => c.id === 'bedside')!;
    expect(sim.trainBlocker(therapist, course)).toMatch(/slot/);
    expect(sim.train(therapist.id, 'bedside')).toBe(false);
  });
});

describe('general courses', () => {
  it('make their holder faster, hardier or better company', () => {
    const { s, therapist, receptionist } = openCenter(1);
    therapist.general = [];
    const plain = serviceSeconds(60, therapist);
    therapist.general = ['motivation'];
    expect(serviceSeconds(60, therapist)).toBeLessThan(plain);
    receptionist.general = [];
    const desk = serviceSeconds(10, receptionist);
    receptionist.general = ['service'];
    expect(serviceSeconds(10, receptionist)).toBeCloseTo(desk / 1.3, 6);
    expect(GENERAL_COURSES.service.roles).toEqual(['receptionist']);
    /** Energy a therapist loses over the same twenty seconds of work, with Stamina Training or without. */
    const tired = (stamina: boolean) => {
      const c = openCenter(1);
      const t = c.therapist;
      t.general = stamina ? ['stamina'] : [];
      t.energy = 100;
      run(c.sim, 20);
      return 100 - t.energy;
    };
    expect(tired(true)).toBeCloseTo(tired(false) * STAMINA_DRAIN, 0);
    expect(s).toBeTruthy();
  });

  it('let a Janitor with Maintenance get through jobs faster', () => {
    const { sim } = openCenter(1);
    const janitor = hire(sim, 'caretaker');
    janitor.general = [];
    expect(janitorSpeed(janitor)).toBe(1);
    janitor.general = ['maintenance'];
    expect(janitorSpeed(janitor)).toBeCloseTo(MAINTENANCE_SPEED, 6);
  });

  it('keep guests in the line of someone with a good bedside manner patient for longer', () => {
    /** Patience lost by a guest waiting in the massage table's line for a few seconds. */
    const lost = (bedside: boolean) => {
      const { sim, s, therapist } = openCenter(1);
      runUntil(sim, () => s.guests.length > 0, 120);
      therapist.general = bedside ? ['bedside'] : [];
      const table = s.items.find((i) => i.type === 'massage_table')!;
      table.staffId = therapist.id;
      therapist.post = table.id;
      const g = s.guests[0]!;
      Object.assign(g, { station: table.id, state: 'waiting', goal: 'treat', patience: 100, timer: 99 });
      const before = g.patience;
      sim.tick(0.1);
      return before - g.patience;
    };
    expect(lost(true)).toBeCloseTo(lost(false) * BEDSIDE_PATIENCE, 6);
  });
});

describe('duties', () => {
  it('keep a member of staff from some work, but never from all of it', () => {
    const { sim, consultant, receptionist } = openCenter(1);
    expect(sim.setDuty(consultant.id, 'assess', false)).toBe(true);
    expect(consultant.off).toEqual(['assess']);
    expect(sim.setDuty(consultant.id, 'consult', false)).toBe(false);
    expect(sim.setDuty(consultant.id, 'assess', true)).toBe(true);
    expect(consultant.off).toEqual([]);
    // a receptionist has nothing to choose between
    expect(sim.setDuty(receptionist.id, 'consult', false)).toBe(false);
  });

  it('keep a Janitor from a kind of job', () => {
    const { sim, s } = openCenter(1);
    const janitor = hire(sim, 'caretaker');
    expect(sim.setDuty(janitor.id, 'litter', false)).toBe(true);
    s.litter.push({ id: 99001, x: 14, y: 11, claimedBy: 0 });
    run(sim, 30);
    expect(s.litter.some((l) => l.id === 99001)).toBe(true);
    sim.setDuty(janitor.id, 'litter', true);
    runUntil(sim, () => !s.litter.some((l) => l.id === 99001), 60);
  });

  it('send someone kept from their station off to other work', () => {
    const { sim, consultant } = openCenter(1);
    runUntil(sim, () => consultant.state === 'atPost', 120);
    sim.setDuty(consultant.id, 'assess', false);
    // still at the consultation desk, which they are on
    run(sim, 2);
    expect(consultant.post).not.toBe(0);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('the hiring pool', () => {
  it('grows with the stars, a new applicant at a time', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    expect(applicantCap(s)).toBe(3);
    s.stars = 2;
    expect(applicantCap(s)).toBe(5);
    s.stars = 9;
    expect(applicantCap(s)).toBe(6);
    s.stars = 0;
    s.nextApplicant = s.day;
    const before = s.candidates.length;
    // the role with the fewest goes first: after hiring, that is the role hired for
    updateApplicants(ctx);
    expect(s.candidates.length).toBe(before + 1);
    expect(s.nextApplicant).toBeCloseTo(s.day + APPLICANT_DAYS);
    // not again until it is due
    updateApplicants(ctx);
    expect(s.candidates.length).toBe(before + 1);
  });

  it('replaces whoever has waited longest when a role is full', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.candidates = s.candidates.filter((c) => c.role === 'receptionist');
    while (s.candidates.length < 3) s.candidates.push({ ...s.candidates[0]!, id: s.nextId++ });
    // every role but the receptionist's is empty, so they fill first; once all are full, someone is replaced
    for (let i = 0; i < 40; i++) {
      s.nextApplicant = s.day;
      updateApplicants(ctx);
    }
    expect(s.candidates.filter((c) => c.role === 'receptionist').length).toBe(3);
    expect(s.candidates.length).toBe(6 * 3);
  });

  it('lets an applicant be turned down', () => {
    const { sim, s } = openCenter(1);
    const c = s.candidates[0]!;
    expect(sim.reject(c.id)).toBe(true);
    expect(s.candidates).not.toContain(c);
    expect(sim.reject(c.id)).toBe(false);
  });
});

describe('habits', () => {
  it('a Ray of Sunshine lifts the morale of colleagues nearby', () => {
    const { s, therapist, consultant } = openCenter(1);
    therapist.traits = ['sunny'];
    consultant.traits = [];
    consultant.x = therapist.x + 2;
    consultant.y = therapist.y;
    expect(cheeredUp(s, consultant)).toBe(true);
    expect(cheeredUp(s, therapist)).toBe(false);
    consultant.x = therapist.x + 20;
    expect(cheeredUp(s, consultant)).toBe(false);
  });

  it('a Green Thumb waters thirsty plants in passing', () => {
    const { sim, s, receptionist } = openCenter(1);
    receptionist.traits = ['green'];
    receptionist.state = 'wander';
    const it = sim.placeItem('plant', 10, 12, 0, { free: true })!;
    expect(it).toBeTruthy();
    it.water = 10;
    receptionist.x = 10.5;
    receptionist.y = 11.5;
    updateHabits(createContext(s));
    expect(it.water).toBe(100);
    // one with plenty to drink is left alone, and so is one out of reach
    it.water = 70;
    updateHabits(createContext(s));
    expect(it.water).toBe(70);
  });

  it('a Litterbug leaves litter behind', () => {
    const { sim, s, receptionist } = openCenter(1);
    receptionist.traits = ['litterbug'];
    receptionist.state = 'wander';
    const litter = s.litter.length;
    // walking about the corridor for a while
    for (let i = 0; i < 400 && s.litter.length === litter; i++) {
      receptionist.path ??= [[receptionist.x, receptionist.y, 0]];
      receptionist.tx = 14;
      receptionist.ty = 11;
      updateHabits(createContext(s));
    }
    expect(s.litter.length).toBeGreaterThan(litter);
    expect(sim).toBeTruthy();
  });

  it('a Quick Study gets through courses faster', () => {
    const { s, therapist } = openCenter(1);
    therapist.traits = [];
    const plain = courseSpeed(createContext(s), therapist);
    therapist.traits = ['quick'];
    expect(courseSpeed(createContext(s), therapist)).toBeCloseTo(plain * 1.4, 6);
  });
});

describe('a save from before staff careers', () => {
  it('starts everyone at the beginning of the rank their skill makes them, with no courses or duties set', () => {
    const { s } = openCenter(1);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    for (const st of old.staff) for (const k of ['xp', 'promotion', 'general', 'off']) Reflect.deleteProperty(st, k);
    delete old.nextApplicant;
    old.staff[0].skill = 3;
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.staff[0]).toMatchObject({ xp: RANK_XP[2], promotion: false, general: [], off: [] });
    expect(up.nextApplicant).toBeGreaterThan(up.day);
  });
});

describe('Amanda Jablonsky', () => {
  it('applies now and then as a massage therapist of three stars or more, trained in all but Sports and Hot Stone', () => {
    const s = newGame();
    s.candidates = [];
    const applicants = Array.from({ length: 2000 }, () => makeCandidate(s, 'therapist'));
    const amanda = applicants.find((c) => c.name === AMANDA.name);
    expect(amanda?.skill).toBeGreaterThanOrEqual(3);
    expect([...(amanda?.quals ?? [])].sort()).toEqual(['cranio', 'deep', 'swedish']);
    // never for another role
    for (let i = 0; i < 500; i++) expect(makeCandidate(s, 'consultant').name).not.toBe(AMANDA.name);
  });

  it('only ever turns up once at a time', () => {
    const s = newGame();
    s.candidates = [];
    s.candidates.push({ ...makeCandidate(s, 'therapist'), name: AMANDA.name });
    for (let i = 0; i < 2000; i++) expect(makeCandidate(s, 'therapist').name).not.toBe(AMANDA.name);
    expect(amandaAround(s)).toBe(true);
  });
});
