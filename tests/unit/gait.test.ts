// How people walk: steps that follow the ground covered up to a cap on how quick they come, a walk for how each feels,
// picked from the game's state, easing into the first step and out of the last, and less bob for less motion.
import { beforeAll, describe, expect, it } from 'vitest';

import { GUEST_WALK, STAFF_WALK, TIRED_ENERGY } from '../../src/core/data';
import type { Char, Guest, Staff } from '../../src/core/state/types';
import { demoGuest, demoStaff, LAB_LOOK } from '../../src/lab/people';
import {
  advanceGait,
  CADENCE,
  cadenceFor,
  EASE,
  gaitCycle,
  moodOfWalk,
  MOODS,
  STRIDE,
  type Walker,
} from '../../src/render/gait';
import { buildCharacter } from '../../src/render/models/character';
import { poseChar } from '../../src/render/pose';

/** A picture that never arrives, as the icons' atlas a speech bubble is drawn from is never loaded in Node. */
class NoImage {
  src = '';
}

beforeAll(() => {
  Object.assign(globalThis, { Image: NoImage });
});

/** How someone walking is, for the walk: at ease, unless said otherwise. */
const walker = (w: Partial<Walker> = {}): Walker => ({
  mood: 'content',
  idle: false,
  cured: false,
  visual: undefined,
  calm: false,
  ...w,
});

/** A guest walking, with nothing to show. */
const guest = (g: Partial<Guest> = {}): Guest => ({
  ...demoGuest(LAB_LOOK, 'stiff_neck' as never),
  pose: 'walk',
  ...g,
});

/** A member of staff walking, in a state and with so much energy. */
const staff = (state: Staff['state'], energy = 100): Staff => ({
  ...demoStaff(LAB_LOOK, 'therapist'),
  state,
  energy,
  pose: 'walk',
});

/** A sixtieth of a second, a frame of the game at speed 1. */
const FRAME = 1 / 60;

/**
 * Walk someone at a pace, at a speed of the game, for so many seconds of the screen's time, and say how many steps a
 * second they were shown taking over the last of them, once their pace had settled.
 */
function stepsASecond(c: Char, pace: number, speed: number, seconds = 3) {
  const rig = buildCharacter(LAB_LOOK);
  let at = { phase: 0 };
  let settled = NaN;
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i++) {
    rig.walked += pace * speed * FRAME;
    at = advanceGait(rig, c, FRAME, walker());
    if (i === Math.round(frames / 2)) settled = at.phase;
  }
  // two steps to a cycle
  return ((at.phase - settled) / (frames / 2) / FRAME / (Math.PI * 2)) * 2;
}

describe('the cadence', () => {
  it('follows the ground covered at a slow pace, and goes no quicker than the cap past it', () => {
    expect(cadenceFor(5)).toBe(5);
    const from = CADENCE.from * Math.PI;
    const most = CADENCE.most * Math.PI;
    expect(cadenceFor(from)).toBe(from);
    let last = from;
    for (const pace of [from + 1, from + 4, from + 20]) {
      const shown = cadenceFor(pace);
      expect(shown).toBeGreaterThan(last);
      expect(shown).toBeLessThan(most);
      last = shown;
    }
    expect(cadenceFor(from * 10)).toBeLessThanOrEqual(most);
  });

  it('plants the feet at speed 1, and caps the steps at speeds 2 and 3', () => {
    const c = guest();
    const one = stepsASecond(c, GUEST_WALK, 1);
    const two = stepsASecond(c, GUEST_WALK, 2);
    const three = stepsASecond(c, GUEST_WALK, 3);
    // at speed 1, about what the ground covered sets them going at, give or take a person's own stride
    const ground = (GUEST_WALK * STRIDE) / Math.PI;
    expect(one).toBeGreaterThan(ground * 0.88);
    expect(one).toBeLessThan(ground * 1.12);
    expect(one).toBeLessThanOrEqual(CADENCE.from + 0.01);
    for (const quicker of [two, three]) {
      expect(quicker).toBeGreaterThan(one);
      expect(quicker).toBeLessThan(CADENCE.most);
    }
    expect(three).toBeGreaterThanOrEqual(two);
  });

  it('lets someone hurrying step quicker than the cap at ease, but still not as quick as the ground would set them', () => {
    const hurrying = stepsASecond(staff('toJob'), STAFF_WALK, 3);
    expect(hurrying).toBeLessThan(CADENCE.most * MOODS.hurry.times.cap);
    expect(hurrying).toBeLessThan((STAFF_WALK * 3 * STRIDE) / Math.PI);
  });
});

describe('the walk for how someone feels', () => {
  it('is picked from the game state: staff hurrying, worn out or with nothing to do', () => {
    expect(moodOfWalk(staff('toJob'), walker())?.mood).toBe('hurry');
    expect(moodOfWalk(staff('toCall'), walker())?.mood).toBe('hurry');
    expect(moodOfWalk({ ...staff('toPost'), busy: true }, walker())?.mood).toBe('hurry');
    expect(moodOfWalk(staff('wander'), walker({ idle: true }))?.mood).toBe('stroll');
    expect(moodOfWalk(staff('wander'), walker())).toBeUndefined();
    // worn out all the way once the game slows them, partway a little before, and over anything else
    expect(moodOfWalk(staff('toJob', TIRED_ENERGY - 1), walker())).toEqual({ mood: 'tired', by: 1 });
    const nearly = moodOfWalk(staff('toJob', TIRED_ENERGY + 5), walker());
    expect(nearly?.mood).toBe('tired');
    expect(nearly?.by).toBeGreaterThan(0);
    expect(nearly?.by).toBeLessThan(1);
    expect(moodOfWalk(staff('toJob', TIRED_ENERGY * 2), walker())?.mood).toBe('hurry');
  });

  it('is picked from the game state: guests fed up, unwell, impatient, healed or running', () => {
    expect(moodOfWalk(guest(), walker())).toBeUndefined();
    expect(moodOfWalk(guest(), walker({ mood: 'fedUp' }))?.mood).toBe('stomp');
    expect(moodOfWalk(guest({ outcome: 'stormed' }), walker())?.mood).toBe('stomp');
    expect(moodOfWalk(guest({ health: 18 }), walker())?.mood).toBe('shuffle');
    // healed, they are well, whatever their condition was
    expect(moodOfWalk(guest({ health: 18, outcome: 'healed' }), walker({ cured: true }))?.mood).toBe('skip');
    expect(moodOfWalk(guest(), walker({ mood: 'impatient' }))).toEqual({ mood: 'brisk', by: 1 });
    expect(moodOfWalk(guest(), walker({ mood: 'restless' }))).toEqual({ mood: 'brisk', by: 0.5 });
    expect(moodOfWalk(guest({ state: 'running' }), walker({ mood: 'fedUp' }))?.mood).toBe('run');
  });

  it('tells worn-out staff from unwell guests: long slow rolling steps, arms hanging, against small quick ones held still', () => {
    const tired = advanceGait(buildCharacter(LAB_LOOK), staff('toJob', 5), FRAME, walker()).state.style!;
    const unwell = advanceGait(buildCharacter(LAB_LOOK), guest({ health: 15 }), FRAME, walker()).state.style!;
    expect(unwell.stride).toBeGreaterThan(tired.stride * 1.4);
    expect(unwell.reach).toBeLessThan(tired.reach / 2);
    expect(tired.sway).toBeGreaterThan(unwell.sway * 4);
    expect(tired.hipDrop).toBeGreaterThan(unwell.hipDrop * 4);
    expect(unwell.belly).toBe(1);
    expect(tired.belly).toBe(0);
    expect(tired.headDown).toBeGreaterThan(unwell.headDown);
  });

  it('drops the head and the body with each stamp of a fed-up guest, long enough to see', () => {
    const rig = buildCharacter(LAB_LOOK);
    const c = guest();
    const heads: number[] = [];
    for (let i = 0; i < 120; i++) {
      rig.walked += GUEST_WALK * FRAME;
      const now = advanceGait(rig, c, FRAME, walker({ mood: 'fedUp' }));
      heads.push(gaitCycle(rig, c, FRAME, now, true, true).headX);
    }
    const settled = heads.slice(60);
    const deep = settled.filter((h) => h > MOODS.stomp.stomp / 2).length;
    // down at least a tenth of the time, and by more than the stamp's half
    expect(deep / settled.length).toBeGreaterThan(0.1);
    expect(Math.max(...settled)).toBeGreaterThan(MOODS.stomp.stomp * 0.8);
  });
});

describe('starting and stopping', () => {
  it('eases into the first step and settles on the last, and stops at once to sit', () => {
    const rig = buildCharacter(LAB_LOOK);
    const c = guest({ pose: 'stand' });
    advanceGait(rig, c, FRAME, walker());
    c.pose = 'walk';
    const ons: number[] = [];
    for (let i = 0; i < 60; i++) {
      rig.walked += GUEST_WALK * FRAME;
      ons.push(advanceGait(rig, c, FRAME, walker()).state.on);
    }
    /** How far into walking they were so many seconds after setting off. */
    const at = (s: number) => ons[Math.round(s / FRAME) - 1]!;
    // a fifth of the way in after a fifth of the ease, and all the way in once it is over
    expect(at(EASE.start / 5)).toBeCloseTo(0.2, 1);
    expect(at(EASE.start + 0.05)).toBe(1);
    // stopping, the step goes on, slowing, as they settle
    c.pose = 'stand';
    const stopping = [0, 1, 2, 3, 4, 5].map(() => advanceGait(rig, c, FRAME, walker()));
    const phases = stopping.map((s) => s.phase);
    expect(phases[1]! - phases[0]!).toBeGreaterThan(phases[5]! - phases[4]!);
    expect(phases[5]!).toBeGreaterThan(phases[0]!);
    for (let i = 0; i < Math.ceil(EASE.stop / FRAME); i++) advanceGait(rig, c, FRAME, walker());
    expect(advanceGait(rig, c, FRAME, walker()).state.on).toBe(0);
    // but sat down, at once
    c.pose = 'walk';
    for (let i = 0; i < 30; i++) advanceGait(rig, c, FRAME, walker());
    expect(advanceGait(rig, { ...c, pose: 'sit' }, FRAME, walker()).state.on).toBe(0);
  });

  it('puts no cycle on someone standing still, and the whole cycle on someone walking', () => {
    const rig = buildCharacter(LAB_LOOK);
    const c = guest({ pose: 'stand' });
    const still = advanceGait(rig, c, FRAME, walker());
    expect(gaitCycle(rig, c, FRAME, still, true, true).legL).toBe(0);
    c.pose = 'walk';
    let most = 0;
    for (let i = 0; i < 90; i++) {
      rig.walked += GUEST_WALK * FRAME;
      const now = advanceGait(rig, c, FRAME, walker());
      most = Math.max(most, Math.abs(gaitCycle(rig, c, FRAME, now, true, true).legL));
    }
    expect(most).toBeGreaterThan(0.4);
  });
});

describe('less motion, and people drawn small', () => {
  it('takes the spring, the skip, the stamp and the nod out of the walk with less motion asked for', () => {
    const run = advanceGait(buildCharacter(LAB_LOOK), guest({ state: 'running' }), FRAME, walker({ calm: true }));
    expect(run.state.style?.bounce).toBe(0);
    const fedUp = advanceGait(buildCharacter(LAB_LOOK), guest(), FRAME, walker({ mood: 'fedUp', calm: true }));
    expect(fedUp.state.style?.stomp).toBe(0);
    expect(fedUp.state.style?.nod).toBe(0);
    const healed = advanceGait(buildCharacter(LAB_LOOK), guest({ outcome: 'healed' }), FRAME, walker({ cured: true }));
    expect(healed.state.style?.skip).toBeGreaterThan(0);
    const calmly = advanceGait(
      buildCharacter(LAB_LOOK),
      guest({ outcome: 'healed' }),
      FRAME,
      walker({ cured: true, calm: true }),
    );
    expect(calmly.state.style?.skip).toBe(0);
    expect(calmly.state.style?.sway).toBeLessThan(healed.state.style!.sway);
  });

  it('keeps the feet flat and the head turning with the body for someone drawn too small to see either', () => {
    const rig = buildCharacter(LAB_LOOK);
    const c = guest();
    let full = { footL: 0, headYaw: 0 };
    for (let i = 0; i < 40; i++) {
      rig.walked += GUEST_WALK * FRAME;
      const now = advanceGait(rig, c, FRAME, walker());
      const big = gaitCycle(rig, c, FRAME, now, true, true);
      if (Math.abs(big.footL) > Math.abs(full.footL)) full = big;
      const small = gaitCycle(rig, c, FRAME, now, true, true, true);
      expect(small.footL).toBe(0);
      expect(small.headYaw === 0).toBe(true);
    }
    expect(Math.abs(full.footL)).toBeGreaterThan(0.05);
  });

  it('puts the shoes flat again once someone is drawn small, and poses them as before otherwise', () => {
    const rig = buildCharacter(LAB_LOOK);
    const shoe = rig.joints.shinL.getObjectByName('shoe')!;
    let rolled = 0;
    for (let i = 0; i < 40; i++) {
      poseChar(rig, guest({ x: i * GUEST_WALK * FRAME }), i * FRAME, FRAME, { style: null });
      rolled = Math.max(rolled, Math.abs(shoe.rotation.x));
    }
    expect(rolled).toBeGreaterThan(0.05);
    rig.group.userData.small = true;
    poseChar(rig, guest({ x: 40 * GUEST_WALK * FRAME }), 40 * FRAME, FRAME, { style: null });
    expect(shoe.rotation.x).toBe(0);
  });
});
