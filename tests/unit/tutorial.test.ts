// The tutorial walks a new Willow Lane game through its opening a step at a time, then the first game's heads-ups, and
// hands over once all of it is done; it can be skipped, and stays away from any game it was not switched on for.
import { describe, expect, it } from 'vitest';

import { QUIT_AFTER } from '../../src/core/data';
import type { Sim } from '../../src/core/sim/sim';
import { HANDOFF, LOOK_DAYS } from '../../src/core/sim/tutorial';
import {
  addConsult,
  addMassage,
  addStaffRoom,
  addTraining,
  freshSim,
  hire,
  openCenter,
  run,
  runUntil,
  toasts,
} from './helpers';

/** A new game with the tutorial on, as a first Willow Lane game starts. */
function tutorialGame() {
  const sim = freshSim();
  sim.s.money = 100_000;
  sim.s.tutorial = sim.s.lessons = true;
  sim.s.primer = true;
  return sim;
}

/** The id of the step in hand. */
const stepOf = (sim: Sim) => sim.tutorialStepId();

/** Put down the Benches the opening asks for, in the corridor by the desk. */
function placeBenches(sim: Sim) {
  expect(sim.placeItem('bench', 20, 10, 0)).not.toBeNull();
  expect(sim.placeItem('bench', 22, 10, 0)).not.toBeNull();
}

/** Walk the opening through, up to the Benches, and open the center. */
function walkOpening(sim: Sim) {
  sim.noteLooked();
  sim.placeItem('reception_desk', 14, 13, 0);
  hire(sim, 'receptionist');
  addConsult(sim);
  hire(sim, 'consultant');
  addMassage(sim);
  hire(sim, 'therapist');
  run(sim, 1);
}

describe('the tutorial', () => {
  it('lists the opening, then the heads-ups, in order', () => {
    const sim = tutorialGame();
    const lines = sim.tutorialLines();
    expect(lines.map((l) => l.id)).toEqual([
      'look',
      'desk',
      'receptionist',
      'consult',
      'consultant',
      'massage',
      'therapist',
      'benches',
      'caretaker',
      'smudging',
      'staffroom',
    ]);
    expect(lines.filter((l) => l.current).map((l) => l.id)).toEqual(['look']);
    expect(lines.every((l) => !l.done)).toBe(true);
  });

  it('moves on a step as each thing is built or hired, the advisor showing the step in hand', () => {
    const sim = tutorialGame();
    const of = sim.tutorialLines().length;
    expect(sim.adviceNote()).toMatchObject({
      label: 'Tutorial',
      step: { id: 'look', n: 1, of, want: { kind: 'look' } },
    });
    sim.noteLooked();
    expect(sim.tutorialStep()).toMatchObject({ id: 'desk', n: 2, want: { kind: 'item', type: 'reception_desk' } });
    sim.placeItem('reception_desk', 14, 13, 0);
    expect(sim.tutorialStep()).toMatchObject({ id: 'receptionist', want: { kind: 'hire', role: 'receptionist' } });
    hire(sim, 'receptionist');
    expect(sim.tutorialStep()).toMatchObject({ id: 'consult', want: { kind: 'room', type: 'consult' } });
    addConsult(sim);
    expect(stepOf(sim)).toBe('consultant');
    hire(sim, 'consultant');
    expect(sim.tutorialStep()).toMatchObject({ id: 'massage', want: { kind: 'room', type: 'massage' } });
    addMassage(sim);
    expect(stepOf(sim)).toBe('therapist');
    expect(sim.adviceNote().step?.id).toBe('therapist');
    hire(sim, 'therapist');
    // the Benches wait for the center to open
    expect(stepOf(sim)).toBeNull();
    run(sim, 1);
    expect(sim.s.open).toBe(true);
    expect(sim.tutorialStep()).toMatchObject({ id: 'benches', n: 8, want: { kind: 'item', type: 'bench' } });
    sim.placeItem('bench', 20, 10, 0);
    expect(stepOf(sim)).toBe('benches');
    sim.placeItem('bench', 22, 10, 0);
    expect(
      sim
        .tutorialLines()
        .slice(0, 8)
        .every((l) => l.done),
    ).toBe(true);
  });

  it('counts looking around done after a couple of days, if the camera is never moved', () => {
    const sim = tutorialGame();
    runUntil(sim, () => sim.s.day >= LOOK_DAYS - 0.01, 3000);
    expect(stepOf(sim)).toBe('look');
    run(sim, 1);
    expect(stepOf(sim)).toBe('desk');
  });

  it('follows the opening with the heads-ups, each with its text and what it points at', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    placeBenches(sim);
    // nothing is due until the first guest is healed
    expect(stepOf(sim)).toBeNull();
    sim.s.stats.healed = 1;
    expect(sim.tutorialStep()).toMatchObject({
      id: 'caretaker',
      n: 9,
      title: 'Hire a Caretaker',
      text: expect.stringMatching(/Hire a Caretaker from the Hire menu/),
      want: { kind: 'hire', role: 'caretaker' },
    });
    expect(sim.adviceNote()).toMatchObject({ label: 'Tutorial', step: { id: 'caretaker' } });
    const caretaker = hire(sim, 'caretaker');
    expect(sim.tutorialStep()).toMatchObject({
      id: 'smudging',
      text: expect.stringMatching(/Build a Training Room/),
      want: { kind: 'room', type: 'training' },
    });
    addTraining(sim);
    const step = sim.tutorialStep();
    expect(step).toMatchObject({ id: 'smudging', about: { kind: 'staff', id: caretaker.id } });
    expect(step?.want).toBeUndefined();
    caretaker.general.push('smudging');
    expect(stepOf(sim)).toBeNull();
    sim.s.staff[0]!.energy = 10;
    expect(sim.tutorialStep()).toMatchObject({ id: 'staffroom', want: { kind: 'room', type: 'staffroom' } });
  });

  it('notes the heads-ups as said without a word of their own, since its card says them', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    sim.s.stats.healed = 1;
    sim.drain();
    run(sim, 1.5);
    expect(sim.s.seenTips).toContain('primer-caretaker');
    expect(toasts(sim.drain()).filter((t) => t.includes('Hire a Caretaker'))).toEqual([]);
  });

  it('hands over once, once every step is done, ending the heads-ups without their own word', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    placeBenches(sim);
    hire(sim, 'caretaker').general.push('smudging');
    addStaffRoom(sim);
    sim.drain();
    run(sim, 1.5);
    expect(sim.s.tutorial).toBe(false);
    expect(sim.s.primer).toBe(false);
    // the cards that explain things carry on
    expect(sim.s.lessons).toBe(true);
    const events = sim.drain();
    expect(toasts(events)).toContain(HANDOFF);
    expect(toasts(events)).not.toContainEqual(expect.stringMatching(/everything it needs to get going/));
    expect(events).toContainEqual({ type: 'tutorial', what: 'done', step: 'staffroom' });
    run(sim, 5);
    expect(toasts(sim.drain())).not.toContain(HANDOFF);
    expect(sim.tutorialLines()).toEqual([]);
  });

  it('can be skipped, the cards that explain things with it, saying how to have it back', () => {
    const sim = tutorialGame();
    sim.noteLooked();
    sim.drain();
    sim.skipTutorial();
    expect(sim.s.tutorial).toBe(false);
    expect(sim.s.lessons).toBe(false);
    const events = sim.drain();
    expect(toasts(events)).toEqual(['The tutorial is off. Settings turns it back on.']);
    expect(events).toContainEqual({ type: 'tutorial', what: 'skipped', step: 'desk' });
    expect(sim.adviceNote().step).toBeUndefined();
    expect(sim.adviceNote().text).toMatch(/^Welcome! Open the Items menu/);
    // the heads-ups of a first game carry on without it
    expect(sim.s.primer).toBe(true);
  });

  it('can be switched back on in the game', () => {
    const sim = tutorialGame();
    sim.setTutorial(false);
    expect(sim.tutorialLines()).toEqual([]);
    sim.setTutorial(true);
    expect(sim.s.lessons).toBe(true);
    expect(stepOf(sim)).toBe('look');
  });

  it('stays away from a game it is not on in', () => {
    const { sim, s } = openCenter(1);
    s.primer = true;
    s.stats.healed = 1;
    expect(sim.tutorialLines()).toEqual([]);
    expect(sim.tutorialStep()).toBeNull();
    expect(sim.adviceNote()).toMatchObject({ label: 'Coming up' });
    expect(sim.adviceNote().step).toBeUndefined();
  });

  it('gives way to a nudge that cannot wait', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    const therapist = sim.s.staff.find((st) => st.role === 'therapist')!;
    therapist.morale = 0;
    therapist.unhappyT = QUIT_AFTER;
    expect(sim.aboutToQuit(therapist)).toBe(true);
    expect(sim.adviceNote().text).toMatch(/is about to quit/);
    expect(sim.adviceNote().step).toBeUndefined();
  });
});
