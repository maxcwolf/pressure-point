// A house call taken by someone in the middle of a treatment: they finish it, take nobody more, then set off.

import { describe, expect, it, vi } from 'vitest';

import { CALL_PER_DAY } from '../../src/core/data';
import { canGo } from '../../src/core/sim/calls';
import type { Sim } from '../../src/core/sim/sim';
import type { HouseCall } from '../../src/core/state/types';
import { callWaitNote } from '../../src/ui/lib/calls';
import { staffStatus } from '../../src/ui/lib/status';
import { addTraining, hire, inconsistencies, openCenter, run, runUntil } from './helpers';

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
    expect(sim.trainBlocker(therapist, course)).toMatch(/house call/);
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
