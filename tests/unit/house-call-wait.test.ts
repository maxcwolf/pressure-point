// A house call taken by someone in the middle of a treatment: they finish it, take nobody more, then set off.

import { describe, expect, it, vi } from 'vitest';

import { CALL_PER_DAY, SESSION_WAIT } from '../../src/core/data';
import { canGo } from '../../src/core/sim/calls';
import { awayForClass } from '../../src/core/sim/classes';
import { createContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import type { Sim } from '../../src/core/sim/sim';
import type { HouseCall } from '../../src/core/state/types';
import { callWaitNote } from '../../src/ui/lib/calls';
import { staffStatus } from '../../src/ui/lib/status';
import { addQigong, addSound, addTraining, hire, inconsistencies, openCenter, run, runUntil } from './helpers';

/** A one-day house call for a massage therapist, on offer now. */
const offer = (day: number): HouseCall => ({
  client: 'the Grand Hotel',
  days: 1,
  perDay: CALL_PER_DAY,
  discipline: 'massage',
  deadline: day + 6,
});

/** The center's massage table. */
const table = (sim: Sim) => sim.s.items.find((it) => it.type === 'massage_table')!;

/** A center whose therapist has a guest on the table, part way through their treatment. */
function midTreatment() {
  const c = openCenter(1);
  const { sim } = c;
  const massage = table(c.sim);
  runUntil(sim, () => sim.s.guests.find((g) => g.id === massage.serving)?.state === 'served', 600);
  run(sim, 0.5);
  const guest = sim.s.guests.find((g) => g.id === massage.serving)!;
  expect(guest.state).toBe('served');
  expect(massage.progress).toBeGreaterThan(0);
  return { ...c, massage, guest };
}

describe('a house call taken in the middle of a treatment', () => {
  it('waits for the treatment to finish and pay, calls nobody more, then sets off', () => {
    const { sim, s, massage, therapist, guest } = midTreatment();
    s.callOffer = offer(s.day);
    const fee = sim.callFee(therapist);
    expect(sim.callWait(therapist)).toBe('treatment');
    const earned = s.ledger.treatment;
    expect(sim.acceptCall(therapist.id)).toBe(true);
    expect(s.callOffer).toBeNull();
    // still at the table, the guest still on it
    expect(therapist.state).toBe('atPost');
    expect(therapist.call?.due).toBeDefined();
    expect(guest.state).toBe('served');
    expect(staffStatus(therapist, sim)).toBe('Finishing up, then off on a house call to the Grand Hotel');
    // nobody new is called to the table while they finish
    runUntil(
      sim,
      () => {
        expect([0, guest.id]).toContain(massage.serving);
        return therapist.state !== 'atPost';
      },
      60,
    );
    expect(therapist.state).toBe('toCall');
    expect(therapist.call?.due).toBeUndefined();
    // the treatment was finished: the guest was seen to, and paid if it worked
    expect(guest.outcome === 'healed' || guest.outcome === 'failed').toBe(true);
    if (guest.outcome === 'healed') expect(s.ledger.treatment).toBeGreaterThan(earned);
    expect(massage.serving).toBe(0);
    // the days away count from leaving the building, not from taking the call
    runUntil(sim, () => therapist.state === 'away', 60);
    expect(therapist.call?.back).toBeCloseTo(s.day + 1, 1);
    expect(inconsistencies(sim)).toEqual([]);
    runUntil(sim, () => therapist.state !== 'away', 60);
    expect(therapist.call).toBeNull();
    expect(s.ledger.calls).toBe(fee);
  });

  it('is not sent twice: someone with a call to go on cannot take another', () => {
    const { sim, s, therapist } = midTreatment();
    s.callOffer = offer(s.day);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    s.callOffer = offer(s.day);
    expect(canGo(therapist, s.callOffer)).toBe(false);
    expect(sim.whoCanGo()).not.toContain(therapist);
    expect(sim.acceptCall(therapist.id)).toBe(false);
    expect(s.callOffer).not.toBeNull();
  });

  it('is not lost if they are let go before they set off: it goes back on offer', () => {
    const { sim, s, therapist } = midTreatment();
    const other = hire(sim, 'therapist');
    s.callOffer = offer(s.day);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    runUntil(sim, () => other.state !== 'arriving', 120);
    expect(therapist.call?.due, 'still finishing').toBeDefined();
    s.day = s.day + 7;
    sim.fire(therapist.id);
    expect(therapist.call).toBeNull();
    expect(s.callOffer.client).toBe('the Grand Hotel');
    // with a day left to choose someone else, though its own time was up
    expect(s.callOffer.deadline).toBeCloseTo(s.day + 1, 5);
    expect(sim.whoCanGo()).toContain(other);
  });

  it('cannot be cut short by a course meanwhile', () => {
    const { sim, s, therapist } = midTreatment();
    addTraining(sim);
    s.callOffer = offer(s.day);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    const course = sim.courses(therapist)[0]!;
    expect(sim.trainBlocker(therapist, course)).toBe('They are off on a house call once this treatment is done.');
    expect(sim.train(therapist.id, course.id)).toBe(false);
  });

  it('still goes ahead if the way out is lost while they finish', () => {
    const { sim, s, therapist } = midTreatment();
    s.callOffer = offer(s.day);
    const fee = sim.callFee(therapist);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    const lost = vi.spyOn(sim.world, 'findPath').mockReturnValue(null);
    runUntil(sim, () => therapist.state !== 'atPost', 60);
    lost.mockRestore();
    expect(therapist.state).toBe('away');
    runUntil(sim, () => therapist.state !== 'away', 60);
    expect(s.ledger.calls).toBe(fee);
  });
});

describe('a house call taken in the middle of a class', () => {
  it('counts the Instructor away from when the class is done, not from when it was taken', () => {
    const { sim, s, therapist: teacher } = openCenter(1);
    s.stars = 1;
    addQigong(sim);
    const lead = s.items.find((it) => it.type === 'instructor_mat')!;
    Object.assign(teacher, { post: lead.id, energy: 100, morale: 60 });
    lead.progress = 0.1;
    s.day = 10;
    const due = { ...offer(s.day), days: 2 };
    teacher.call = { client: due.client, days: 2, back: s.day + 2, fee: 0, due };
    const ctx = createContext(s);
    // a class whose class-goers set off half a day before the day after the call would be over, if it were over then
    expect(awayForClass(ctx, teacher, 11.6)).toBe(true);
    // once they have set off, the call's own day back is the one that counts
    delete teacher.call.due;
    expect(awayForClass(ctx, teacher, 11.6)).toBe(false);
  });
});

describe('a house call taken with guests lying on the mats for a sound bath', () => {
  it('starts the session for them at once rather than stand them up, and sets off when it is over', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    addSound(sim);
    const healer = hire(sim, 'healer');
    const bowls = s.items.find((it) => it.type === 'singing_bowls')!;
    const mat = s.items.find((it) => it.type === 'sound_mat')!;
    Object.assign(healer, { state: 'atPost', post: bowls.id, path: null });
    bowls.staffId = healer.id;
    const g = spawnGuest(createContext(s), 'tune')!;
    Object.assign(g, { state: 'served', goal: 'treat', diagnosis: 1, station: mat.id, path: null });
    mat.serving = g.id;
    // lying down, the session not yet started as it waits for the mats to fill
    expect(bowls.progress).toBeLessThan(SESSION_WAIT);
    expect(sim.callWait(healer)).toBe('session');
    s.callOffer = { ...offer(s.day), discipline: 'sound' };
    expect(sim.acceptCall(healer.id)).toBe(true);
    expect(healer.state).toBe('atPost');
    expect(sim.trainBlocker(healer, sim.courses(healer)[0]!)).toBe(
      'They are off on a house call once this session is done.',
    );
    sim.tick(0.1);
    expect(bowls.progress).toBeGreaterThanOrEqual(SESSION_WAIT);
    expect(g.state).toBe('served');
    runUntil(sim, () => healer.state !== 'atPost', 120);
    // set down where the street cannot be walked to, they are simply gone
    expect(['toCall', 'away']).toContain(healer.state);
    expect(g.outcome === 'healed' || g.outcome === 'failed').toBe(true);
  });
});

describe('a house call taken with a guest only called over', () => {
  it('sends the guest back to the line and sets off at once', () => {
    const { sim, s, therapist } = openCenter(1);
    const massage = table(sim);
    runUntil(sim, () => sim.s.guests.find((g) => g.id === massage.serving)?.state === 'called', 600);
    const guest = s.guests.find((g) => g.id === massage.serving)!;
    expect(sim.callWait(therapist)).toBeNull();
    s.callOffer = offer(s.day);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    expect(therapist.state).toBe('toCall');
    expect(therapist.call?.due).toBeUndefined();
    expect(['waiting', 'toWait']).toContain(guest.state);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('the offer card', () => {
  it('says who would finish a treatment first', () => {
    expect(callWaitNote('treatment')).toBe('Goes once this treatment is done');
    expect(callWaitNote('class')).toBe('Goes once this class is done');
    expect(callWaitNote(null)).toBeNull();
  });
});
