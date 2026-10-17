// Which discipline guests come for: popularity, following, the finest room and training, and what the panel says.
import { describe, expect, it } from 'vitest';

import {
  conditionOf,
  CONDITIONS,
  DISCIPLINES,
  FOLLOWING,
  followingPull,
  MODALITIES,
  OFFERING_ARRIVALS,
} from '../../src/core/data';
import type { Discipline, Modality } from '../../src/core/data/types';
import type { SimContext } from '../../src/core/sim/context';
import {
  chooseCondition,
  type DisciplineDemand,
  fadeFollowing,
  followingOf,
  followVisit,
  offeringArrivals,
  staffedDisciplines,
  UNTRAINED_PULL,
} from '../../src/core/sim/demand';
import { newGame } from '../../src/core/state/game';
import type { GameState, Guest } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { demandAdvice, followingWord, offeringNote, popularityWord, times } from '../../src/ui/lib/demand';
import { addSound, hire, openCenter, runUntil } from './helpers';

/** The game's own context, for calling the simulation directly. */
const ctxOf = (c: { sim: unknown }) => (c.sim as { ctx: SimContext }).ctx;
/** Every technique of a discipline. */
const modsOf = (d: Discipline) => (Object.keys(MODALITIES) as Modality[]).filter((m) => MODALITIES[m].discipline === d);

/** A center with a Massage Suite and a Sound Bath Studio, everyone trained in everything, at the first star. */
function twoRooms() {
  const c = openCenter(1);
  c.s.stars = 1;
  addSound(c.sim);
  const healer = hire(c.sim, 'healer');
  c.therapist.quals = modsOf('massage');
  healer.quals = modsOf('sound');
  return { ...c, healer, ctx: ctxOf(c) };
}

/** One discipline's row of the demand. */
const row = (rows: DisciplineDemand[], d: Discipline) => rows.find((r) => r.discipline === d);

describe('which discipline guests come for', () => {
  it('goes by popularity, all else equal', () => {
    const c = twoRooms();
    c.s.following = { massage: 40, sound: 40 };
    const rows = c.sim.demand();
    const massage = row(rows, 'massage');
    const sound = row(rows, 'sound');
    expect(massage && sound).toBeTruthy();
    if (!massage || !sound) return;
    // the rooms and the local favourites aside, it is popularity that tells them apart
    /** Its pull without its room or the local favourites. */
    const plain = (r: DisciplineDemand) => r.pull / r.room.pull / r.flavour;
    expect(plain(sound) / plain(massage)).toBeCloseTo(DISCIPLINES.sound.popularity / DISCIPLINES.massage.popularity, 5);
    expect(massage.share + sound.share).toBeCloseTo(1, 5);
  });

  it('comes more for a discipline with a bigger following', () => {
    const c = twoRooms();
    c.s.following = { massage: 40, sound: 0 };
    const quiet = row(c.sim.demand(), 'sound')?.share ?? 0;
    c.s.following.sound = 80;
    const famous = row(c.sim.demand(), 'sound')?.share ?? 0;
    expect(famous).toBeGreaterThan(quiet * 2);
    expect(row(c.sim.demand(), 'sound')?.followed).toBe(followingPull(80));
  });

  it('comes less while nobody is trained in what guests want, and says what that is', () => {
    const c = twoRooms();
    const trained = row(c.sim.demand(), 'sound');
    c.healer.quals = ['sound'];
    const untrained = row(c.sim.demand(), 'sound');
    expect(trained?.training).toBe(1);
    expect(untrained?.training).toBeLessThan(1);
    expect(untrained?.training).toBeGreaterThanOrEqual(UNTRAINED_PULL);
    expect(untrained?.untrained).toEqual(['forks']);
    expect(untrained?.share ?? 1).toBeLessThan(trained?.share ?? 0);
  });

  it('picks a discipline by its pull, then a condition within it', () => {
    const c = twoRooms();
    const first = chooseCondition(c.ctx, 0, 0);
    const last = chooseCondition(c.ctx, 0.9999, 0.9999);
    /** The discipline that treats a condition. */
    const disciplineOf = (id: string) =>
      MODALITIES[CONDITIONS.find((x) => x.id === id)?.modality ?? 'swedish'].discipline;
    expect(disciplineOf(first)).toBe('massage');
    expect(disciplineOf(last)).toBe('sound');
  });

  it('falls back to the plainest massage when nothing is on offer', () => {
    const c = openCenter(1);
    c.s.rooms = [];
    expect(conditionOf(chooseCondition(ctxOf(c), 0.5, 0.5)).modality).toBe(DISCIPLINES.massage.base);
  });
});

describe('a following', () => {
  /** A guest come for a condition of a discipline, waiting for their treatment unless they are still on their way. */
  const guestFor = (d: Discipline, goal: Guest['goal'] = 'treat') =>
    ({ condition: CONDITIONS.find((x) => MODALITIES[x.modality].discipline === d)?.id, goal }) as Guest;

  it('grows with each guest healed, less as it grows, and shrinks with each let down', () => {
    const c = twoRooms();
    c.s.following = {};
    expect(followingOf(c.s, 'sound')).toBe(FOLLOWING.start);
    followVisit(c.ctx, guestFor('sound'), 'healed');
    expect(c.s.following.sound).toBeCloseTo(FOLLOWING.start + FOLLOWING.heal * (1 - FOLLOWING.start / 100), 5);
    c.s.following.sound = 50;
    followVisit(c.ctx, guestFor('sound'), 'healed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2);
    followVisit(c.ctx, guestFor('sound'), 'failed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2 - FOLLOWING.fail);
    followVisit(c.ctx, guestFor('sound'), 'stormed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2 - FOLLOWING.fail - FOLLOWING.walkout);
    // a guest put off by the price, or fed up at the desk before their treatment, says nothing about the treatment
    followVisit(c.ctx, guestFor('sound'), 'priced');
    followVisit(c.ctx, guestFor('sound', 'reception'), 'stormed');
    expect(c.s.following.sound).toBe(50 + FOLLOWING.heal / 2 - FOLLOWING.fail - FOLLOWING.walkout);
  });

  it('fades by a twentieth over a month with nobody treated, and not on a day someone is', () => {
    const c = twoRooms();
    c.s.following = { massage: 50, sound: 50 };
    for (let day = 0; day < 30; day++) {
      followVisit(c.ctx, guestFor('sound'), 'failed');
      c.s.following.sound = 50;
      fadeFollowing(c.ctx);
    }
    expect(c.s.following.massage).toBeCloseTo(50 * (1 - FOLLOWING.fade / 30) ** 30, 5);
    expect(c.s.following.massage).toBeCloseTo(47.5, 0);
    expect(c.s.following.sound).toBe(50);
    // a guest who gave up before their treatment was not treated
    followVisit(c.ctx, guestFor('sound'), 'stormed');
    fadeFollowing(c.ctx);
    expect(c.s.following.sound).toBeLessThan(50 - FOLLOWING.walkout);
  });

  it('holds its own with fewer heals than failures from nothing, but needs more as it grows', () => {
    /** Where a following goes after one guest healed and one failed, at some healing rate, over many guests. */
    const settle = (rate: number, from: number) => {
      const c = twoRooms();
      c.s.following = { sound: from };
      for (let i = 0; i < 400; i++) followVisit(c.ctx, guestFor('sound'), (i * rate) % 1 < rate ? 'healed' : 'failed');
      return c.s.following.sound ?? 0;
    };
    expect(settle(0.45, 0)).toBeGreaterThan(5);
    expect(settle(0.45, 80)).toBeLessThan(40);
    expect(settle(0.75, 20)).toBeGreaterThan(60);
  });

  it('starts with massage known, and anything new with a little', () => {
    expect(newGame().following).toEqual({ massage: FOLLOWING.established });
    expect(followingOf(newGame(), 'reiki')).toBe(FOLLOWING.start);
  });

  it('carries on in an older save as if every discipline it had a room for were known', () => {
    const c = twoRooms();
    const old = JSON.parse(JSON.stringify(c.s)) as Partial<GameState>;
    delete old.following;
    upgradeSave(old as GameState);
    const s = old as GameState;
    expect(s.following).toEqual({ massage: FOLLOWING.established, sound: FOLLOWING.established });
  });

  it('is kept in play as its guests are treated', () => {
    const c = twoRooms();
    c.s.following = { massage: 40 };
    c.s.open = true;
    runUntil(c.sim, () => (c.s.stats.healedBy.sound ?? 0) > 0, 1500);
    expect(c.s.following.sound).toBeDefined();
  });
});

describe('how many guests arrive', () => {
  it('rises with each discipline offered with a room and a practitioner, past the first', () => {
    const c = twoRooms();
    expect(staffedDisciplines(c.ctx)).toEqual(['massage', 'sound']);
    expect(offeringArrivals(c.ctx)).toBeCloseTo(1 + OFFERING_ARRIVALS, 5);
    expect(c.sim.offering()).toEqual({ staffed: 2, arrivals: offeringArrivals(c.ctx) });
    // a room with nobody to work in it brings nobody
    c.healer.state = 'leaving';
    expect(staffedDisciplines(c.ctx)).toEqual(['massage']);
    expect(offeringArrivals(c.ctx)).toBe(1);
  });

  it('says so in the panel', () => {
    expect(offeringNote(1, 1)).toBe(
      'Each discipline you add, with its room and a practitioner on the payroll, brings more guests in all.',
    );
    expect(offeringNote(3, 1.2)).toBe(
      '3 disciplines with a room and a practitioner bring guests ×1.2 as often as one would.',
    );
  });
});

describe('the Guests panel', () => {
  const base: DisciplineDemand = {
    discipline: 'sound',
    popularity: 0.6,
    following: 50,
    followed: 1.5,
    room: { pull: 2 },
    conditions: 3,
    trained: 3,
    training: 1,
    untrained: [],
    flavour: 1,
    pull: 1.8,
    share: 0.3,
  };

  it('puts multipliers and words to the factors', () => {
    expect(times(1)).toBe('×1');
    expect(times(1.25)).toBe('×1.25');
    expect(times(0.6)).toBe('×0.6');
    expect(popularityWord(1)).toBe('Everyday');
    expect(popularityWord(0.6)).toBe('Niche');
    expect(followingWord(5)).toBe('Barely known');
    expect(followingWord(75)).toBe('Talked about everywhere');
  });

  it('advises training first, then word of mouth, then the room, and nothing when all is well', () => {
    expect(demandAdvice({ ...base, untrained: ['forks'], trained: 2 })).toMatch(
      /^Guests needing Tuning Forks mostly stay away/,
    );
    expect(demandAdvice({ ...base, following: 10 })).toMatch(/^Few have heard of sound healing here yet/);
    expect(demandAdvice({ ...base, room: { pull: 1.1 } })).toMatch(
      /^A finer, quieter Sound Bath Studio would draw more/,
    );
    expect(demandAdvice(base)).toBeNull();
  });
});
