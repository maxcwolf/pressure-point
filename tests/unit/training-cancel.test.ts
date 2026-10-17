// Calling a member of staff off their course before it is finished, for the fee back.
import { describe, expect, it } from 'vitest';

import { GENERAL_COURSES } from '../../src/core/data';
import { netOf } from '../../src/core/sim/economy';
import { Sim } from '../../src/core/sim/sim';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { addTraining, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** A receptionist a little way into the Service course, sat at the Training Room's desk. */
function studying() {
  const { sim, s, receptionist } = openCenter(1);
  addTraining(sim);
  receptionist.general = [];
  const money = s.money;
  const fees = s.ledger.training;
  const net = netOf(s.ledger);
  expect(sim.train(receptionist.id, 'service')).toBe(true);
  runUntil(sim, () => receptionist.state === 'training' && receptionist.training!.progress > 0.05, 300);
  return { sim, s, st: receptionist, money, fees, net };
}

/** The game saved and loaded again, as the save files do it. */
function reload(sim: Sim): Sim {
  const s = JSON.parse(JSON.stringify(sim.s)) as GameState;
  upgradeSave(s);
  return new Sim(s);
}

/** The Study Desk in the Training Room. */
const deskOf = (sim: Sim) => sim.s.items.find((i) => i.type === 'study_desk')!;

describe('cancelling a course', () => {
  it('gives back the whole fee, off the training costs, so the books are as if it had never been taken', () => {
    const { sim, s, st, money, fees, net } = studying();
    expect(s.money).toBe(money - GENERAL_COURSES.service.cost);
    sim.drain();
    expect(sim.cancelTraining(st.id)).toBe(true);
    expect(s.money).toBe(money);
    expect(s.ledger.training).toBe(fees);
    expect(netOf(s.ledger)).toBe(net);
    expect(toasts(sim.drain())).toContain(
      `${st.name} has left the Customer Service course. $${GENERAL_COURSES.service.cost} refunded.`,
    );
  });

  it('frees the Study Desk and sends them back to work, without the qualification', () => {
    const { sim, st } = studying();
    expect(deskOf(sim).users).toContain(st.id);
    sim.cancelTraining(st.id);
    expect(st.training).toBeNull();
    expect(st.claimItem).toBe(0);
    expect(deskOf(sim).users).not.toContain(st.id);
    expect(inconsistencies(sim)).toEqual([]);
    run(sim, 60);
    expect(st.general).not.toContain('service');
    expect(st.state).not.toMatch(/train/i);
    expect(st.post, 'back at reception').toBeGreaterThan(0);
  });

  it('can be called off on the way to the desk too, and the desk is free for someone else', () => {
    const { sim, s, receptionist, therapist } = openCenter(1);
    addTraining(sim);
    receptionist.general = [];
    therapist.general = [];
    const money = s.money;
    expect(sim.train(receptionist.id, 'service')).toBe(true);
    expect(receptionist.state).toBe('toTrain');
    expect(sim.cancelTraining(receptionist.id)).toBe(true);
    expect(s.money).toBe(money);
    expect(sim.train(therapist.id, 'stamina'), 'the one desk is free again').toBe(true);
  });

  it('refuses anyone not on a course, or leaving', () => {
    const { sim, s, consultant, receptionist } = openCenter(1);
    addTraining(sim);
    const money = s.money;
    expect(sim.cancelBlocker(consultant)).toBe('Not on a course.');
    expect(sim.cancelTraining(consultant.id)).toBe(false);
    expect(sim.cancelTraining(9999)).toBe(false);
    receptionist.general = [];
    sim.train(receptionist.id, 'service');
    receptionist.state = 'leaving';
    expect(sim.cancelBlocker(receptionist)).toBe('They are leaving.');
    expect(sim.cancelTraining(receptionist.id)).toBe(false);
    expect(s.money).toBe(money - GENERAL_COURSES.service.cost);
  });

  it('works on a game saved mid-course and loaded again', () => {
    const { sim, money, fees } = studying();
    const loaded = reload(sim);
    const st = loaded.s.staff.find((x) => x.role === 'receptionist')!;
    expect(st.training).toMatchObject({ course: 'service', cost: GENERAL_COURSES.service.cost });
    run(loaded, 5);
    expect(st.state).toBe('training');
    expect(loaded.cancelTraining(st.id)).toBe(true);
    expect(loaded.s.money).toBe(money);
    expect(loaded.s.ledger.training).toBe(fees);
    expect(deskOf(loaded).users).not.toContain(st.id);
    expect(inconsistencies(loaded)).toEqual([]);
  });

  it('leaves a game that saves and loads cleanly afterwards, with no course and no second refund', () => {
    const { sim, st, money } = studying();
    sim.cancelTraining(st.id);
    const loaded = reload(sim);
    const again = loaded.s.staff.find((x) => x.id === st.id)!;
    expect(again.training).toBeNull();
    expect(again.claimItem).toBe(0);
    expect(loaded.s.money).toBe(money);
    expect(loaded.cancelTraining(again.id)).toBe(false);
    expect(inconsistencies(loaded)).toEqual([]);
    run(loaded, 60);
    expect(loaded.s.staff.find((x) => x.id === st.id)!.general).not.toContain('service');
    expect(inconsistencies(loaded)).toEqual([]);
  });
});
