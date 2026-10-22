// How a person's state shows on their body and face: a waiting guest's patience in how they stand and sit, a face for
// how they feel, and a member of staff with nothing to do passing the time.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { ITEMS, POOR_CONDITION } from '../../src/core/data';
import { SHOES } from '../../src/core/people';
import type { Char } from '../../src/core/state/types';
import { demoGuest, demoStaff, demoVisitor, LAB_LOOK } from '../../src/lab/people';
import { type Act, actOf, lyingAt } from '../../src/render/acts';
import { buildCharacter, type CharRig } from '../../src/render/models/character';
import {
  actMoment,
  BLINK,
  blinkAt,
  expressionOf,
  hasNothingToDo,
  IDLE,
  idleAct,
  idleMoment,
  moodFor,
  moodOf,
  PATIENCE_SIGNS,
  poseChar,
  PRONE_TURN,
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
    expect(lyingAt({ ...lying(), state: 'resting' }, ITEMS.recliner)).toBe('back');
    // a machine lays them down its own way
    expect(lyingAt(lying(), ITEMS.stone_kiln)).toBeUndefined();
    // and someone on their way there is not lying yet
    expect(lyingAt({ ...lying(), pose: 'walk' }, ITEMS.massage_table)).toBeUndefined();
    expect(lyingAt(lying(), ITEMS.bench)).toBeUndefined();
  });

  it('turns the face aside, face down, so it shows', () => {
    const rig = buildCharacter(LAB_LOOK);
    poseChar(rig, lying(), 0, 1, { style: null, lie: 'prone' });
    rig.group.updateMatrixWorld(true);
    expect(rig.head.rotation.y).toBeCloseTo(PRONE_TURN);
    expect(rig.body.rotation.x).toBeCloseTo(Math.PI / 2);
    const face = faceOf(rig);
    expect(Math.abs(face.y)).toBeLessThan(0.3);
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
