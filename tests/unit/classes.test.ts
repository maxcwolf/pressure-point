// Qi Gong classes: the timetable, how a class fills, and a class going ahead, or not, in play.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BREAK_AT,
  BREAK_EXHAUSTED,
  CLASS_CALL_GAP,
  CLASS_DAYS,
  CLASS_FEE,
  DAY_SECONDS,
  ITEMS,
  REST_AHEAD,
  REST_RETURN,
  ROOMS,
  STAFF_NEED_HOLD,
} from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { accessIndex } from '../../src/core/sim/claims';
import {
  admitClassgoers,
  announceClasses,
  awayForClass,
  backForClass,
  CLASS_LINES,
  classDays,
  classOn,
  classPlaces,
  classSize,
  daysToClass,
  dueForSpot,
  missNote,
  missToast,
  noteMissedClasses,
  restDue,
  toggledDays,
  weekday,
  weeklyInterest,
} from '../../src/core/sim/classes';
import type { SimContext } from '../../src/core/sim/context';
import { admitGuests, guestCap, guestsCounted, spawnGuest } from '../../src/core/sim/guests';
import { wantsAway } from '../../src/core/sim/staffing';
import { worsening } from '../../src/core/sim/worsening';
import type { GameState, Guest, Staff } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { accessTile } from '../../src/core/world';
import { hireableRoles, itemOffered } from '../../src/ui/lib/catalog';
import { bookingNote, demandNote, placesNote, weekNote } from '../../src/ui/lib/classes';
import { offeredMetrics } from '../../src/ui/lib/stats';
import { guestStatus } from '../../src/ui/lib/status';
import { newRoomsText } from '../../src/ui/lib/unlocks';
import { addQigong, addStaffRoom, hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** Put an Instructor straight at their mat, as places in a class are booked only while they are there. */
function toMat(s: GameState, st: Staff) {
  const mat = s.items.find((it) => it.type === 'instructor_mat');
  if (!mat) throw new Error('no Instructor’s Mat');
  const [x, y] = accessTile(mat, accessIndex(mat, 'staff'));
  Object.assign(st, { x: x + 0.5, y: y + 0.5, tx: x, ty: y, path: null, dest: null, state: 'atPost', post: mat.id });
  mat.staffId = st.id;
}

/** A center with a Qi Gong Studio, open at the second star, and an Instructor if asked for, just before a Wednesday. */
function studio(instructor = true) {
  const center = openCenter(3);
  const { sim, s } = center;
  s.stars = 2;
  const room = addQigong(sim);
  const teacher = instructor ? hire(sim, 'instructor') : undefined;
  if (teacher) toMat(s, teacher);
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
    expect(bookingNote({ day: 4, count: 0, turned: 0, away: true }, 2.5)).toBe(
      'Fri’s class: nobody booked, the Instructor being away from their mat',
    );
    expect(bookingNote({ day: 4, count: 0, turned: 0 }, 4.1)).toBe('Today’s class: nobody booked');
  });

  it('says how many class-goers a week come at this reputation, and the class days they are shared among', () => {
    expect(demandNote(21.2, 3)).toBe(
      'About 21 class-goers a week come for classes at this reputation, shared among 3 class days',
    );
    expect(demandNote(13, 1)).toBe(
      'About 13 class-goers a week come for classes at this reputation, all on its 1 class day',
    );
    expect(demandNote(13, 0)).toBe(
      'About 13 class-goers a week come for classes at this reputation, once a class day is switched on',
    );
    const { sim, s, teacher } = studio();
    s.reputation = 80;
    if (teacher) teacher.skill = 5;
    expect(sim.classLeader()?.interest).toBeCloseTo(weeklyInterest(80, 5));
  });
});

describe('how a class fills', () => {
  it('draws more for a better reputation and a more skilled Instructor: about 21 a week at 80% for an Expert', () => {
    const base = weeklyInterest(50, 2);
    expect(weeklyInterest(80, 2)).toBeGreaterThan(base);
    expect(weeklyInterest(50, 4)).toBeGreaterThan(base);
    expect(Math.round(weeklyInterest(80, 5))).toBe(21);
    expect(Math.round(weeklyInterest(100, 5))).toBe(25);
  });

  it('draws no more for more Practice Spots, which only let a class hold more', () => {
    /** The class booked at a studio with this many spots, at a middling reputation, led by an Expert. */
    const booked = (extra: (readonly [number, number])[]) => {
      const { sim, s, room, teacher } = studio();
      for (const [x, y] of extra) sim.placeItem('practice_spot', x, y, 0);
      s.reputation = 30;
      if (teacher) teacher.skill = 5;
      run(sim, 1);
      return { spots: s.items.filter((it) => it.type === 'practice_spot').length, booked: room.booked };
    };
    const few = booked([
      [8, 13],
      [5, 14],
      [6, 14],
    ]);
    const many = booked([
      [8, 13],
      [5, 14],
      [6, 14],
      [7, 14],
      [8, 14],
    ]);
    expect(many.spots).toBeGreaterThan(few.spots);
    expect(few.booked?.turned).toBe(0);
    expect(few.booked?.count).toBeLessThan(few.spots);
    expect(many.booked).toEqual(few.booked);
  });

  it('shares the week’s interest among its classes, up to the places there are, turning the rest away', () => {
    expect(classSize(12, 3, 6, 1)).toEqual({ count: 4, turned: 0 });
    expect(classSize(12, 1, 6, 1)).toEqual({ count: 6, turned: 6 });
    expect(classSize(12, 6, 6, 1)).toEqual({ count: 2, turned: 0 });
    expect(classSize(12, 0, 6, 1)).toEqual({ count: 6, turned: 6 });
  });
});

describe('how many an Instructor can lead', () => {
  it('rises with their rank, from 6 for a Trainee to 12 for an Expert', () => {
    expect([1, 2, 3, 4, 5].map(classPlaces)).toEqual([6, 8, 9, 11, 12]);
    expect(classPlaces(0)).toBe(6);
    expect(classPlaces(9)).toBe(12);
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
    const told = toasts(sim.drain());
    expect(told.some((t) => t.includes('can lead a class of 6'))).toBe(true);
    expect(told.some((t) => t.includes('class is full') && t.includes('switch on another class day'))).toBe(true);
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
    expect(placesNote(3, 6, 1)).toEqual({ text: 'Trainee Instructors lead up to 6' });
    expect(placesNote(8, 6, 1)).toEqual({
      icon: 'ui-warning',
      text: 'Only 6 of 8 spots are booked. Trainee Instructors lead up to 6: promote yours to fill more',
    });
    expect(placesNote(20, 16, 5)).toEqual({
      icon: 'ui-warning',
      text: 'Only 16 of 20 spots are booked. Expert Instructors lead up to 16',
    });
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

  it('keeps nobody come for treatment out, however many class-goers are in the building', () => {
    const { sim, s } = studio();
    s.open = true;
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    for (let i = 0; i < guestCap(ctx); i++) spawnGuest(ctx, undefined, false, 4);
    expect(s.guests.length).toBeGreaterThanOrEqual(guestCap(ctx));
    expect(guestsCounted(s)).toBe(0);
    s.spawnT = 0;
    admitGuests(ctx, 0.1);
    expect(s.guests.filter((g) => !g.classDay)).toHaveLength(1);
    expect(guestsCounted(s)).toBe(1);
  });

  it('still lets nobody new in while the guests come for treatment fill the building', () => {
    const { sim, s } = studio();
    s.open = true;
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    while (guestsCounted(s) < guestCap(ctx)) spawnGuest(ctx);
    s.spawnT = 0;
    admitGuests(ctx, 0.1);
    expect(guestsCounted(s)).toBe(guestCap(ctx));
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

  it.each([2, 3])('is announced as seldom in real time at %ix speed as at normal speed', (speed) => {
    const { sim, s } = studio();
    const called: number[] = [];
    let seconds = 0;
    s.speed = speed;
    while (seconds < DAY_SECONDS * CLASS_CALL_GAP * 3) {
      sim.tick(0.1);
      seconds += 0.1;
      if (sim.drain().some((e) => e.type === 'announce' && CLASS_LINES.includes(e.text))) called.push(seconds);
    }
    expect(called.length).toBeGreaterThan(1);
    for (const [i, at] of called.slice(1).entries())
      expect(at - (called[i] ?? 0)).toBeGreaterThanOrEqual(DAY_SECONDS * CLASS_CALL_GAP - 0.5);
  });

  it('counts a day at fastest speed as a third of a day toward the next call', () => {
    const { sim, s } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    s.open = true;
    ctx.classCallWait = 1;
    s.speed = 3;
    announceClasses(ctx);
    expect(ctx.classCallWait).toBeCloseTo(2 / 3);
    s.speed = 1;
    announceClasses(ctx);
    expect(ctx.classCallWait).toBe(0);
  });

  it('has the advisor ask for an Instructor while the studio has none', () => {
    const { sim } = studio(false);
    expect(advice((sim as unknown as { ctx: SimContext }).ctx)).toBe(
      'Your Qi Gong Studio is ready for its first class. Hire a Qi Gong Instructor to lead it.',
    );
  });

  it('is not booked while the Instructor is away past it, and the player is told why', () => {
    const { sim, s, room, teacher } = studio();
    if (!teacher) throw new Error('no Instructor');
    teacher.state = 'away';
    teacher.call = { client: 'A client', days: 3, back: s.day + 3, fee: 0 };
    run(sim, 1);
    expect(room.booked).toEqual({ day: 4, count: 0, turned: 0, away: true });
    expect(s.arrivals).toEqual([]);
    expect(toasts(sim.drain()).some((t) => t.includes('as ' + teacher.name + ' was away from their mat'))).toBe(true);
  });

  it('keeps class-goers due to set off at home while the Instructor is on a break, and lets them come once back', () => {
    const { sim, s, teacher } = studio();
    if (!teacher) throw new Error('no Instructor');
    s.open = true;
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    s.arrivals = [{ at: s.day, day: 4 }];
    teacher.state = 'onBreak';
    admitClassgoers(ctx);
    expect(s.arrivals).toEqual([]);
    expect(s.guests.some((g) => g.classDay)).toBe(false);
    s.arrivals = [{ at: s.day, day: 4 }];
    teacher.state = 'atPost';
    admitClassgoers(ctx);
    expect(s.guests.filter((g) => g.classDay)).toHaveLength(1);
  });

  it('books no more than the classes to come have places for, after the class-goers already waiting', () => {
    const { sim, s, room, teacher } = studio();
    if (!teacher) throw new Error('no Instructor');
    s.open = true;
    s.reputation = 100;
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    const spots = Math.min(s.items.filter((it) => it.type === 'practice_spot').length, classPlaces(teacher.skill));
    // Wednesday's and Friday's classes have places for twice the spots, and more than Wednesday's class can take are
    // already waiting for it: all but one place is spoken for
    for (let i = 0; i < spots * 2 - 1; i++) spawnGuest(ctx, undefined, false, 2);
    run(sim, 1);
    expect(room.booked).toMatchObject({ day: 4, count: 1 });
    expect(room.booked?.turned).toBeGreaterThan(0);
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
    sim.drain();
    runUntil(sim, () => s.reviews.some((r) => r.feelings.includes('no-class')), 60);
    expect(s.stats.classes).toBe(0);
    expect(s.ledger.classes).toBe(0);
    // the player is told why, once for all of them
    const told = toasts(sim.drain()).filter((t) => t.includes('went home disappointed'));
    expect(told).toHaveLength(1);
    expect(told[0]).toMatch(/class-goers? went home disappointed: there is no Qi Gong Instructor to lead Fri’s class/);
    const goer = s.guests.find((g) => g.classDay && g.missed);
    expect(goer?.missed).toBe('no-instructor');
    expect(goer && guestStatus(goer, sim)).toBe(
      'Going home without a class: there was no Instructor to lead the class',
    );
  });

  it('tells the player when its class-goers give up because their day came off the timetable', () => {
    const { sim, s, room } = studio();
    run(sim, 1);
    runUntil(sim, () => s.guests.some((g) => g.classDay), 60);
    sim.toggleClassDay(room.id, 4);
    sim.drain();
    runUntil(sim, () => s.guests.some((g) => g.missed), 6 * DAY_SECONDS);
    expect(s.guests.filter((g) => g.missed).every((g) => g.missed === 'off')).toBe(true);
    expect(toasts(sim.drain())).toContainEqual(
      expect.stringMatching(/went home disappointed: Fri’s class was taken off the timetable after they booked\.$/),
    );
  });

  it('notes a class day that passes without a class, and why', () => {
    const { sim, s, room, teacher } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    const mat = s.items.find((it) => it.type === 'instructor_mat');
    // Friday is over, with no class and the Instructor not yet at the mat
    if (teacher) teacher.state = 'toPost';
    s.day = 5;
    noteMissedClasses(ctx);
    expect(room.missed).toEqual([{ day: 4, why: 'no-lead' }]);
    // Monday is over, with the class before it still going
    s.day = 8;
    if (mat) mat.progress = 0.5;
    noteMissedClasses(ctx);
    expect(room.missed?.at(-1)).toEqual({ day: 7, why: 'overran' });
    // Wednesday is over, with the Instructor worn out and resting
    if (mat) mat.progress = 0;
    if (teacher) teacher.state = 'onBreak';
    s.day = 10;
    noteMissedClasses(ctx);
    expect(room.missed?.at(-1)).toEqual({ day: 9, why: 'break' });
    // not a class day, or a class held: nothing to note
    s.day = 13;
    noteMissedClasses(ctx);
    room.lastClass = 14;
    s.day = 15;
    noteMissedClasses(ctx);
    expect(room.missed).toHaveLength(3);
  });

  it('says why in a few words, and in full for the player', () => {
    expect(missNote('overran')).toBe('the class before was still going');
    expect(missToast(1, 3, 'late')).toBe(
      'A class-goer went home disappointed: they got to the studio after Thu’s class had finished.',
    );
    expect(missToast(4, 7, 'overran')).toBe(
      '4 class-goers went home disappointed: Mon’s class never started, as the class before it was still going.',
    );
    expect(missToast(1, 2, 'break')).toBe(
      'A class-goer went home disappointed: Wed’s class never started, as the Instructor was worn out and on a break. A Staff Room nearer the studio gets them back sooner.',
    );
    expect(missNote('full')).toBe('every Practice Spot was taken');
    expect(missToast(2, 9, 'full')).toBe(
      '2 class-goers went home disappointed: every Practice Spot was taken by the time they got to Wed’s class. Another class day, or more spots, would fit them in.',
    );
  });

  it('puts class-goers left waiting when every spot was taken down for the next class, and they have it', () => {
    const { sim, s } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    // Friday's class booked, and three more for it than that, more than its three spots
    run(sim, 1);
    for (let i = 0; i < 3; i++) spawnGuest(ctx, undefined, false, 4);
    runUntil(sim, () => s.stats.classes > 0, 6 * DAY_SECONDS);
    const left = s.guests.filter((g) => g.goal === 'class' && g.state !== 'leaving');
    expect(left.length).toBeGreaterThan(0);
    // Monday's
    expect(left.every((g) => g.classDay === 7 && !g.missed)).toBe(true);
    runUntil(sim, () => s.stats.classes > 1, 6 * DAY_SECONDS);
    expect(left.every((g) => g.outcome === 'class' && !g.missed)).toBe(true);
  });

  it('keeps class-goers in early for a later class off the spots while anyone for the class before is in line', () => {
    const { sim, s, room } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    const spot = s.items.find((it) => it.type === 'practice_spot');
    if (!spot) throw new Error('no Practice Spot');
    const monday = { classDay: 7 } as Guest;
    // Friday morning, with Friday's class still to hold and nobody in for it: Monday's may take a free spot
    s.day = 4.1;
    expect(dueForSpot(ctx, spot, monday)).toBe(true);
    // someone in line for Friday's comes first
    const friday = spawnGuest(ctx, undefined, false, 4);
    if (!friday) throw new Error('no class-goer');
    expect(s.items.some((it) => it.queue.includes(friday.id))).toBe(true);
    expect(dueForSpot(ctx, spot, friday)).toBe(true);
    expect(dueForSpot(ctx, spot, monday)).toBe(false);
    // once Friday's has been held, Monday's is next
    room.lastClass = 4;
    expect(dueForSpot(ctx, spot, monday)).toBe(true);
    // anyone else at a spot is called as ever
    expect(dueForSpot(ctx, spot, { classDay: 0 } as Guest)).toBe(true);
  });

  it('keeps the Instructor from a drink while class-goers wait at the studio, until close to fed up', () => {
    const { sim, s, teacher } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    if (!teacher) throw new Error('no Instructor');
    const mat = s.items.find((it) => it.type === 'instructor_mat');
    if (!mat) throw new Error('no Instructor’s Mat');
    // a water cooler near the studio
    const placed = [...Array(12).keys()].some((dy) =>
      [...Array(12).keys()].some((dx) => !!sim.placeItem('water_cooler', 2 + dx, 6 + dy, 0)),
    );
    expect(placed).toBe(true);
    teacher.energy = 100;
    teacher.thirst = 70;
    expect(wantsAway(ctx, teacher, mat)).toBe(true);
    // a class-goer in line at a spot: the class comes first
    const g = spawnGuest(ctx, undefined, false, 4);
    if (!g) throw new Error('no class-goer');
    expect(wantsAway(ctx, teacher, mat)).toBe(false);
    teacher.thirst = STAFF_NEED_HOLD;
    expect(wantsAway(ctx, teacher, mat)).toBe(true);
  });

  it('lets class-goers walk in without losing patience', () => {
    const { sim } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    const g = spawnGuest(ctx, undefined, false, 4);
    if (!g) throw new Error('no class-goer');
    runUntil(sim, () => g.state !== 'toWait' && g.state !== 'enter', 3 * DAY_SECONDS);
    expect(g.lowest).toBe(100);
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

describe("an Instructor's breaks", () => {
  it('counts the days to the next class still to hold, today if it has not been held', () => {
    const { sim, s, room } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    // a Wednesday, its class not yet held; then held, with Friday's next
    s.day = 2.3;
    expect(daysToClass(ctx)).toBe(0);
    room.lastClass = 2;
    expect(daysToClass(ctx)).toBe(2);
    // a Sunday, the day before Monday's
    s.day = 6.5;
    expect(daysToClass(ctx)).toBe(1);
    // with the classes off, there is none
    sim.setDiscipline('qigong', false);
    expect(daysToClass(ctx)).toBe(Infinity);
  });

  it('holds off a break until the class is over, unless worn right out, and takes it early when the days allow', () => {
    const { sim, s, room, teacher, therapist } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    if (!teacher) throw new Error('no Instructor');
    // Wednesday, the class still to come: tired, but not too tired to lead it
    s.day = 2.3;
    teacher.energy = BREAK_AT - 3;
    expect(restDue(ctx, teacher)).toBe(false);
    teacher.energy = BREAK_EXHAUSTED - 1;
    expect(restDue(ctx, teacher)).toBe(true);
    // anyone else takes their break as the policy says
    therapist.energy = BREAK_AT - 3;
    expect(restDue(ctx, therapist)).toBe(true);
    // Saturday, Friday's class over and Monday's two days off: a break now, a little early
    room.lastClass = 4;
    s.day = 5.2;
    teacher.energy = BREAK_AT + REST_AHEAD - 1;
    expect(restDue(ctx, teacher)).toBe(true);
    teacher.energy = BREAK_AT + REST_AHEAD + 1;
    expect(restDue(ctx, teacher)).toBe(false);
    // Sunday, with Monday's class tomorrow: too late to start one, unless worn right out
    s.day = 6.2;
    teacher.energy = BREAK_AT - 3;
    expect(restDue(ctx, teacher)).toBe(false);
    teacher.energy = BREAK_EXHAUSTED - 1;
    expect(restDue(ctx, teacher)).toBe(true);
  });

  it('gets up in time to walk back for the next class, rested enough, or else rests in full', () => {
    const { sim, s, room, teacher } = studio();
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    if (!teacher) throw new Error('no Instructor');
    room.lastClass = 4;
    // half a day's walk back, for Monday's class, which must start before Monday is over
    const walk = DAY_SECONDS / 2;
    const last = 8 - REST_RETURN - 0.5;
    teacher.energy = BREAK_AT + REST_AHEAD;
    s.day = last - 0.1;
    expect(backForClass(ctx, teacher, walk)).toBe(true);
    // not yet rested enough
    teacher.energy = BREAK_AT + REST_AHEAD - 1;
    expect(backForClass(ctx, teacher, walk)).toBe(false);
    // too soon to go
    teacher.energy = 60;
    s.day = last - 1;
    expect(backForClass(ctx, teacher, walk)).toBe(false);
    // too late to make it anyway
    s.day = last + 0.1;
    expect(backForClass(ctx, teacher, walk)).toBe(false);
  });

  it('leads a class tired, calling its class-goers to their spots, and rests after it', () => {
    const { sim, s, room, teacher } = studio();
    addStaffRoom(sim);
    if (!teacher) throw new Error('no Instructor');
    run(sim, 1);
    // tired enough for a break by the policy all the while, until Friday's class is over
    runUntil(
      sim,
      () => {
        teacher.energy = BREAK_AT - 2;
        const over = room.lastClass === 4 && !s.items.find((it) => it.type === 'instructor_mat')?.progress;
        // they may set off the moment the class ends
        if (!over) expect(teacher.state).not.toBe('toBreak');
        return over;
      },
      4 * DAY_SECONDS,
    );
    expect(s.stats.classgoers).toBeGreaterThan(0);
    // and then straight to the Staff Room, with the weekend to rest in
    runUntil(sim, () => teacher.state === 'toBreak', DAY_SECONDS);
    expect(daysToClass((sim as unknown as { ctx: SimContext }).ctx)).toBeGreaterThanOrEqual(2);
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

describe('an Instructor who leaves mid-class', () => {
  it('calls the class off, so it can start again for the next one the same day', () => {
    const { sim, s, room, teacher } = studio();
    if (!teacher) throw new Error('no Instructor');
    const mat = s.items.find((it) => it.type === 'instructor_mat');
    if (!mat) throw new Error('no Instructor’s Mat');
    mat.progress = 0.5;
    room.lastClass = Math.floor(s.day);
    sim.fire(teacher.id);
    expect(mat.progress).toBe(0);
    expect(room.lastClass).toBeUndefined();
  });
});

describe('booking a class', () => {
  it('goes ahead while the Instructor is off for a drink, which is over long before the class', () => {
    const { sim, room, teacher } = studio();
    if (!teacher) throw new Error('no Instructor');
    teacher.state = 'toJob';
    teacher.job = { kind: 'refresh', id: 0 };
    run(sim, 1);
    expect(room.booked?.day).toBe(4);
    expect(room.booked?.away).toBeUndefined();
  });

  it('waits for an Instructor on a break too long to be back in time', () => {
    const { sim, teacher } = studio();
    if (!teacher) throw new Error('no Instructor');
    teacher.state = 'onBreak';
    teacher.energy = 0;
    // a Staff Room a long way off
    teacher.timer = 3 * DAY_SECONDS;
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    expect(awayForClass(ctx, teacher, 4)).toBe(true);
    teacher.timer = 1;
    expect(awayForClass(ctx, teacher, 4)).toBe(false);
  });
});
