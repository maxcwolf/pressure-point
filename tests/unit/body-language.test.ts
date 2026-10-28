// How a person's state shows on their body and face: a waiting guest's patience in how they stand and sit, a face for
// how they feel, and a member of staff with nothing to do passing the time.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { CONDITIONS, ITEMS, POOR_CONDITION } from '../../src/core/data';
import { SHOES } from '../../src/core/people';
import type { Char } from '../../src/core/state/types';
import { demoGuest, demoStaff, demoVisitor, LAB_LOOK } from '../../src/lab/people';
import { type Act, actOf, lyingAt } from '../../src/render/acts';
import { BUBBLE_STANDING } from '../../src/render/bubbles';
import { rattle } from '../../src/render/item-cues';
import { buildCharacter, CAP_TIP, type CharRig, cureRig, topOf } from '../../src/render/models/character';
import { HELD_SIZE } from '../../src/render/models/held';
import {
  actMoment,
  BLINK,
  blinkAt,
  CURE,
  expressionOf,
  flashAt,
  hasNothingToDo,
  IDLE,
  idleAct,
  idleMoment,
  moodFor,
  moodOf,
  PATIENCE_SIGNS,
  poseChar,
  POTTED,
  PRONE_TURN,
  rattleDip,
  RHYTHM,
  SIP,
  stepOn,
  STRIDE,
  treadmill,
  type WorkStyle,
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

  it('stamps a foot when impatient, the knee coming right up, and folds the arms high', () => {
    const g = waiting(30);
    const rig = buildCharacter(LAB_LOOK);
    // at the top of a stamp
    pose(rig, g, (Math.PI / 2 - g.id) / 5 + Math.PI * 2);
    const [left, right] = [rig.joints.shinL, rig.joints.shinR].map((s) =>
      s.localToWorld(new THREE.Vector3(0, -0.3, 0)),
    );
    expect(rig.legR.rotation.x).toBeLessThan(-0.35);
    expect(right!.y - left!.y).toBeGreaterThan(0.04);
    for (const side of ['L', 'R'] as const) expect(hand(rig, side).y).toBeGreaterThan(0.32);
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

  it('turns the head of anyone near a guest on a really bad trip toward them, and nobody far off or lying down', () => {
    /** How far round someone's head is turned, after posing them with a runner this far off to their left, or none. */
    const turned = (c: Char, d?: number) => {
      const rig = buildCharacter(LAB_LOOK);
      const runners = d === undefined ? [] : [{ id: -1, x: c.x + d, y: c.y }];
      poseChar(rig, c, 0, 1, { style: null, runners });
      return rig.head.rotation.y;
    };
    const g = waiting(100);
    expect(turned(g, 1.5)).toBeCloseTo(0.6);
    expect(turned(g, -1.5)).toBeCloseTo(-0.6);
    expect(turned(g, 6)).toBe(turned(g));
    const lying = { ...g, state: 'served', pose: 'lie' } as const;
    expect(turned(lying, 1.5)).toBe(turned(lying));
    expect(turned(demoStaff(LAB_LOOK, 'therapist'), -1.5)).toBeCloseTo(-0.6);
  });
});

describe('the Gong of Last Resort, through the wall', () => {
  it('dips the head of anyone in a rattled room on each strike, in step with the furniture, and less lying down', () => {
    const g = waiting(100);
    // find a moment in a strike, and one between
    const ts = Array.from({ length: 400 }, (_, i) => i * 0.01);
    const strike = ts.find((t) => rattle(t, g.id) > 0.015) ?? 0;
    const still = ts.find((t) => rattle(t, g.id) === 0) ?? 0;
    expect(rattleDip(g, strike)).toBeGreaterThan(0.06);
    expect(rattleDip(g, still)).toBe(0);
    expect(rattleDip({ ...g, pose: 'lie' }, strike)).toBeCloseTo(rattleDip(g, strike) / 3);
    /** How far the head is bowed after posing them at a moment, rattled or not. */
    const bowed = (rattled: boolean) => {
      const rig = buildCharacter(LAB_LOOK);
      poseChar(rig, g, strike, 1, { style: null, rattled });
      return rig.head.rotation.x;
    };
    expect(bowed(true) - bowed(false)).toBeCloseTo(rattleDip(g, strike));
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
    // frightened on a really bad trip or in an outbreak, unless healed
    expect(expressionOf({ ...g, state: 'running', outcome: 'failed' })).toBe('scared');
    expect(expressionOf({ ...g, stressed: true, patience: 10 })).toBe('scared');
    expect(expressionOf({ ...g, stressed: true, outcome: 'healed' })).toBe('delighted');
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

  it('holds the cup to the side of the mouth, the head tipped back, but takes a bite with both hands', () => {
    const drink = doing('drink').rig;
    const eat = doing('eat').rig;
    // drinking, the left hand hangs and the head goes back; eating, both hands come up and the head goes forward
    expect(hand(drink, 'L').y).toBeLessThan(0.1);
    for (const side of ['L', 'R'] as const) {
      expect(hand(eat, side).y).toBeGreaterThan(0.4);
      expect(Math.abs(hand(eat, side).x)).toBeLessThan(0.08);
    }
    expect(drink.head.rotation.x).toBeLessThan(-0.2);
    expect(eat.head.rotation.x).toBeGreaterThan(0);
    // the cup off to the side of the face, the snack in the middle of it
    expect(Math.abs(hand(drink, 'R').x)).toBeGreaterThan(0.15);
  });

  it('draws what is held big enough to see beside the hand holding it', () => {
    for (const act of ['drink', 'eat', 'repair'] as const) {
      const held = Object.values(doing(act).rig.held ?? {}).find((h) => h.visible);
      expect(held?.scale.x).toBeCloseTo(HELD_SIZE);
    }
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

describe('lying down', () => {
  /** A guest lying on an item, being served there. */
  const lying = () => ({ ...demoGuest(LAB_LOOK, 'stiff_neck' as never), pose: 'lie' as const, h: 0.6 });

  /** Which way a face looks, out of the screen in the scene's terms. */
  const faceOf = (rig: CharRig) =>
    new THREE.Vector3(0, 0, 1).applyQuaternion(rig.head.getWorldQuaternion(new THREE.Quaternion()));

  it('is face down on a massage or acupuncture table, and on the back elsewhere', () => {
    expect(lyingAt(lying(), ITEMS.massage_table)).toBe('prone');
    expect(lyingAt(lying(), ITEMS.acu_table)).toBe('prone');
    expect(lyingAt(lying(), ITEMS.reiki_table)).toBe('back');
    expect(lyingAt({ ...lying(), state: 'resting' }, ITEMS.lounger)).toBe('back');
    // a machine lays them down its own way
    expect(lyingAt(lying(), ITEMS.stone_kiln)).toBeUndefined();
    // and someone on their way there is not lying yet
    expect(lyingAt({ ...lying(), pose: 'walk' }, ITEMS.massage_table)).toBeUndefined();
    expect(lyingAt(lying(), ITEMS.bench)).toBeUndefined();
  });

  it('reads as face down: the face into the table and the soles turned up', () => {
    const rig = buildCharacter(LAB_LOOK);
    poseChar(rig, lying(), 0, 1, { style: null, lie: 'prone' });
    rig.group.updateMatrixWorld(true);
    expect(rig.head.rotation.y).toBeCloseTo(PRONE_TURN);
    expect(rig.body.rotation.x).toBeCloseTo(Math.PI / 2);
    // the face down, so the back of the head shows from above
    expect(faceOf(rig).y).toBeLessThan(-0.9);
    expect(rig.soles).toHaveLength(2);
    for (const sole of rig.soles ?? []) {
      expect(sole.visible).toBe(true);
      // turned up toward the sky, the shins up on a bolster
      expect(
        new THREE.Vector3(0, -1, 0).applyQuaternion(sole.getWorldQuaternion(new THREE.Quaternion())).y,
      ).toBeGreaterThan(0.5);
    }
    // and put away when they get up, nor shown lying on the back
    poseChar(rig, { ...lying(), pose: 'stand', h: 0 }, 0, 1, { style: null });
    for (const sole of rig.soles ?? []) expect(sole.visible).toBe(false);
    const back = buildCharacter(LAB_LOOK);
    poseChar(back, lying(), 0, 1, { style: null, lie: 'back' });
    expect(back.soles).toBeUndefined();
  });

  it('lies on the back, face up, elsewhere', () => {
    const rig = buildCharacter(LAB_LOOK);
    poseChar(rig, lying(), 0, 1, { style: null, lie: 'back' });
    rig.group.updateMatrixWorld(true);
    expect(faceOf(rig).y).toBeGreaterThan(0.9);
    const machine = buildCharacter(LAB_LOOK);
    poseChar(machine, lying(), 0, 1, { style: null });
    machine.group.updateMatrixWorld(true);
    expect(faceOf(machine).y).toBeLessThan(-0.9);
  });
});

describe('blinking', () => {
  it('comes now and then, for a moment, each person at their own time', () => {
    for (const id of [1, 2, 7, 40]) {
      let shut = 0;
      let run = 0;
      let longest = 0;
      const step = 0.01;
      for (let t = 0; t < 600; t += step) {
        const b = blinkAt(id, t);
        if (b) shut++;
        run = b ? run + step : 0;
        longest = Math.max(longest, run);
      }
      const share = (shut * step) / 600;
      // a blink of BLINK seconds every 3.2 to 5.4 seconds
      expect(share).toBeGreaterThan(BLINK / 5.5);
      expect(share).toBeLessThan(BLINK / 3.1);
      expect(longest).toBeLessThan(2);
    }
  });

  it('never catches the lab with its eyes shut, so its pictures stay the same', () => {
    expect(blinkAt(1, 0)).toBe(false);
  });

  it('shuts the eyes of a guest resting on their back, with shapes everyone shares', () => {
    const rig = buildCharacter(LAB_LOOK);
    const open = rig.face.eyes.geometry;
    const g = {
      ...demoGuest(LAB_LOOK, 'stiff_neck' as never),
      pose: 'lie' as const,
      h: 0.32,
      state: 'resting' as const,
    };
    poseChar(rig, g, 0, 1, { style: null, lie: 'back' });
    expect(rig.face.shut).toBe(true);
    expect(rig.face.glints.visible).toBe(false);
    const other = buildCharacter(LAB_LOOK);
    poseChar(other, g, 0, 1, { style: null, lie: 'back' });
    expect(other.face.eyes.geometry).toBe(rig.face.eyes.geometry);
    // and open again once up
    poseChar(rig, demoGuest(LAB_LOOK, 'stiff_neck' as never), 0, 1, { style: null });
    expect(rig.face.eyes.geometry).toBe(open);
    expect(rig.face.glints.visible).toBe(true);
  });
});

describe('glasses', () => {
  /** Whether someone's glasses show. */
  const on = (rig: CharRig) => !!rig.glasses?.visible;

  it('are worn by those who wear them, and swapped for sunglasses while a symptom or a visit has them on', () => {
    const look = { ...LAB_LOOK, glasses: 1 };
    expect(on(buildCharacter(look))).toBe(true);
    expect(buildCharacter(LAB_LOOK).glasses).toBeUndefined();
    expect(on(buildCharacter(look, undefined, undefined, 'vip'))).toBe(false);
    const burnt = buildCharacter(look, undefined, 'sunburn');
    expect(on(burnt)).toBe(false);
    // and back on once cured
    poseChar(burnt, { ...demoGuest(look, 'stiff_neck' as never), outcome: 'healed' }, 0, 1, { style: null });
    expect(on(burnt)).toBe(true);
  });
});

describe('symptoms over the head', () => {
  it('hover clear of the head, every one that bobs there', () => {
    for (const { visual } of CONDITIONS) {
      const rig = buildCharacter(LAB_LOOK, undefined, visual);
      if (rig.bob) expect(rig.bobAt, visual).toBeGreaterThanOrEqual(0.3);
    }
  });

  /**
   * The top of someone's symptom as they are posed, in meters over their feet: every part of it shown, and every part
   * of them floating loose, but not the puffs and drips coming off them.
   */
  function symptomTop(rig: CharRig) {
    rig.group.updateMatrixWorld(true);
    let top = -Infinity;
    /** Take in a part, if it is drawn, and what it carries. */
    const visit = (o: THREE.Object3D) => {
      if (!o.visible || o === rig.steam || o === rig.drips) return;
      if (o instanceof THREE.Mesh) {
        const geo = o.geometry as THREE.BufferGeometry;
        geo.computeBoundingBox();
        top = Math.max(top, new THREE.Box3().copy(geo.boundingBox!).applyMatrix4(o.matrixWorld).max.y);
      }
      o.children.forEach(visit);
    };
    /** Whether a part is drawn: shown itself, and every parent of it shown too. */
    const shown = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    for (const o of [...rig.props, ...(rig.spin ?? []).filter((s) => s.userData.drift)]) if (shown(o)) visit(o);
    return top;
  }

  it("keeps every guest's bubble clear of the top of their symptom, as it bobs, rattles and floats", () => {
    for (const { id, visual } of CONDITIONS) {
      const rig = buildCharacter(LAB_LOOK, undefined, visual);
      const g = { ...demoGuest(LAB_LOOK, id), bubble: 'bubble-impatient' as const, bubbleT: 1 };
      for (let t = 0; t < 4; t += 0.07) {
        pose(rig, g, t);
        expect(rig.bubble.position.y, `${id} at ${t.toFixed(2)}`).toBeGreaterThan(symptomTop(rig));
      }
    }
  });

  it('raises the bubble over the tall heads and leaves an ordinary one where it was', () => {
    for (const visual of ['gears', 'steam', 'shards', 'cork', 'sunburn', 'glass', 'egg', 'snowcap', 'band'] as const)
      expect(buildCharacter(LAB_LOOK, undefined, visual).bubbleAt, visual).toBeGreaterThan(BUBBLE_STANDING + 0.05);
    expect(buildCharacter(LAB_LOOK, undefined, 'stiff').bubbleAt).toBe(BUBBLE_STANDING);
  });

  it('leaves out of the top what is put away while they sit, and the symptom once cured', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'compass');
    rig.props[0]!.userData.standing = true;
    expect(topOf(rig, true)).toBeLessThan(topOf(rig, false) - 0.3);
    expect(rig.bubbleCured).toBe(BUBBLE_STANDING);
    const kettle = buildCharacter(LAB_LOOK, undefined, 'steam');
    poseChar(kettle, { ...demoGuest(LAB_LOOK, 'steam'), outcome: 'healed' }, 5, 1, { style: null });
    expect(kettle.bubbleAt).toBe(BUBBLE_STANDING);
    expect(kettle.bubbleSitting).toBe(BUBBLE_STANDING);
  });
});

describe('a symptom in place of the head', () => {
  /** Whether a part of someone is drawn: shown itself, and every parent of it shown too. */
  const shown = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  /** The hair on someone's head. */
  const hair = (rig: CharRig) => rig.head.children.filter((o) => o.name === 'hair');

  it("makes a scrambled noggin's head an egg with its top knocked off, the face still on it", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'egg');
    expect(shown(rig.headMesh)).toBe(false);
    expect(hair(rig).some(shown)).toBe(false);
    expect(shown(rig.face.eyes)).toBe(true);
    expect(shown(rig.face.mouth)).toBe(true);
    // the broken cap floats over it, among the stars
    expect(rig.bob?.position.y).toBeGreaterThan(0.3);
    expect(rig.orbit).toBeDefined();
    expect(rig.head.scale.y).toBeGreaterThan(1);
  });

  it('leaves someone far out their own head, with the stars going round it', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'dizzy');
    expect(shown(rig.headMesh)).toBe(true);
    expect(hair(rig).some(shown)).toBe(true);
    expect(rig.orbit).toBeDefined();
    expect(rig.head.scale.y).toBe(1);
  });

  it('gives the head back halfway through the cure, with the face where it was', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'egg');
    const face = buildCharacter(LAB_LOOK).face.eyes.position.z;
    const healed = { ...demoGuest(LAB_LOOK, 'dizzy'), outcome: 'healed' as const };
    poseChar(rig, { ...healed, outcome: '' }, -1, 1, { style: null });
    cureRig(rig, 0);
    poseChar(rig, healed, CURE * 0.25, 1, { style: null });
    expect(shown(rig.headMesh)).toBe(false);
    poseChar(rig, healed, CURE * 0.75, 1, { style: null });
    expect(shown(rig.headMesh)).toBe(true);
    expect(hair(rig).every(shown)).toBe(true);
    expect(rig.face.eyes.position.z).toBeCloseTo(face);
    poseChar(rig, healed, CURE * 2, 1, { style: null });
    expect(rig.head.scale.y).toBe(1);
    expect(rig.props.some(shown)).toBe(false);
  });

  it('is simply gone for someone seen first already healed, as from a save', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'egg');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'dizzy'), outcome: 'healed' }, 5, 1, { style: null });
    expect(shown(rig.headMesh)).toBe(true);
    expect(rig.head.scale.y).toBe(1);
    expect(rig.burst).toBeUndefined();
  });

  it('puts the floating cap away while they lie down', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'egg');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'dizzy'), pose: 'lie' }, 0, 1, { style: null });
    expect(rig.bob?.visible).toBe(false);
  });

  it("makes a flat battery's head a battery, its last cell blinking and the face on its label", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'battery');
    expect(shown(rig.headMesh)).toBe(false);
    expect(hair(rig).some(shown)).toBe(false);
    expect(shown(rig.face.eyes)).toBe(true);
    expect(rig.blink).toBeDefined();
    // the battery is the head now, so nothing hovers over it
    expect(rig.bob).toBeUndefined();
    poseChar(rig, demoGuest(LAB_LOOK, 'battery'), 0, 1, { style: null });
    const lit = rig.blink!.emissiveIntensity;
    poseChar(rig, demoGuest(LAB_LOOK, 'battery'), Math.PI / 6, 1, { style: null });
    expect(rig.blink!.emissiveIntensity).not.toBe(lit);
  });

  it("makes a stress head's head a kettle, the steam puffing out of its spout", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'steam');
    expect(shown(rig.headMesh)).toBe(true);
    expect((rig.headMesh.material as THREE.MeshStandardMaterial).color.getHex()).not.toBe(LAB_LOOK.skin);
    expect(hair(rig).some(shown)).toBe(false);
    // the steam comes out of the whistle, off to the side of the head and up, not out of the top
    expect(rig.steam!.position.x).toBeGreaterThan(0.3);
    expect(rig.steam!.position.y).toBeGreaterThan(0.1);
    expect(rig.head.scale.y).toBeGreaterThan(1);
  });

  it('gives a stress head their own skin back with the cure', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'steam');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'steam'), outcome: 'healed' }, 5, 1, { style: null });
    expect((rig.headMesh.material as THREE.MeshStandardMaterial).color.getHex()).toBe(LAB_LOOK.skin);
    expect(hair(rig).every(shown)).toBe(true);
    expect(rig.head.scale.y).toBe(1);
  });

  it("makes a noisy mind's head a boombox blaring, notes rising off it and its speakers pumping", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'gears');
    expect(shown(rig.headMesh)).toBe(false);
    expect(shown(rig.face.eyes)).toBe(true);
    // the cog that used to turn over the head is gone
    expect(rig.orbit).toBeUndefined();
    expect(rig.steam?.children).toHaveLength(3);
    const g = demoGuest(LAB_LOOK, 'noisy');
    /** How big each pumping part is at a moment. */
    const sizes = (t: number) => {
      poseChar(rig, g, t, 1, { style: null });
      return (rig.spin ?? []).map((o) => o.scale.x);
    };
    const beats = Array.from({ length: 20 }, (_, i) => sizes(i * 0.037));
    expect(new Set(beats.map((b) => b.join())).size).toBeGreaterThan(1);
  });

  it('gives a noisy mind their head back with the cure', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'gears');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'noisy'), outcome: 'healed' }, 5, 1, { style: null });
    expect(shown(rig.headMesh)).toBe(true);
    expect(rig.head.scale.y).toBe(1);
    expect(rig.props.some(shown)).toBe(false);
  });

  it("grows a signpost out of the top of a lost guest's head, its arrows turning slowly every which way", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'compass');
    expect(shown(rig.headMesh)).toBe(true);
    expect(shown(rig.face.eyes)).toBe(true);
    // the compass that used to float over the head is gone
    expect(rig.bob).toBeUndefined();
    expect(rig.orbit).toBeUndefined();
    const post = rig.props[0]!;
    expect(post.parent).toBe(rig.head);
    const g = demoGuest(LAB_LOOK, 'lost');
    poseChar(rig, g, 0, 1, { style: null });
    const facing = post.rotation.y;
    poseChar(rig, g, 1, 1, { style: null });
    expect(post.rotation.y).not.toBeCloseTo(facing);
  });

  it('puts the signpost away while they lie down', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'compass');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'lost'), pose: 'lie' }, 0, 1, { style: null });
    expect(rig.props[0]!.visible).toBe(false);
    poseChar(rig, demoGuest(LAB_LOOK, 'lost'), 1, 1, { style: null });
    expect(rig.props[0]!.visible).toBe(true);
  });

  it('takes the signpost away with the cure', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'compass');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'lost'), outcome: 'healed' }, 5, 1, { style: null });
    expect(rig.props.some(shown)).toBe(false);
    expect(rig.bubbleAt).toBe(BUBBLE_STANDING);
  });

  it('raises their bubble clear of the top of the signpost, so it never hides it', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'compass');
    rig.group.updateMatrixWorld(true);
    const top = new THREE.Box3().setFromObject(rig.props[0]!).max.y;
    expect(rig.bubbleAt).toBeGreaterThan(top);
    expect(buildCharacter(LAB_LOOK).bubbleAt).toBe(BUBBLE_STANDING);
  });

  it("screws a tension headband's head down in a G-clamp, squashed under it, put away while they lie down", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'band');
    expect(shown(rig.headMesh)).toBe(true);
    expect(rig.head.scale.y).toBeLessThan(1);
    expect(rig.head.scale.x * rig.wide).toBeGreaterThan(1);
    const clamp = rig.props[0]!;
    expect(clamp.parent).toBe(rig.head);
    // the clamp keeps its own shape, however the head is squashed
    clamp.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    clamp.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), size);
    expect(size.y).toBeCloseTo(size.x);
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'band'), pose: 'lie' }, 0, 1, { style: null });
    expect(clamp.visible).toBe(false);
    poseChar(rig, demoGuest(LAB_LOOK, 'band'), 1, 1, { style: null });
    expect(clamp.visible).toBe(true);
  });

  it("makes a bad apple's head an apple core, the face on it and flies going round", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'rotten');
    expect(shown(rig.headMesh)).toBe(false);
    expect(hair(rig).some(shown)).toBe(false);
    expect(shown(rig.face.eyes)).toBe(true);
    // the old apple hanging over them is gone
    expect(rig.bob).toBeUndefined();
    expect(rig.spin?.length).toBeGreaterThan(0);
  });

  it("makes a blue screen's head an old monitor, the face on its screen", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'bluescreen');
    expect(shown(rig.headMesh)).toBe(false);
    expect(hair(rig).some(shown)).toBe(false);
    expect(shown(rig.face.eyes)).toBe(true);
    expect(shown(rig.face.mouth)).toBe(true);
  });

  it("makes crossed wires' head a wall plug, the face on it and its cable wound round and round them", () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'wires');
    expect(shown(rig.headMesh)).toBe(false);
    expect(hair(rig).some(shown)).toBe(false);
    expect(shown(rig.face.eyes)).toBe(true);
    const wound = rig.props.filter((p) => p.parent === rig.torso);
    expect(wound.length).toBeGreaterThanOrEqual(2);
    // round them, wider than the body
    rig.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wound[0]!);
    expect(box.max.x - box.min.x).toBeGreaterThan(0.5);
  });

  it('stands someone snowed in in a snow globe, snowed up to the nose, the eyes clear over it', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'snowcap');
    expect(shown(rig.headMesh)).toBe(true);
    expect(shown(rig.face.eyes)).toBe(true);
    const globe = rig.props[0]!;
    expect(globe.parent).toBe(rig.head);
    rig.group.updateMatrixWorld(true);
    const eyes = new THREE.Box3().setFromObject(rig.face.eyes);
    const mouth = new THREE.Box3().setFromObject(rig.face.mouth);
    const snow = globe.children.find(
      (o) => o instanceof THREE.Mesh && (o.material as THREE.MeshStandardMaterial).color.getHex() === 0xffffff,
    )!;
    const top = new THREE.Box3().setFromObject(snow).max.y;
    // the lumps on the drift reach a little higher than its top
    expect(top).toBeLessThan(eyes.min.y + 0.08);
    expect(top).toBeGreaterThan(mouth.max.y);
    // the old cap of snow is gone
    expect(rig.props).toHaveLength(1);
  });

  it('gives a tension headband, a bad apple, a blue screen, crossed wires and the snowed in their heads back with the cure', () => {
    for (const [visual, id] of [
      ['band', 'band'],
      ['rotten', 'badapple'],
      ['bluescreen', 'bluescreen'],
      ['wires', 'wires'],
      ['snowcap', 'snowedin'],
    ] as const) {
      const rig = buildCharacter(LAB_LOOK, undefined, visual);
      poseChar(rig, { ...demoGuest(LAB_LOOK, id), outcome: 'healed' }, 5, 1, { style: null });
      expect(shown(rig.headMesh), visual).toBe(true);
      expect(rig.head.scale.y, visual).toBe(1);
      expect(rig.props.some(shown), visual).toBe(false);
    }
  });

  it('gives a flat battery their head back with the cure', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'battery');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'battery'), outcome: 'healed' }, 5, 1, { style: null });
    expect(shown(rig.headMesh)).toBe(true);
    expect(rig.head.scale.y).toBe(1);
  });
});

describe('a symptom worn whole', () => {
  /** The bottle someone bottled up stands in. */
  const bottleOf = (rig: CharRig) => rig.props[0]!;

  it('stands someone bottled up in a bottle, their head and face still there through the glass', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'cork');
    expect(rig.props).toHaveLength(1);
    expect(bottleOf(rig).parent).toBe(rig.body);
    expect(rig.headMesh.visible).toBe(true);
    expect(rig.face.eyes.visible).toBe(true);
    // the bottle reaches from below the knees to over the head
    const box = new THREE.Box3().setFromObject(bottleOf(rig));
    const head = new THREE.Box3().setFromObject(rig.headMesh);
    expect(box.max.y).toBeGreaterThan(head.max.y);
    expect(box.min.y).toBeLessThan(0.4);
  });

  it('shares one glass between everyone bottled up, drawn by itself as it is see-through', () => {
    /** The see-through parts of someone's bottle. */
    const glass = (rig: CharRig) => {
      const found = new Set<THREE.Material>();
      bottleOf(rig).traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m?.transparent) found.add(m);
      });
      return [...found];
    };
    const a = glass(buildCharacter(LAB_LOOK, undefined, 'cork'));
    expect(a).toHaveLength(1);
    expect(glass(buildCharacter(LAB_LOOK, undefined, 'cork'))).toEqual(a);
  });

  it('shrinks the bottle away round them with the cure, not down to their feet', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'cork');
    const g = demoGuest(LAB_LOOK, 'bottled');
    poseChar(rig, g, -1, 1, { style: null });
    cureRig(rig, 0);
    const healed = { ...g, outcome: 'healed' as const };
    poseChar(rig, healed, CURE * 0.5, 1, { style: null });
    expect(bottleOf(rig).scale.y).toBeCloseTo(0.5);
    expect(bottleOf(rig).position.y).toBeGreaterThan(0.8);
    poseChar(rig, healed, CURE * 2, 1, { style: null });
    expect(bottleOf(rig).visible).toBe(false);
  });

  it('stands someone glass half empty in a tumbler, the water at the waist and their head dry above it', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'glass');
    expect(rig.props).toHaveLength(1);
    expect(rig.bob).toBeUndefined();
    expect(rig.headMesh.visible).toBe(true);
    const tumbler = rig.props[0]!;
    rig.group.updateMatrixWorld(true);
    // the see-through parts are the glass, made the same throughout, and the water, its own
    const glass = (tumbler.children[0] as THREE.Mesh).material as THREE.Material;
    const water = tumbler.children.find((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material;
      return m.transparent && m !== glass;
    })!;
    const waterTop = new THREE.Box3().setFromObject(water).max.y;
    const whole = new THREE.Box3().setFromObject(tumbler);
    const head = new THREE.Box3().setFromObject(rig.headMesh);
    // half full: the water stops about halfway up the glass, well below the face, and the glass reaches over the head
    expect((waterTop - whole.min.y) / (whole.max.y - whole.min.y)).toBeCloseTo(0.5, 1);
    expect(waterTop).toBeLessThan((head.min.y + head.max.y) / 2 - 0.1);
    expect(whole.max.y).toBeGreaterThan(head.max.y);
    // and the tumbler is the same see-through glass for everyone
    const again = buildCharacter(LAB_LOOK, undefined, 'glass').props[0]!;
    expect((again.children[0] as THREE.Mesh).material).toBe((tumbler.children[0] as THREE.Mesh).material);
  });

  it('storms round the chest of someone with blocked qi, lightning flashing in it a bolt at a time', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'storm');
    const g = demoGuest(LAB_LOOK, 'qi');
    const { bolts, glow } = rig.flash!;
    expect(rig.drips).toBeDefined();
    let flashes = 0;
    let dark = 0;
    for (let t = 0; t < 8; t += 0.02) {
      poseChar(rig, g, t, 1, { style: null });
      const lit = bolts.filter((b) => b.visible).length;
      // never more than one bolt at once, and the cloud glows only while one shows
      expect(lit).toBeLessThanOrEqual(1);
      expect(glow[0]!.emissiveIntensity > 0).toBe(lit === 1);
      if (flashAt(g.id, t) > 0) flashes++;
      else dark++;
    }
    // a flash now and then, dark most of the time
    expect(flashes).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(flashes * 5);
  });

  it('leaves someone scattered in pieces, the head over the shoulders and the body over the legs, each drifting', () => {
    const whole = buildCharacter(LAB_LOOK);
    const rig = buildCharacter(LAB_LOOK, undefined, 'shards');
    expect(rig.head.position.y - whole.head.position.y).toBeGreaterThan(0.15);
    expect(rig.torso.position.y - whole.torso.position.y).toBeGreaterThan(0.15);
    // the shards of them still go round
    expect(rig.orbit).toBeDefined();
    const g = demoGuest(LAB_LOOK, 'scattered');
    const heights = [0, 0.4, 0.8].map((t) => {
      poseChar(rig, g, t, 1, { style: null });
      return [rig.head.position.y, rig.torso.position.y];
    });
    expect(new Set(heights.map(([h]) => h)).size).toBeGreaterThan(1);
    expect(new Set(heights.map(([, b]) => b)).size).toBeGreaterThan(1);
  });

  it('puts someone scattered together while they lie down, to lie on what they lie on', () => {
    const whole = buildCharacter(LAB_LOOK);
    const rig = buildCharacter(LAB_LOOK, undefined, 'shards');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'scattered'), pose: 'lie' }, 0.3, 1, { style: null });
    expect(rig.head.position.toArray()).toEqual(whole.head.position.toArray());
    expect(rig.torso.position.toArray()).toEqual(whole.torso.position.toArray());
  });

  it('puts someone scattered back together with the cure, the head free to turn again', () => {
    const whole = buildCharacter(LAB_LOOK);
    const rig = buildCharacter(LAB_LOOK, undefined, 'shards');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'scattered'), outcome: 'healed' }, 5, 1, { style: null });
    expect(rig.head.position.toArray()).toEqual(whole.head.position.toArray());
    expect(rig.torso.position.toArray()).toEqual(whole.torso.position.toArray());
    expect(rig.spin ?? []).not.toContain(rig.head);
    expect(rig.spin ?? []).not.toContain(rig.torso);
  });

  it('ties someone knotted up in rope, round the chest and arms', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'knot');
    expect(rig.props.length).toBeGreaterThan(0);
    expect(rig.props.every((p) => p.parent === rig.torso)).toBe(true);
    // wider than the shoulders, so it goes round the arms
    rig.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.props[0]!);
    expect(box.max.x - box.min.x).toBeGreaterThan(0.55);
  });

  it('sticks an office chair to someone chair-shaped, put away while they sit or lie on something real', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'chairshape');
    const chair = rig.props[0]!;
    expect(chair.parent).toBe(rig.body);
    const g = demoGuest(LAB_LOOK, 'chairshaped');
    for (const [pose, shows] of [
      ['stand', true],
      ['walk', true],
      ['sit', false],
      ['lie', false],
    ] as const) {
      poseChar(rig, { ...g, pose }, 1, 1, { style: null });
      expect(chair.visible, pose).toBe(shows);
    }
  });

  it('gives someone lobstered a claw for each hand and feelers, put away while they lie down', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'sunburn');
    const { foreL, foreR } = rig.joints;
    for (const fore of [foreL, foreR]) {
      expect(rig.props.some((p) => p.parent === fore)).toBe(true);
      expect(fore.getObjectByName('hand')!.visible).toBe(false);
    }
    const feelers = rig.props.find((p) => p.parent === rig.head && p.children.length > 2)!;
    const g = demoGuest(LAB_LOOK, 'lobstered');
    poseChar(rig, { ...g, pose: 'lie' }, 0, 1, { style: null });
    expect(feelers.visible).toBe(false);
    poseChar(rig, g, 1, 1, { style: null });
    expect(feelers.visible).toBe(true);
    const cured = buildCharacter(LAB_LOOK, undefined, 'sunburn');
    poseChar(cured, { ...g, outcome: 'healed' }, 5, 1, { style: null });
    for (const fore of [cured.joints.foreL, cured.joints.foreR])
      expect(fore.getObjectByName('hand')!.visible).toBe(true);
    expect(cured.props.some((p) => p.visible)).toBe(false);
  });

  it('gives someone with text neck a phone as big as their chest, held clear of them, put away while they lie down', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'neck');
    const phone = rig.joints.foreR.getObjectByName('phone')!;
    expect(phone.scale.x).toBeGreaterThan(2);
    const g = demoGuest(LAB_LOOK, 'neck');
    poseChar(rig, g, 1, 1, { style: null });
    expect(phone.visible).toBe(true);
    // in front of the chest, not through it
    rig.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(phone);
    const chest = new THREE.Box3().setFromObject(rig.torso.getObjectByName('torso') ?? rig.torso);
    expect(box.min.z).toBeGreaterThan(chest.min.z);
    poseChar(rig, { ...g, pose: 'lie' }, 2, 1, { style: null });
    expect(phone.visible).toBe(false);
  });

  it('leaves midlife fog its own cloud over the head', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'cloud');
    expect(rig.flash).toBeUndefined();
    expect(rig.bob).toBeDefined();
  });

  /** How far someone's legs swing out at most over a few strides of walking. */
  const swing = (rig: CharRig, g: Char) => {
    let most = 0;
    for (let i = 0; i < 40; i++) {
      rig.walked = i * 0.05;
      poseChar(rig, { ...g, pose: 'walk' }, i * 0.05, 1, { style: null });
      most = Math.max(most, Math.abs(rig.legL.rotation.x), Math.abs(rig.legR.rotation.x));
    }
    return most;
  };

  it('pots someone spiritually dehydrated from the waist down, the head a cactus and the shirt gone green', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'cactus');
    expect(rig.headMesh.visible).toBe(false);
    expect(rig.face.eyes.visible).toBe(true);
    const shirt = rig.torso.getObjectByName('shirt') as THREE.Mesh;
    expect((shirt.material as THREE.MeshStandardMaterial).color.getHex()).not.toBe(LAB_LOOK.top);
    // the pot round the hips, on the body
    expect(rig.props.some((p) => p.parent === rig.body)).toBe(true);
  });

  it('keeps their legs inside the pot: a shuffle walking, and straight down sitting, even on the floor', () => {
    const g = demoGuest(LAB_LOOK, 'parched');
    expect(swing(buildCharacter(LAB_LOOK, undefined, 'cactus'), g)).toBeLessThanOrEqual(POTTED.stride + 0.01);
    const rig = buildCharacter(LAB_LOOK, undefined, 'cactus');
    poseChar(rig, { ...g, pose: 'sit', h: 0 }, 0, 1, { style: null });
    expect(rig.legL.rotation.x).toBeCloseTo(0);
    expect(rig.legL.rotation.y).toBeCloseTo(0);
  });

  it('walks them as anyone does once the pot is gone with the cure', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'cactus');
    const healed = { ...demoGuest(LAB_LOOK, 'parched'), outcome: 'healed' as const };
    poseChar(rig, healed, 5, 1, { style: null });
    expect(rig.headMesh.visible).toBe(true);
    expect(swing(rig, healed)).toBeGreaterThan(0.4);
  });
});

describe('shoes', () => {
  it('come in the color of the look, sharing the shape everyone has', () => {
    /** The material of someone's shoes, by part name. */
    const shoes = (rig: CharRig) => {
      const found: THREE.Mesh[] = [];
      rig.group.traverse((o) => o.name === 'shoe' && found.push(o as THREE.Mesh));
      return found;
    };
    const white = shoes(buildCharacter({ ...LAB_LOOK, shoes: 3 }));
    const brown = shoes(buildCharacter(LAB_LOOK));
    expect(white).toHaveLength(2);
    expect((white[0]!.material as THREE.MeshStandardMaterial).color.getHex()).toBe(SHOES[3]);
    expect((brown[0]!.material as THREE.MeshStandardMaterial).color.getHex()).toBe(SHOES[0]);
    expect(white[0]!.geometry).toBe(brown[0]!.geometry);
  });
});

describe('the moment of a cure', () => {
  /** A guest with a hen on their head, seen before they are healed, and the same guest healed. */
  function henned() {
    const rig = buildCharacter(LAB_LOOK, undefined, 'chicken');
    const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
    poseChar(rig, g, -1, 1, { style: null });
    return { rig, healed: { ...g, outcome: 'healed' as const } };
  }

  it('shrinks the symptom away in a puff of sparkles, then puts it away', () => {
    const { rig, healed } = henned();
    const hen = rig.props[0]!;
    const built = hen.scale.x;
    cureRig(rig, 0);
    poseChar(rig, healed, CURE / 2, 1, { style: null });
    expect(hen.visible).toBe(true);
    expect(hen.scale.x / built).toBeCloseTo(0.5);
    expect(rig.burst?.group.visible).toBe(true);
    poseChar(rig, healed, 1, 1, { style: null });
    expect(hen.visible).toBe(false);
    expect(hen.scale.x).toBe(built);
    expect(rig.burst?.group.visible).toBe(false);
    expect(rig.cured).toBe(true);
  });

  it('starts as they are healed in sight, with a hop', () => {
    const { rig, healed } = henned();
    poseChar(rig, healed, 5, 1, { style: null });
    expect(rig.curedAt).toBe(5);
    poseChar(rig, healed, 5.25, 1, { style: null });
    expect(rig.body.position.y).toBeGreaterThan(0.08);
  });

  it('does not play for someone seen first already healed, as from a save', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'chicken');
    poseChar(rig, { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), outcome: 'healed' }, 5, 1, { style: null });
    expect(rig.cured).toBe(true);
    expect(rig.props[0]!.visible).toBe(false);
    expect(rig.burst).toBeUndefined();
  });
});

describe('at work', () => {
  /** How far someone at work moves about over a few seconds: the most each of a few angles goes from one to another. */
  function range(c: Char, style: WorkStyle, parts: (rig: CharRig) => number[]) {
    const rig = buildCharacter(LAB_LOOK, c.kind === 'staff' ? c.role : undefined);
    const seen: number[][] = [];
    for (let t = 0; t < 8; t += 0.05) {
      poseChar(rig, c, t, 0.05, { style });
      seen.push(parts(rig));
    }
    return seen[0]!.map((_, i) => Math.max(...seen.map((s) => s[i]!)) - Math.min(...seen.map((s) => s[i]!)));
  }

  it('rocks gently over slow, aloof work and briskly over quick', () => {
    const at = { ...demoStaff(LAB_LOOK, 'healer'), pose: 'stand' as const, busy: true };
    const [aloof, brisk] = (['distance', 'kneading'] as const).map(
      (style) => range(at, style, (r) => [r.torso.rotation.x])[0]!,
    );
    expect(aloof).toBeLessThan(brisk! / 2);
    expect(RHYTHM.distance).toBeLessThan(RHYTHM.swedish);
  });

  it('wears the Caretaker’s cap pushed back, the brim up off the face', () => {
    const rig = buildCharacter(LAB_LOOK, 'caretaker');
    expect(rig.head.getObjectByName('cap')?.rotation.x).toBe(CAP_TIP);
    expect(CAP_TIP).toBeLessThan(-0.2);
  });
});
