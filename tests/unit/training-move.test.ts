// Courses carry on when the Training Room, or its desk, is moved while someone is studying.
import { describe, expect, it } from 'vitest';

import { GENERAL_COURSES } from '../../src/core/data';
import { placeLayout } from '../../src/core/room-layout';
import { addTraining, inconsistencies, openCenter, run, runUntil } from './helpers';

/** Floor in the standard test center that nothing is built on. */
const FREE = { x: 17, y: 5 };

/** A receptionist a little way into the Service course, sat at the Training Room's desk. */
function studying() {
  const { sim, s, receptionist } = openCenter(1);
  const training = addTraining(sim);
  receptionist.general = [];
  const fees = s.ledger.training;
  expect(sim.train(receptionist.id, 'service')).toBe(true);
  runUntil(sim, () => receptionist.state === 'training' && receptionist.training!.progress > 0.05, 300);
  return { sim, s, st: receptionist, training, fees };
}

describe('moving a Training Room mid-course', () => {
  it('keeps the course, its progress and its fee, and the student goes back to a desk to finish it', () => {
    const { sim, s, st, training, fees } = studying();
    const money = s.money;
    const progress = st.training!.progress;
    expect(sim.moveRoom(training.id, placeLayout(sim.roomLayout(training), FREE.x, FREE.y))).toBe(true);
    expect(st.training).toMatchObject({ course: 'service', progress });
    expect(st.state).toBe('toTrain');
    expect(sim.world.item(st.claimItem)?.type).toBe('study_desk');
    expect(s.money, 'no refund, so nothing to pay again').toBe(money);
    expect(inconsistencies(sim)).toEqual([]);
    runUntil(sim, () => st.state === 'training', 120);
    expect(st.training!.progress, 'carries on from where it was').toBeGreaterThanOrEqual(progress);
    runUntil(sim, () => st.general.includes('service'), 600);
    expect(s.ledger.training - fees, 'paid for once').toBe(GENERAL_COURSES.service.cost);
  });

  it('keeps the course when only the desk is moved', () => {
    const { sim, s, st, fees } = studying();
    const progress = st.training!.progress;
    const desk = s.items.find((i) => i.type === 'study_desk')!;
    expect(sim.moveItem(desk.id, 7, 13, desk.rot)).toBe(true);
    expect(st.training).toMatchObject({ course: 'service', progress });
    expect(st.state).toBe('toTrain');
    expect(inconsistencies(sim)).toEqual([]);
    runUntil(sim, () => st.general.includes('service'), 600);
    expect(s.ledger.training - fees).toBe(GENERAL_COURSES.service.cost);
  });

  it('still drops the course and gives the fee back when the room is demolished', () => {
    const { sim, s, st, training, fees } = studying();
    sim.removeRoom(training.id, 0);
    expect(st.training).toBeNull();
    expect(st.claimItem).toBe(0);
    expect(s.ledger.training).toBe(fees);
    expect(inconsistencies(sim)).toEqual([]);
    run(sim, 5);
    expect(st.state).not.toMatch(/train/i);
  });
});
