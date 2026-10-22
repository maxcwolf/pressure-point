// How a person's state shows on their body and face: a waiting guest's patience in how they stand and sit, a face for
// how they feel, and a member of staff with nothing to do passing the time.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { ITEMS, POOR_CONDITION } from '../../src/core/data';
import type { Char } from '../../src/core/state/types';
import { demoGuest, demoStaff, demoVisitor, LAB_LOOK } from '../../src/lab/people';
import { type Act, actOf } from '../../src/render/acts';
import { buildCharacter, type CharRig } from '../../src/render/models/character';
import {
  actMoment,
  expressionOf,
  hasNothingToDo,
  IDLE,
  idleAct,
  idleMoment,
  moodFor,
  moodOf,
  PATIENCE_SIGNS,
  poseChar,
  SIP,
  stepOn,
  STRIDE,
  treadmill,
} from '../../src/render/pose';

/** A guest with nothing wrong with them to show, waiting with so much patience. */
function waiting(patience: number) {
  const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
  g.state = 'waiting';
  g.patience = patience;
  return g;
}

/** A picture that never arrives, as the icons' atlas a speech bubble is drawn from is never loaded in Node. */
class NoImage {
  src = '';
}

beforeAll(() => {
  Object.assign(globalThis, { Image: NoImage });
});

/** Pose someone straight into their pose at a moment. */
function pose(rig: CharRig, c: Char, t = 0) {
  poseChar(rig, c, t, 1, { style: null });
  rig.group.updateMatrixWorld(true);
}

/** Where a hand is, in the torso's own terms: x to the left, y up from the hips, z forward. */
function hand(rig: CharRig, side: 'L' | 'R') {
  const fore = side === 'L' ? rig.joints.foreL : rig.joints.foreR;
  return rig.torso.worldToLocal(fore.localToWorld(new THREE.Vector3(0, -0.17, 0)));
}

describe('the patience a waiting guest shows', () => {
  it('goes from content to fed up in steps, the last at the bubble', () => {
    expect(PATIENCE_SIGNS.restless).toBeGreaterThan(PATIENCE_SIGNS.impatient);
    expect(PATIENCE_SIGNS.impatient).toBeGreaterThan(PATIENCE_SIGNS.fedUp);
    expect(PATIENCE_SIGNS.fedUp).toBe(25);
    expect([100, 60, 59.9, 40, 39.9, 25, 24.9, 0].map(moodFor)).toEqual([
      'content',
      'content',
      'restless',
      'restless',
      'impatient',
      'impatient',
      'fedUp',
      'fedUp',
    ]);
  });

  it('shows only while waiting, or on the way to wait', () => {
    const g = waiting(30);
    expect(moodOf(g)).toBe('impatient');
    g.state = 'toWait';
    expect(moodOf(g)).toBe('impatient');
    g.state = 'served';
    expect(moodOf(g)).toBe('content');
    expect(moodOf(demoStaff(LAB_LOOK, 'therapist'))).toBe('content');
  });

  it('folds the arms when impatient, and sets the hands on the hips when fed up', () => {
    const content = buildCharacter(LAB_LOOK);
    pose(content, waiting(100));
    // at ease, the hands hang at the sides
    expect(hand(content, 'L').y).toBeLessThan(0.1);
    const folded = buildCharacter(LAB_LOOK);
    pose(folded, waiting(30));
    for (const side of ['L', 'R'] as const) {
      const h = hand(folded, side);
      // in front of the chest, near the middle
      expect(h.z).toBeGreaterThan(0.15);
      expect(Math.abs(h.x)).toBeLessThan(0.1);
      expect(h.y).toBeGreaterThan(0.2);
    }
    const hips = buildCharacter(LAB_LOOK);
    pose(hips, waiting(10));
    for (const side of ['L', 'R'] as const) {
      const h = hand(hips, side);
      expect(Math.abs(h.x)).toBeGreaterThan(0.15);
      expect(Math.abs(h.z)).toBeLessThan(0.05);
      expect(h.y).toBeLessThan(0.2);
    }
  });

  it('puts the head in the hands of a fed-up guest sitting down', () => {
    const rig = buildCharacter(LAB_LOOK);
    const g = waiting(10);
    g.pose = 'sit';
    pose(rig, g);
    for (const side of ['L', 'R'] as const) expect(hand(rig, side).y).toBeGreaterThan(0.4);
  });

  it('keeps the arms of someone whose symptom shows in them as the symptom holds them', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'flex');
    pose(rig, waiting(30));
    // flexing, not folded
    expect(rig.joints.foreL.rotation.y).toBe(0);
  });

  it('turns a fed-up guest toward the door', () => {
    const rig = buildCharacter(LAB_LOOK);
    poseChar(rig, waiting(10), 0, 1, { style: null, door: { x: 5, y: 0 } });
    // the door is off to their left, and they turn that way
    expect(rig.body.rotation.y).toBeGreaterThan(0.5);
  });
});

describe('faces', () => {
  it('follow how someone feels', () => {
    const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
    expect(expressionOf(g)).toBe('neutral');
    expect(expressionOf({ ...g, patience: PATIENCE_SIGNS.impatient - 1 })).toBe('unhappy');
    expect(expressionOf({ ...g, health: POOR_CONDITION - 1 })).toBe('wince');
    expect(expressionOf({ ...g, outcome: 'healed' })).toBe('delighted');
    expect(expressionOf({ ...g, outcome: 'stormed' })).toBe('unhappy');
    expect(expressionOf({ ...g, outcome: 'sent' })).toBe('neutral');
    const st = demoStaff(LAB_LOOK, 'therapist');
    expect(expressionOf(st)).toBe('neutral');
    expect(expressionOf({ ...st, energy: 10 })).toBe('wince');
    expect(expressionOf(demoVisitor(LAB_LOOK, 'vip'))).toBe('neutral');
  });

  it('swap their mouth and brows for shapes everyone with the same face shares, so the crowd draws them together', () => {
    const a = buildCharacter(LAB_LOOK);
    const b = buildCharacter(LAB_LOOK);
    const at = buildCharacter(LAB_LOOK);
    const neutral = at.face.mouth.geometry;
    const healed = { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), outcome: 'healed' as const };
    pose(a, healed);
    pose(b, healed);
    expect(a.face.expression).toBe('delighted');
    expect(a.face.mouth.geometry).toBe(b.face.mouth.geometry);
    expect(a.face.brows.geometry).toBe(b.face.brows.geometry);
    expect(a.face.mouth.geometry).not.toBe(neutral);
    // and back again
    pose(a, demoGuest(LAB_LOOK, 'stiff_neck' as never));
    expect(a.face.mouth.geometry).toBe(neutral);
  });
});

describe('staff with nothing to do', () => {
  it('are those at their post with no one to see, or about with no work', () => {
    const st = demoStaff(LAB_LOOK, 'therapist');
    expect(hasNothingToDo(st)).toBe(true);
    expect(hasNothingToDo({ ...st, busy: true })).toBe(false);
    for (const state of ['onBreak', 'training', 'toPost', 'doingJob', 'toBreak'] as const)
      expect(hasNothingToDo({ ...st, state })).toBe(false);
    for (const state of ['idle', 'wander'] as const) expect(hasNothingToDo({ ...st, state })).toBe(true);
    expect(hasNothingToDo(demoGuest(LAB_LOOK, 'stiff_neck' as never))).toBe(false);
  });

  it('pass the time after a while, one act after another', () => {
    expect(idleAct(1, NaN)).toBeNull();
    expect(idleAct(1, IDLE.after - 0.1)).toBeNull();
    const acts = [0, 1, 2].map((n) => idleAct(1, IDLE.after + (n + 0.5) * IDLE.lasts)?.kind);
    expect(new Set(acts).size).toBe(3);
    for (const kind of ['stretch', 'look', 'watch'] as const)
      for (const id of [1, 2, 3]) expect(idleAct(id, idleMoment(id, kind))).toEqual({ kind, amount: 1 });
  });

  it('stretch once they have had nothing to do for a while, but not on a break', () => {
    const st = demoStaff(LAB_LOOK, 'receptionist');
    const rig = buildCharacter(LAB_LOOK, 'receptionist');
    pose(rig, st, 100);
    // only just idle: arms at the sides
    expect(rig.armL.rotation.x).toBeGreaterThan(-0.5);
    const t = 100 + idleMoment(st.id, 'stretch');
    pose(rig, st, t);
    expect(rig.armL.rotation.x).toBeLessThan(-2.5);
    pose(rig, { ...st, state: 'onBreak' }, t + 0.1);
    expect(rig.armL.rotation.x).toBeGreaterThan(-0.5);
    expect(rig.idleSince).toBeNaN();
  });
});

describe('the stride', () => {
  /** A guest walking, at a spot on the floor. */
  function walker(x: number, y: number) {
    const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
    return { ...g, pose: 'walk' as const, x, y };
  }

  it('follows the ground covered, so a step plants where it lands', () => {
    const rig = buildCharacter(LAB_LOOK);
    pose(rig, walker(0, 0));
    const before = rig.legL.rotation.x;
    // half a cycle on: the other leg forward
    pose(rig, walker(Math.PI / STRIDE, 0));
    expect(Math.sign(rig.legL.rotation.x)).toBe(-Math.sign(before));
    expect(Math.abs(before)).toBeGreaterThan(0.3);
  });

  it('does not count a jump as a walk', () => {
    const rig = buildCharacter(LAB_LOOK);
    pose(rig, walker(0, 0));
    const before = rig.legL.rotation.x;
    pose(rig, walker(5, 0));
    expect(rig.legL.rotation.x).toBeCloseTo(before);
    expect(rig.walked).toBe(0);
  });

  it('counts nothing on the first frame', () => {
    const rig = buildCharacter(LAB_LOOK);
    stepOn(rig, 3, 4);
    expect(rig.walked).toBe(0);
    stepOn(rig, 3, 4.5);
    expect(rig.walked).toBeCloseTo(0.5);
  });

  it('walks on the spot on a treadmill, for the lab', () => {
    const rig = buildCharacter(LAB_LOOK);
    treadmill(rig, 0.5, 2.1);
    expect(rig.walked).toBeCloseTo(1.05);
    treadmill(rig, 0, 2.1);
    expect(rig.walked).toBeCloseTo(1.05);
  });

  it('leans into a turn, the head leading', () => {
    const straight = buildCharacter(LAB_LOOK);
    const turning = buildCharacter(LAB_LOOK);
    for (const rig of [straight, turning]) poseChar(rig, walker(0, 0), 0, 0.1, { style: null });
    poseChar(straight, walker(0, 0), 0.1, 0.1, { style: null });
    // turning to the left, a radian in a tenth of a second
    poseChar(turning, { ...walker(0, 0), facing: 1 }, 0.1, 0.1, { style: null });
    expect(turning.torso.rotation.z).toBeLessThan(straight.torso.rotation.z - 0.1);
    expect(turning.head.rotation.z).toBeLessThan(straight.head.rotation.z - 0.05);
  });
});

describe('what someone is doing at an item', () => {
  it('is a guest having a drink, a snack or a game at a machine, or shopping at a counter', () => {
    const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
    for (const need of ['drink', 'eat', 'play'] as const)
      expect(actOf({ ...g, state: 'need', needKind: need, busy: true }, ITEMS.snack_machine)).toBe(need);
    expect(actOf({ ...g, state: 'need', needKind: 'toilet' })).toBeUndefined();
    expect(actOf({ ...g, state: 'served' }, ITEMS.shop_counter)).toBe('shop');
    expect(actOf({ ...g, state: 'called' }, ITEMS.shop_counter)).toBe('shop');
    expect(actOf({ ...g, state: 'served' }, ITEMS.reception_desk)).toBeUndefined();
    expect(actOf({ ...g, state: 'waiting' }, ITEMS.shop_counter)).toBeUndefined();
  });

  it('is a receptionist checking someone in', () => {
    const st = demoStaff(LAB_LOOK, 'receptionist');
    expect(actOf({ ...st, busy: true }, ITEMS.reception_desk)).toBe('checkin');
    expect(actOf(st, ITEMS.reception_desk)).toBeUndefined();
    expect(actOf({ ...demoStaff(LAB_LOOK, 'therapist'), busy: true })).toBeUndefined();
  });

  it('is a member of staff on a chore, or getting a drink or a snack', () => {
    const st = { ...demoStaff(LAB_LOOK, 'caretaker'), state: 'doingJob' as const, busy: true };
    /** What they do on a job of a kind. */
    const on = (kind: NonNullable<typeof st.job>['kind']) => actOf({ ...st, job: { kind, id: 1 } });
    expect((['litter', 'clean', 'launder'] as const).map(on)).toEqual(['litter', 'litter', 'litter']);
    expect(on('water')).toBe('water');
    expect(on('repair')).toBe('repair');
    expect(on('install')).toBe('repair');
    expect(on('refresh')).toBe('drink');
    expect(actOf({ ...st, job: { kind: 'refresh', id: 1 }, hunger: 90, thirst: 10 })).toBe('eat');
    for (const kind of ['smudge', 'soul', 'ward', 'calm'] as const) expect(on(kind)).toBeUndefined();
    // on the way there, not yet
    expect(actOf({ ...st, state: 'toJob' as const, job: { kind: 'litter', id: 1 } })).toBeUndefined();
  });
});

describe('doing what they are doing', () => {
  /** Someone doing an act, posed at the height of it, or at a moment. */
  function doing(act: Act, t = actMoment(act, 1)) {
    const staff = act === 'checkin' || act === 'litter' || act === 'water' || act === 'repair';
    const rig = buildCharacter(LAB_LOOK, staff ? 'caretaker' : undefined);
    const c: Char = staff
      ? { ...demoStaff(LAB_LOOK, 'caretaker'), busy: true }
      : demoGuest(LAB_LOOK, 'stiff_neck' as never);
    poseChar(rig, c, t, 1, { style: null, act });
    rig.group.updateMatrixWorld(true);
    return { rig, c };
  }

  /** Where a hand is above the floor. */
  const handHeight = (rig: CharRig) => rig.joints.foreR.localToWorld(new THREE.Vector3(0, -0.17, 0)).y;

  it('brings a cup up to the mouth for a sip, and down again', () => {
    const { rig, c } = doing('drink');
    expect(hand(rig, 'R').y).toBeGreaterThan(0.5);
    expect(rig.held?.cup?.visible).toBe(true);
    poseChar(rig, c, actMoment('drink', 1) + SIP / 2, 1, { style: null, act: 'drink' });
    rig.group.updateMatrixWorld(true);
    expect(hand(rig, 'R').y).toBeLessThan(0.3);
    // and put away once they are done
    poseChar(rig, c, 0, 1, { style: null });
    expect(rig.held?.cup?.visible).toBe(false);
  });

  it('stoops to the floor for litter', () => {
    const { rig } = doing('litter');
    expect(handHeight(rig)).toBeLessThan(0.3);
    expect(rig.torso.rotation.x).toBeGreaterThan(0.9);
    // the feet stay on the floor
    for (const shin of [rig.joints.shinL, rig.joints.shinR])
      expect(Math.abs(shin.localToWorld(new THREE.Vector3(0, -0.3, 0)).y)).toBeLessThan(0.1);
  });

  it('crouches to mend something, wrench in hand, feet on the floor', () => {
    const { rig } = doing('repair');
    expect(handHeight(rig)).toBeLessThan(0.45);
    expect(rig.held?.wrench?.visible).toBe(true);
    for (const shin of [rig.joints.shinL, rig.joints.shinR])
      expect(Math.abs(shin.localToWorld(new THREE.Vector3(0, -0.3, 0)).y)).toBeLessThan(0.1);
  });

  it('types at reception without rocking', () => {
    const rig = buildCharacter(LAB_LOOK, 'receptionist');
    const c = { ...demoStaff(LAB_LOOK, 'receptionist'), busy: true };
    for (let t = 0; t <= 1; t += 0.05) {
      poseChar(rig, c, t, 0.05, { style: null, act: 'checkin' });
      expect(Math.abs(rig.torso.rotation.x)).toBeLessThan(0.03);
    }
    expect(rig.held).toBeUndefined();
  });

  it('only does it standing at the item, not on the way there', () => {
    const rig = buildCharacter(LAB_LOOK);
    const g = { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), pose: 'walk' as const };
    poseChar(rig, g, actMoment('drink', 1), 1, { style: null, act: 'drink' });
    expect(rig.held).toBeUndefined();
  });
});
