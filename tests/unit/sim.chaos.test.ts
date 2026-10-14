// A player who cannot sit still: builds, demolishes, sells, moves, hires, fires and trains at random
// while the center runs, checking after every move that the game's books still balance. The moves
// are drawn from the game's own seeded random numbers, so a failure replays exactly.
import { describe, expect, it } from 'vitest';

import { BX0, BX1, BY0, BY1, type ItemType, type Role } from '../../src/core/data';
import { irnd, pick, random } from '../../src/core/random';
import type { Sim } from '../../src/core/sim/sim';
import {
  addAcupuncture,
  addConsult,
  addMassage,
  addPostureLab,
  addReiki,
  addRestroom,
  addStaffRoom,
  addTraining,
  inconsistencies,
  LONG_RUN,
  openCenter,
  run,
} from './helpers';

const EXTRAS: ItemType[] = [
  'bench',
  'bench',
  'plant',
  'tea_station',
  'snack_machine',
  'bin',
  'water_cooler',
  'magazine_rack',
];
const ROLES: Role[] = ['receptionist', 'consultant', 'therapist', 'caretaker', 'acupuncturist', 'practitioner'];
const ROOMS = [addConsult, addMassage, addStaffRoom, addRestroom, addTraining, addPostureLab, addAcupuncture, addReiki];

/** One thing a restless player might do. Each quietly does nothing when it does not apply. */
const MOVES: Record<string, (sim: Sim) => void> = {
  /** Build a room at its usual spot, tearing the blueprint up again if the spot is taken. */
  build: (sim) => {
    try {
      pick(ROOMS)(sim);
    } catch {
      // that spot is taken: the room is already there, or something is in the way
      for (const r of sim.s.rooms) if (!r.done) sim.removeRoom(r.id, 1);
    }
  },
  /** Knock down a room, guests and all. */
  demolish: (sim) => {
    const room = sim.s.rooms.length ? pick(sim.s.rooms) : undefined;
    if (room) sim.removeRoom(room.id, 0.5);
  },
  /** Buy something and put it down somewhere. */
  place: (sim) => {
    // the reception desk first, if it has gone, so that guests keep coming
    if (!sim.s.items.some((i) => i.type === 'reception_desk')) sim.placeItem('reception_desk', 14, 13, 0);
    else sim.placeItem(pick(EXTRAS), irnd(BX0, BX1), irnd(BY0, BY1), irnd(0, 3));
  },
  /** Sell something that can be sold. */
  sell: (sim) => {
    const it = sim.s.items.length ? pick(sim.s.items) : undefined;
    if (it && sim.canSell(it)) sim.sellItem(it.id);
  },
  /** Pick something up and put it down somewhere else. */
  move: (sim) => {
    const it = sim.s.items.length ? pick(sim.s.items) : undefined;
    if (it) sim.moveItem(it.id, irnd(BX0, BX1), irnd(BY0, BY1), irnd(0, 3));
  },
  /** Take someone on. */
  hire: (sim) => {
    const role = pick(ROLES);
    const c = sim.s.candidates.find((x) => x.role === role);
    if (c) sim.hire(c.id);
  },
  /** Let someone go, whatever they are in the middle of. */
  fire: (sim) => {
    const st = sim.s.staff.length ? pick(sim.s.staff) : undefined;
    if (st) sim.fire(st.id);
  },
  /** Send someone on a course, whatever they are in the middle of. */
  train: (sim) => {
    const st = sim.s.staff.length ? pick(sim.s.staff) : undefined;
    const courses = st ? sim.courses(st) : [];
    if (st && courses.length) sim.train(st.id, pick(courses).id);
  },
  /** Take on an emergency on offer. */
  emergency: (sim) => {
    if (sim.s.offer) sim.acceptEmergency();
  },
  /** Switch acupuncture or reiki on or off. */
  switch: (sim) => {
    const d = pick(['acupuncture', 'reiki'] as const);
    sim.setDiscipline(d, !sim.enabled(d));
  },
  /** Give everyone who asked their raise. */
  raise: (sim) => {
    for (const st of sim.s.staff) if (st.raiseAsked) sim.giveRaise(st.id);
  },
};

/** How often each move comes up, compared with the rest. */
const WEIGHTS: Record<string, number> = { build: 3, place: 4, move: 2, hire: 3, fire: 2, train: 2 };

describe('a restless player', () => {
  it.each([1, 2, 3, 4])('never leaves the books unbalanced (seed %i)', { timeout: LONG_RUN }, (seed) => {
    const { sim, s } = openCenter(seed);
    s.stars = 3;
    // building comes up more often than tearing down, so there is a busy center to disrupt
    const names = Object.entries(MOVES).flatMap(([name]) => Array<string>(WEIGHTS[name] ?? 1).fill(name));
    const log: string[] = [];
    for (let step = 0; step < 300; step++) {
      const name = pick(names);
      MOVES[name]!(sim);
      log.push(name);
      // the last few moves are what led here, should anything be wrong: checked straight after the move,
      // and again after some play, since a later move can tidy up the evidence
      expect(inconsistencies(sim), `straight after ${log.slice(-5).join(', ')}`).toEqual([]);
      run(sim, 2 + random() * 20);
      expect(inconsistencies(sim), `playing on after ${log.slice(-5).join(', ')}`).toEqual([]);
      expect(Number.isFinite(s.money) && Number.isFinite(s.reputation)).toBe(true);
      for (const c of [...s.guests, ...s.staff]) expect(Number.isFinite(c.x + c.y), c.name).toBe(true);
      // a lot of money keeps the moves coming: being broke is not what this is testing
      s.money = Math.max(s.money, 50_000);
      sim.drain();
    }
  });
});
