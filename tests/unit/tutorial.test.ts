// The tutorial walks a new Willow Lane game through its opening a step at a time, then the first game's heads-ups, and
// hands over once all of it is done; it can be skipped, and stays away from any game it was not switched on for.
import { beforeEach, describe, expect, it } from 'vitest';

import { QUIT_AFTER } from '../../src/core/data';
import { primerTip } from '../../src/core/sim/primer';
import type { Sim } from '../../src/core/sim/sim';
import { HANDOFF, LOOK_DAYS, wantsHire } from '../../src/core/sim/tutorial';
import { loadTutorialPref, saveTutorialPref } from '../../src/storage/settings';
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

/** Tick off the last heads-up, on the land for sale: its word given at the first star, and the plots looked over. */
function seeLand(sim: Sim) {
  sim.s.seenTips.push(primerTip('land'));
  sim.s.sawPlots = true;
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
      'pause',
      'desk',
      'receptionist',
      'consult',
      'consultant',
      'massage',
      'therapist',
      'play',
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
    expect(sim.tutorialStep()).toMatchObject({ id: 'pause', n: 2, want: { kind: 'pause' } });
    sim.s.speed = 0;
    expect(sim.tutorialStep()).toMatchObject({ id: 'desk', n: 3, want: { kind: 'item', type: 'reception_desk' } });
    // the clock started again with nothing built asks to be paused again; with the desk down it does not
    sim.s.speed = 1;
    expect(stepOf(sim)).toBe('pause');
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
    // the clock is running, so there is no asking to start it, and the Benches wait for the center to open
    expect(stepOf(sim)).toBeNull();
    run(sim, 1);
    expect(sim.s.open).toBe(true);
    expect(sim.tutorialStep()).toMatchObject({ id: 'benches', n: 10, want: { kind: 'item', type: 'bench' } });
    sim.placeItem('bench', 20, 10, 0);
    expect(stepOf(sim)).toBe('benches');
    sim.placeItem('bench', 22, 10, 0);
    expect(
      sim
        .tutorialLines()
        .slice(0, 10)
        .every((l) => l.done),
    ).toBe(true);
  });

  it('asks to start the clock once the opening is built and staffed, if it was paused', () => {
    const sim = tutorialGame();
    sim.noteLooked();
    sim.s.speed = 0;
    expect(stepOf(sim)).toBe('desk');
    sim.placeItem('reception_desk', 14, 13, 0);
    hire(sim, 'receptionist');
    addConsult(sim);
    hire(sim, 'consultant');
    addMassage(sim);
    // the clock is not asked for until the opening is staffed
    expect(stepOf(sim)).toBe('therapist');
    hire(sim, 'therapist');
    expect(sim.tutorialStep()).toMatchObject({ id: 'play', n: 9, want: { kind: 'play' } });
    // paused, the center stays shut and nobody arrives
    for (let i = 0; i < 20; i++) sim.tick(0.1);
    expect(sim.s.open).toBe(false);
    expect(stepOf(sim)).toBe('play');
    sim.s.speed = 1;
    expect(stepOf(sim)).toBeNull();
    run(sim, 1);
    expect(sim.s.open).toBe(true);
    expect(stepOf(sim)).toBe('benches');
  });

  it('says with the first thing bought that everything comes out of the bank, leaving the loan to its lesson', () => {
    const sim = tutorialGame();
    sim.noteLooked();
    sim.s.speed = 0;
    const text = sim.tutorialStep()?.text ?? '';
    expect(text).toMatch(
      /place it near the entrance\. It comes out of the bank in the bottom bar, as everything does\.$/,
    );
    expect(text).not.toMatch(/lends|loan|Money menu/);
  });

  it('asks for a hire only on a step that wants that role, which is when hiring closes the Hire menu', () => {
    const sim = tutorialGame();
    sim.noteLooked();
    sim.s.speed = 0;
    sim.placeItem('reception_desk', 14, 13, 0);
    const step = sim.tutorialStep();
    expect(step?.id).toBe('receptionist');
    expect(wantsHire(step, 'receptionist')).toBe(true);
    expect(wantsHire(step, 'consultant')).toBe(false);
    // a step that wants a room, and none at all with the tutorial off
    hire(sim, 'receptionist');
    expect(wantsHire(sim.tutorialStep(), 'receptionist')).toBe(false);
    sim.s.tutorial = false;
    expect(wantsHire(sim.tutorialStep(), 'consultant')).toBe(false);
  });

  it('teaches the applicant cards on the hiring steps, leaving the choice to the player', () => {
    const sim = tutorialGame();
    sim.noteLooked();
    sim.s.speed = 0;
    sim.placeItem('reception_desk', 14, 13, 0);
    expect(sim.tutorialStep()?.text).toMatch(/quirk, green where it helps and red where it costs you/);
    expect(sim.tutorialStep()?.text).toMatch(/the lower the rank, the less they ask/);
    hire(sim, 'receptionist');
    addConsult(sim);
    expect(sim.tutorialStep()?.text).toMatch(/The better their rank, the surer their diagnoses/);
    hire(sim, 'consultant');
    addMassage(sim);
    expect(sim.tutorialStep()?.text).toMatch(/every Therapist knows Swedish massage/);
  });

  it('says on a step the bank cannot take what it would leave, and that the loan is cheaper than the red', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    placeBenches(sim);
    hire(sim, 'caretaker');
    // flush: the Training Room and the course leave more than a month's wages
    expect(sim.tutorialStep()?.text).not.toMatch(/Money menu/);
    // thin: $5,100 for the room and the course would leave $900, less than a month's wages
    sim.s.money = 6000;
    expect(sim.tutorialStep()?.text).toMatch(
      /This would leave \$900 in the bank, less than a month's wages \(\$\d,\d{3}\): a loan from the Money menu, at 2% a month, is cheaper than the red at 5%\.$/,
    );
    // short: the room alone is more than the bank holds
    sim.s.money = 4000;
    expect(sim.tutorialStep()?.text).toMatch(/This would put the bank \$1,100 in the red: a loan/);
  });

  it('counts looking around done after a couple of days, if the camera is never moved', () => {
    const sim = tutorialGame();
    runUntil(sim, () => sim.s.day >= LOOK_DAYS - 0.01, 3000);
    expect(stepOf(sim)).toBe('look');
    run(sim, 1);
    expect(stepOf(sim)).toBe('pause');
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
      n: 11,
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

  it('hands over once, once every step is done, leaving the heads-up on land to come without a word of its own', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    placeBenches(sim);
    hire(sim, 'caretaker').general.push('smudging');
    addStaffRoom(sim);
    sim.drain();
    run(sim, 1.5);
    expect(sim.s.tutorial).toBe(false);
    // the cards that explain things carry on, and so does the heads-up on land, due at the first star
    expect(sim.s.lessons).toBe(true);
    expect(sim.s.primer).toBe(true);
    const events = sim.drain();
    expect(toasts(events)).toContain(HANDOFF);
    expect(events).toContainEqual({ type: 'tutorial', what: 'done', step: 'staffroom' });
    run(sim, 5);
    expect(toasts(sim.drain())).not.toContain(HANDOFF);
    expect(sim.tutorialLines()).toEqual([]);
    // the land seen to, the heads-ups end without the word the handoff has said
    seeLand(sim);
    run(sim, 1.5);
    expect(sim.s.primer).toBe(false);
    expect(toasts(sim.drain())).not.toContainEqual(expect.stringMatching(/everything it needs to get going/));
  });

  it('hands over once a game, and switched back on after that brings back only the lessons', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    placeBenches(sim);
    hire(sim, 'caretaker').general.push('smudging');
    addStaffRoom(sim);
    run(sim, 1.5);
    expect(toasts(sim.drain())).toContain(HANDOFF);
    sim.setTutorial(false);
    expect(sim.tutorialOn()).toBe(false);
    sim.setTutorial(true);
    expect(sim.s.tutorial).toBe(false);
    expect(sim.s.lessons).toBe(true);
    expect(sim.tutorialOn()).toBe(true);
    run(sim, 5);
    const events = sim.drain();
    expect(toasts(events)).not.toContain(HANDOFF);
    expect(events.filter((e) => e.type === 'tutorial')).toEqual([]);
  });

  it('switched back on with every step done already, brings back only the lessons', () => {
    const sim = tutorialGame();
    // a replay after a star, with no heads-ups to come
    sim.s.primer = false;
    sim.skipTutorial();
    walkOpening(sim);
    placeBenches(sim);
    sim.drain();
    sim.setTutorial(true);
    expect(sim.s.tutorial).toBe(false);
    expect(sim.s.lessons).toBe(true);
    run(sim, 1.5);
    expect(toasts(sim.drain())).not.toContain(HANDOFF);
  });

  it('puts a heads-up that is due ahead of the Benches, which wait for nothing more pressing', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    expect(stepOf(sim)).toBe('benches');
    sim.s.stats.healed = 1;
    expect(sim.tutorialStep()).toMatchObject({ id: 'caretaker', n: 11 });
    expect(sim.tutorialLines().find((l) => l.current)?.id).toBe('caretaker');
    hire(sim, 'caretaker').general.push('smudging');
    expect(stepOf(sim)).toBe('benches');
  });

  it('still says a heads-up that is not the step in hand', () => {
    const sim = tutorialGame();
    walkOpening(sim);
    sim.s.stats.healed = 1;
    sim.drain();
    run(sim, 1.5);
    // the Caretaker is on the card, so it goes without a word of its own
    expect(toasts(sim.drain()).filter((t) => t.includes('Hire a Caretaker'))).toEqual([]);
    // tiring staff are not, so the Staff Room has its word
    for (const st of sim.s.staff) st.energy = 10;
    run(sim, 1.5);
    expect(toasts(sim.drain())).toContainEqual(expect.stringMatching(/Build a Staff Room/));
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
    expect(events).toContainEqual({ type: 'tutorial', what: 'skipped', step: 'pause' });
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

describe('the tutorial setting', () => {
  // a stand-in for the browser's storage
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });

  it('is on by itself only while the campaign has no stars', () => {
    expect(loadTutorialPref()).toBe(true);
    store.set('pressure-point-campaign', JSON.stringify({ stars: { willow: 1 } }));
    expect(loadTutorialPref()).toBe(false);
  });

  it('is as the player set it, stars or not', () => {
    store.set('pressure-point-campaign', JSON.stringify({ stars: { willow: 1 } }));
    saveTutorialPref(true);
    expect(store.get('pressure-point-tutorial')).toBe('on');
    expect(loadTutorialPref()).toBe(true);
    store.delete('pressure-point-campaign');
    saveTutorialPref(false);
    expect(loadTutorialPref()).toBe(false);
  });
});
