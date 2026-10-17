// Qi Gong classes: the timetable, how a class fills, and a class going ahead, or not, in play.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLASS_CALL_GAP, CLASS_DAYS, CLASS_FEE, DAY_SECONDS, ITEMS, ROOMS } from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import {
  CLASS_LINES,
  classDays,
  classOn,
  classPlaces,
  classSize,
  toggledDays,
  weekday,
  weeklyInterest,
} from '../../src/core/sim/classes';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { worsening } from '../../src/core/sim/worsening';
import type { GameState, Guest } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { hireableRoles, itemOffered } from '../../src/ui/lib/catalog';
import { bookingNote, placesNote, weekNote } from '../../src/ui/lib/classes';
import { offeredMetrics } from '../../src/ui/lib/stats';
import { guestStatus } from '../../src/ui/lib/status';
import { newRoomsText } from '../../src/ui/lib/unlocks';
import { addQigong, addStaffRoom, hire, inconsistencies, openCenter, run, runUntil } from './helpers';

/** A center with a Qi Gong Studio, open at the second star, and an Instructor if asked for, just before a Wednesday. */
function studio(instructor = true) {
  const center = openCenter(3);
  const { sim, s } = center;
  s.stars = 2;
  const room = addQigong(sim);
  const teacher = instructor ? hire(sim, 'instructor') : undefined;
  // day 0 is a Monday: as Wednesday begins, Friday's class is booked, two days ahead
  s.day = 1.98;
  return { ...center, room, teacher };
}

describe('the timetable', () => {
  it('counts the week from Monday, and holds classes on Monday, Wednesday and Friday to begin with', () => {
    expect([0, 6, 7, 9.5].map(weekday)).toEqual([0, 6, 0, 2]);
    expect(classDays({})).toEqual(CLASS_DAYS);
    expect([0, 1, 2, 3, 4, 5, 6].filter((d) => classOn({}, d))).toEqual([0, 2, 4]);
    expect(classOn({ classDays: [5] }, 12)).toBe(true);
  });

  it('switches a day on or off, keeping the days in order', () => {
    expect(toggledDays([0, 4], 2)).toEqual([0, 2, 4]);
    expect(toggledDays([0, 2, 4], 2)).toEqual([0, 4]);
  });

  it('is changed from the studio, and only a studio', () => {
    const { sim, room } = studio();
    expect(sim.toggleClassDay(room.id, 6)).toBe(true);
    expect(room.classDays).toEqual([0, 2, 4, 6]);
    const massage = sim.s.rooms.find((r) => r.type === 'massage');
    expect(massage && sim.toggleClassDay(massage.id, 6)).toBe(false);
    expect(sim.toggleClassDay(room.id, 7)).toBe(false);
  });

  it('says how many classes it holds, and how the next one is filling', () => {
    expect(weekNote([])).toBe('No classes: switch on a day to hold one.');
    expect(weekNote([1])).toBe('1 class a week, sharing the week’s class-goers');
    expect(weekNote([0, 2, 4])).toBe('3 classes a week, sharing the week’s class-goers');
    expect(bookingNote(undefined, 3)).toBe('Places for each class are booked two days before.');
    expect(bookingNote({ day: 2, count: 3, turned: 0 }, 3.5)).toBe('Places for each class are booked two days before.');
    expect(bookingNote({ day: 4, count: 3, turned: 0 }, 2.5)).toBe('Fri’s class: 3 booked');
    expect(bookingNote({ day: 4, count: 6, turned: 2 }, 4.1)).toBe('Today’s class: 6 booked, full, with 2 turned away');
    expect(bookingNote({ day: 4, count: 0, turned: 0 }, 4.1)).toBe('Today’s class: nobody booked');
  });
});

describe('how a class fills', () => {
  it('draws more for more Practice Spots, a better reputation and a more skilled Instructor', () => {
    const base = weeklyInterest(4, 50, 2);
    expect(weeklyInterest(6, 50, 2)).toBeGreaterThan(base);
    expect(weeklyInterest(4, 80, 2)).toBeGreaterThan(base);
    expect(weeklyInterest(4, 50, 4)).toBeGreaterThan(base);
  });

  it('shares the week’s interest among its classes, up to the places there are, turning the rest away', () => {
    expect(classSize(12, 3, 6, 1)).toEqual({ count: 4, turned: 0 });
    expect(classSize(12, 1, 6, 1)).toEqual({ count: 6, turned: 6 });
    expect(classSize(12, 6, 6, 1)).toEqual({ count: 2, turned: 0 });
    expect(classSize(12, 0, 6, 1)).toEqual({ count: 6, turned: 6 });
  });
});

describe('how many an Instructor can lead', () => {
  it('rises with their rank, from 6 for a Trainee to 16 for an Expert', () => {
    expect([1, 2, 3, 4, 5].map(classPlaces)).toEqual([6, 8, 10, 13, 16]);
    expect(classPlaces(0)).toBe(6);
    expect(classPlaces(9)).toBe(16);
  });

  it('caps the places in a class, and the class-goers its spots draw, leaving the rest of the spots empty', () => {
    const { sim, s, room, teacher } = studio();
    for (const [x, y] of [
      [8, 13],
      [5, 14],
      [6, 14],
      [7, 14],
      [8, 14],
    ] as const)
      sim.placeItem('practice_spot', x, y, 0);
    expect(s.items.filter((it) => it.type === 'practice_spot')).toHaveLength(8);
    // one class a week and the best reputation, so far more want a place than there are spots
    room.classDays = [4];
    s.reputation = 100;
    if (teacher) teacher.skill = 1;
    run(sim, 1);
    expect(room.booked).toMatchObject({ day: 4, count: 6 });
    expect(room.booked?.turned).toBeGreaterThan(0);
    expect(sim.drain().some((e) => e.type === 'toast' && e.text.includes('can lead a class of 6'))).toBe(true);
    expect(sim.classLeader()?.places).toBe(6);
    // an Expert leads every spot built
    if (teacher) teacher.skill = 5;
    delete room.booked;
    /** The booking as it stands, read afresh each time. */
    const booked = () => room.booked;
    runUntil(sim, () => booked()?.day === 11, 6 * DAY_SECONDS + 60);
    expect(booked()?.count).toBe(8);
  });

  it('says so in the studio, with a nudge to promote while there is a rank above', () => {
    expect(placesNote(3, 6, 1)).toBe('Trainee Instructors lead up to 6');
    expect(placesNote(8, 6, 1)).toBe(
      '⚠️ Only 6 of 8 spots are booked. Trainee Instructors lead up to 6: promote yours to fill more',
    );
    expect(placesNote(20, 16, 5)).toBe('⚠️ Only 16 of 20 spots are booked. Expert Instructors lead up to 16');
  });
});

describe('a class in play', () => {
  it('is booked two days ahead, and its class-goers follow the Instructor through it, pay and review it', () => {
    const { sim, s, room } = studio();
    run(sim, 1);
    expect(room.booked?.day).toBe(4);
    const booked = room.booked?.count ?? 0;
    expect(booked).toBeGreaterThan(0);
    expect(s.arrivals).toHaveLength(booked);
    runUntil(sim, () => s.guests.some((g) => g.classDay && g.state === 'served'), 60);
    const goer = s.guests.find((g) => g.classDay);
    expect(goer && worsening(goer)).toBe(false);
    expect(goer && guestStatus(goer, sim)).toMatch(/Practice Spot|Qi Gong class/);
    runUntil(sim, () => s.stats.classes > 0, 60);
    expect(s.stats.classgoers).toBeGreaterThan(0);
    expect(s.ledger.classes).toBe(s.stats.classgoers * CLASS_FEE);
    expect(s.reviews.some((r) => r.feelings.includes('class'))).toBe(true);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('brings class-goers straight to the studio, not counted with the guests who come for treatment', () => {
    const { sim, s } = studio();
    const arrived = s.stats.arrived;
    const g = spawnGuest((sim as unknown as { ctx: SimContext }).ctx, undefined, false, 4);
    expect(g).toMatchObject({ classDay: 4, goal: 'class' });
    expect(s.stats.arrived).toBe(arrived);
  });

  it('is announced as its day begins', () => {
    const { sim, s } = studio();
    run(sim, 1);
    sim.drain();
    runUntil(sim, () => s.day >= 4.01, 30);
    expect(sim.drain().some((e) => e.type === 'announce' && CLASS_LINES.includes(e.text))).toBe(true);
  });

  it('is announced only every so often, not for every class, taking turns with its lines', () => {
    const { sim, s } = studio();
    const called: { day: number; text: string }[] = [];
    runUntil(
      sim,
      () => {
        for (const e of sim.drain())
          if (e.type === 'announce' && CLASS_LINES.includes(e.text))
            called.push({ day: Math.floor(s.day), text: e.text });
        return s.day >= 2 + CLASS_CALL_GAP * 2.5;
      },
      DAY_SECONDS * CLASS_CALL_GAP * 3,
    );
    expect(called.length).toBeGreaterThan(1);
    for (const [i, call] of called.slice(1).entries()) {
      expect(call.day - (called[i]?.day ?? 0)).toBeGreaterThanOrEqual(CLASS_CALL_GAP);
      expect(call.text).not.toBe(called[i]?.text);
    }
  });

  it('has the advisor ask for an Instructor while the studio has none', () => {
    const { sim } = studio(false);
    expect(advice((sim as unknown as { ctx: SimContext }).ctx)).toBe(
      'Your Qi Gong Studio is ready for its first class. Hire a Qi Gong Instructor to lead it.',
    );
  });

  it('is not booked without an Instructor on the payroll', () => {
    const { sim, s, room } = studio(false);
    run(sim, 1);
    expect(room.booked).toBeUndefined();
    expect(s.arrivals).toEqual([]);
  });

  it('never happens if the Instructor leaves, and its class-goers go home disappointed', () => {
    const { sim, s, teacher } = studio();
    run(sim, 1);
    runUntil(sim, () => s.guests.some((g) => g.classDay), 60);
    if (teacher) sim.fire(teacher.id);
    runUntil(sim, () => s.reviews.some((r) => r.feelings.includes('no-class')), 60);
    expect(s.stats.classes).toBe(0);
    expect(s.ledger.classes).toBe(0);
  });

  it('keeps the Instructor at the mat to the end, however tired, rather than send its class-goers back to the line', () => {
    const { sim, s, teacher } = studio();
    addStaffRoom(sim);
    const mat = s.items.find((it) => it.type === 'instructor_mat');
    run(sim, 1);
    runUntil(sim, () => !!mat?.progress, 60);
    const goers = s.guests.filter((g) => g.classDay && g.state === 'served');
    expect(goers.length).toBeGreaterThan(0);
    // worn out, and a Staff Room to rest in: once the class is over they may go, but not before
    if (teacher) teacher.energy = 1;
    runUntil(
      sim,
      () => {
        if (mat?.progress) expect(teacher?.state).toBe('atPost');
        return s.stats.classes > 0;
      },
      60,
    );
    expect(goers.every((g) => g.outcome === 'class' && !g.feelings.includes('no-class'))).toBe(true);
    expect(s.stats.classgoers).toBeGreaterThanOrEqual(goers.length);
    runUntil(sim, () => teacher?.state === 'toBreak' || teacher?.state === 'onBreak', 30);
  });

  it('stops being booked when the classes are switched off', () => {
    const { sim, s, room } = studio();
    run(sim, 1);
    expect(s.arrivals.length).toBeGreaterThan(0);
    sim.setDiscipline('qigong', false);
    expect(sim.enabled('qigong')).toBe(false);
    expect(s.arrivals).toEqual([]);
    delete room.booked;
    run(sim, 6);
    expect(room.booked).toBeUndefined();
  });
});

describe('what Settings and the stars offer', () => {
  /** Everything switched on. */
  const allOn = () => true;
  /** Everything but the classes switched on. */
  const noClasses = (d: string) => d !== 'qigong';

  it('opens the studio and its Instructor at the second star, and hides them with the classes off', () => {
    expect(ROOMS.qigong.unlock).toBe(2);
    expect(hireableRoles(1, allOn)).not.toContain('instructor');
    expect(hireableRoles(2, allOn)).toContain('instructor');
    expect(hireableRoles(2, noClasses)).not.toContain('instructor');
    expect(itemOffered(ITEMS.practice_spot, allOn)).toBe(true);
    expect(itemOffered(ITEMS.practice_spot, noClasses)).toBe(false);
    expect(newRoomsText(2, allOn)).toContain('Qi Gong Studio: ');
    expect(newRoomsText(2, noClasses)).not.toContain('Qi Gong');
    expect(offeredMetrics(allOn).map((m) => m.id)).toContain('classgoers');
    expect(offeredMetrics(noClasses).map((m) => m.id)).not.toContain('classgoers');
  });
});

describe('saves from before the classes', () => {
  it('have nobody booked, nobody a class-goer and nothing counted, and Instructors applying', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.guests.length > 0);
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    const raw = old as unknown as Record<string, unknown>;
    delete raw.arrivals;
    const stats = old.stats as unknown as Record<string, unknown>;
    delete stats.classes;
    delete stats.classgoers;
    delete (old.guests[0] as Partial<Guest>).classDay;
    old.candidates = old.candidates.filter((c) => c.role !== 'instructor');
    old.version = 20;
    upgradeSave(old);
    expect(old.candidates.filter((c) => c.role === 'instructor')).toHaveLength(3);
    expect(old.arrivals).toEqual([]);
    expect(old.stats).toMatchObject({ classes: 0, classgoers: 0 });
    expect(old.guests[0]?.classDay).toBe(0);
  });
});

describe('a save from long before the classes', () => {
  it('loads, with Instructors applying', () => {
    const file = path.join(import.meta.dirname, '../visual/fixtures/center.json');
    const old = JSON.parse(readFileSync(file, 'utf8')) as GameState;
    upgradeSave(old);
    expect(old.candidates.filter((c) => c.role === 'instructor')).toHaveLength(3);
  });
});
