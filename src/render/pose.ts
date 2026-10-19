// How a person is posed each frame: walking, sitting, lying down, working, and showing their symptoms.

import { type Modality, POOR_CONDITION } from '../core/data';
import { aboutToQuit } from '../core/sim/staffing';
import type { Char } from '../core/state/types';
import { type CharRig, cureRig, type Joints } from './models/character';
import { emojiTexture } from './models/emoji';
import { driftSmoke } from './models/sage';

/** Whether someone is walking a room with a bundle of sage, clearing it of bad vibes. */
export const wafting = (c: Char) => c.kind === 'staff' && c.state === 'doingJob' && c.job?.kind === 'smudge';

/** How someone is working, so each kind of work moves differently: a treatment they are giving, or Qi Gong. */
export type WorkStyle = Modality | 'qigong' | null;

/** Pose a person for this frame: position, limbs, symptom effects and speech bubble. */
export function poseChar(rig: CharRig, c: Char, t: number, dt: number, style: WorkStyle) {
  rig.group.position.set(c.x, c.h, c.y);
  rig.group.rotation.y = c.facing;
  const healed = c.kind === 'guest' && c.outcome === 'healed';
  if (healed) cureRig(rig, c.look);
  const visual = healed ? undefined : rig.visual;
  const phase = t * 9.5 + c.id * 1.7;
  let legL = 0;
  let legR = 0;
  let armL = Math.sin(t * 1.6 + c.id) * 0.05;
  let armR = -armL;
  let armOut = 0.06;
  let lean = 0;
  let headX = 0;
  let bodyRX = 0;
  let bodyY = 0;
  let bodyZ = 0;
  let headZ = 0;
  /** Leaning to one side, for a guest who is off balance. */
  let side = 0;
  if (c.pose === 'walk') {
    const sw = Math.sin(phase) * (visual === 'stiff' ? 0.14 : 0.62);
    legL = sw;
    legR = -sw;
    armL = -sw * 0.85;
    armR = sw * 0.85;
    bodyY = Math.abs(Math.cos(phase)) * 0.04;
    if (healed) bodyY += Math.abs(Math.sin(phase * 0.5)) * 0.07;
  } else if (c.pose === 'sit') {
    legL = legR = -Math.PI / 2 + 0.08;
    bodyY = 0.06;
    armL = armR = -0.55;
    if (c.busy) armR = -1.15 + Math.sin(t * 6 + c.id) * 0.25;
    if (c.busy && style === 'sound') {
      // one hand steadying a bowl, the other circling its rim
      armL = -0.95;
      armR = -1.05 + Math.sin(t * 3 + c.id) * 0.14;
      lean = 0.15;
    } else if (c.busy && style === 'forks') {
      // striking a fork on the knee, then holding it up to listen
      const tap = Math.max(0, Math.sin(t * 4 + c.id));
      armR = -1.5 + tap * 0.6;
      armL = -0.7;
      headZ = 0.15;
    } else if (c.busy && style === 'gong') {
      // a long slow backswing, then a soft stroke through
      const swing = Math.sin(t * 1.6 + c.id);
      armR = -1.75 + swing * 0.7;
      armL = -0.6;
      lean = 0.1 - swing * 0.12;
    } else if (c.busy && style === 'crystalbowls') {
      // both hands drawing slow circles round two rims
      armL = -1.0 + Math.sin(t * 2 + c.id) * 0.12;
      armR = -1.0 + Math.sin(t * 2 + c.id + Math.PI) * 0.12;
      lean = 0.2;
    } else if (c.busy && style === 'overtone') {
      // hands in the lap, head tipped back, swaying a little on the long notes
      armL = armR = -0.45;
      headX = -0.35;
      side = Math.sin(t * 0.8 + c.id) * 0.08;
    }
    if (c.busy && style === 'reading') {
      // chin in hand, studying the guest, with a slow knowing nod now and then
      armR = -2.0;
      armL = -0.5;
      headZ = 0.22;
      headX = 0.12 + Math.max(0, Math.sin(t * 1.3 + c.id)) * 0.18;
    } else if (c.busy && style === 'extraction') {
      // reaching in, then hauling back hard on something that does not want to come, the rattle going all the while
      const pull = Math.max(0, Math.sin(t * 2.6 + c.id));
      armL = -1.4 + pull * 0.7;
      armR = -1.4 + pull * 0.7 + Math.sin(t * 22 + c.id) * 0.08;
      lean = 0.3 - pull * 0.5;
    } else if (c.busy && style === 'sweat') {
      // ladling water onto the hot stones, and wiping a brow
      armR = -0.9 + Math.sin(t * 1.8 + c.id) * 0.5;
      armL = -0.4;
      lean = 0.1;
      headX = -0.1;
    } else if (c.busy && style === 'mushroom') {
      // swaying slowly with both hands held out, eyes on the ceiling
      armL = armR = -0.8;
      armOut = 0.45;
      side = Math.sin(t * 0.9 + c.id) * 0.12;
      headX = -0.2;
    } else if (c.busy && style === 'quest') {
      // eyes on the far distance, one hand shading them, the other pointing the way, turning slowly to look about
      armL = -2.4;
      armR = -1.6;
      armOut = 0.25;
      headX = -0.15;
      side = Math.sin(t * 0.5 + c.id) * 0.06;
    } else if (c.busy && style === 'ayahuasca') {
      // singing over the guest, shaking a bundle of leaves in a steady rustle
      armR = -1.6 + Math.sin(t * 9 + c.id) * 0.12;
      armL = -0.5;
      headX = -0.3;
      side = Math.sin(t * 1.2 + c.id) * 0.1;
    }
    if (c.kind === 'staff' && c.state === 'training') {
      // head down, scribbling notes
      armR = -1.05 + Math.sin(t * 9 + c.id) * 0.08;
      headX = 0.32 + Math.sin(t * 0.7 + c.id) * 0.08;
    }
  } else if (c.pose === 'lie') {
    bodyRX = Math.PI / 2;
    bodyY = 0.16;
    bodyZ = -0.6 * rig.scale;
    armOut = 0.5;
  } else if (style === 'qigong') {
    // lifting the sky: both arms rise slowly out and overhead, then float back down, knees softening as they fall
    const rise = (1 - Math.cos(t * 0.9)) / 2;
    armL = armR = -0.2 - rise * 2.6;
    armOut = 0.1 + Math.sin(rise * Math.PI) * 0.5;
    bodyY = -0.03 * (1 - rise);
    headX = -0.15 * rise;
  } else if (c.busy && style === 'deep') {
    // both elbows in, slow and heavy
    const press = Math.sin(t * 3.2 + c.id);
    lean = 0.4 + press * 0.07;
    armL = armR = -0.95 + press * 0.2;
    bodyY = -0.02 - press * 0.025;
  } else if (c.busy && style === 'sports') {
    // hauling on a limb, rocking back and forth
    const pull = Math.sin(t * 2.3 + c.id);
    lean = 0.08 + pull * 0.26;
    armL = armR = -1.35 - pull * 0.15;
  } else if (c.busy && style === 'stone') {
    // placing stones one at a time
    lean = 0.16;
    armL = -1.1 + Math.max(0, Math.sin(t * 2 + c.id)) * 0.35;
    armR = -1.1 + Math.max(0, Math.sin(t * 2 + c.id + Math.PI)) * 0.35;
  } else if (c.busy && style === 'cranio') {
    // hands held almost perfectly still, head bowed in concentration
    lean = 0.3;
    headX = 0.28;
    armL = armR = -1.25 + Math.sin(t * 1.1 + c.id) * 0.025;
  } else if (c.busy && (style === 'needling' || style === 'electro')) {
    // one steady hand, one quick precise tap at a time
    lean = 0.24;
    headX = 0.2;
    armL = -1.15;
    armR = -1.25 + Math.max(0, Math.sin(t * (style === 'electro' ? 3 : 5.5) + c.id)) * 0.3;
  } else if (c.busy && style === 'cupping') {
    // setting cups down one after another
    lean = 0.18;
    armL = -1.1 + Math.max(0, Math.sin(t * 2.4 + c.id)) * 0.4;
    armR = -1.1 + Math.max(0, Math.sin(t * 2.4 + c.id + Math.PI)) * 0.4;
  } else if (c.busy && style === 'moxa') {
    // holding a smoldering stick just above the skin, moving it slowly
    lean = 0.22;
    armL = -0.5;
    armR = -1.3 + Math.sin(t * 1.3 + c.id) * 0.08;
  } else if (c.busy && (style === 'usui' || style === 'crystal')) {
    // palms held just above the body, barely moving
    lean = 0.24;
    headX = 0.12;
    armL = armR = -1.32 + Math.sin(t * 0.9 + c.id) * 0.06;
  } else if (c.busy && style === 'chakra') {
    // hands working slowly from one center to the next
    lean = 0.24;
    armL = -1.25 + Math.sin(t * 0.6 + c.id) * 0.25;
    armR = -1.25 + Math.sin(t * 0.6 + c.id + 0.4) * 0.25;
  } else if (c.busy && style === 'distance') {
    // one palm held out toward the guest, face turned away as if it is beneath them to look
    armR = -1.45 + Math.sin(t * 0.7 + c.id) * 0.04;
    armL = 0.05;
    headZ = 0.75;
    lean = -0.05;
  } else if (c.busy && style === 'swedish') {
    // long flowing strokes
    lean = 0.2;
    armL = -1.2 + Math.sin(t * 4.2 + c.id) * 0.42;
    armR = -1.2 + Math.sin(t * 4.2 + c.id + Math.PI) * 0.42;
  } else if (c.busy) {
    lean = 0.2;
    armL = -1.2 + Math.sin(t * 7.5 + c.id) * 0.32;
    armR = -1.2 + Math.sin(t * 7.5 + c.id + Math.PI) * 0.32;
  }
  const smudging = wafting(c);
  if (smudging) {
    // the sage held up and swung in slow arcs, the other hand fanning the smoke along
    armR = -1.15 + Math.sin(t * 4.2 + c.id) * 0.4;
    armL = -0.75 + Math.sin(t * 4.2 + c.id + 1.2) * 0.3;
    headX = -0.1;
  }
  if (c.kind === 'staff' && c.state === 'doingJob' && (c.job?.kind === 'soul' || c.job?.kind === 'ward')) {
    // both hands held up, toward the one whose soul it is or to the sky, beckoning in slow circles
    armL = -1.7 + Math.sin(t * 2.4 + c.id) * 0.3;
    armR = -1.7 + Math.sin(t * 2.4 + c.id + Math.PI) * 0.3;
    armOut = 0.35;
    headX = -0.15;
  }
  // stressed in an outbreak: a nervous glance one way and the other
  if (c.kind === 'guest' && c.stressed && c.pose !== 'lie') headZ += Math.sin(t * 13 + c.id) * 0.12;
  if (visual === 'slump') {
    lean += 0.42;
    headX += 0.2;
  } else if (visual === 'neck') headX += 0.6;
  else if (visual === 'stiff') {
    armOut = 0.32;
    if (c.pose !== 'sit') armL = armR = 0;
  } else if (visual === 'crick') headZ = 0.55;
  else if (visual === 'sway' && c.pose !== 'lie') side = Math.sin(t * 1.4 + c.id) * 0.16;
  else if (visual === 'tilt') {
    side = 0.24;
    headZ = -0.12;
  } else if (visual === 'battery') {
    lean += 0.18;
    headX += 0.15;
  } else if (visual === 'blanket') lean += 0.12;
  else if (visual === 'flex') {
    armOut = 2.35;
    armL = armR = 0;
  } else if (visual === 'frost') armR = c.pose === 'sit' ? armR : 0;
  else if (visual === 'icicles') {
    // stiff with cold, and shivering
    armOut = 0.2;
    side = Math.sin(t * 38 + c.id) * 0.025;
  } else if (visual === 'thermometer') headZ += Math.sin(t * 21 + c.id) * 0.04;
  if (c.pose === 'lie') {
    lean = 0;
    headX = 0;
    headZ = 0;
    side = 0;
    if (visual === 'flex') armOut = 0.5;
  }
  // people move with life: weight shifting, follow-through, breathing and fidgets, unless too stiff to
  // only someone with their hands free (the inspector carries a clipboard) and no symptom to show fidgets with their
  // arms
  const handsFree = !visual && !(c.kind === 'visitor' && c.visit === 'inspector');
  const life = visual !== 'stiff' ? liveliness(c, t, phase, style, smudging, armL, armR, handsFree) : NO_LIFE;
  lean += life.lean;
  side += life.side;
  headX += life.headX;
  headZ += life.headZ;
  bodyY += life.bodyY;
  armL += life.armL;
  armR += life.armR;
  armOut += life.armOut;
  const k = Math.min(1, dt * 14);
  const b = rig.body;
  b.rotation.x += (bodyRX - b.rotation.x) * k;
  b.position.y += (bodyY - b.position.y) * k;
  b.position.z += (bodyZ - b.position.z) * k;
  rig.torso.rotation.x += (lean - rig.torso.rotation.x) * k;
  rig.torso.rotation.z += (side - rig.torso.rotation.z) * k;
  rig.head.rotation.x += (headX - rig.head.rotation.x) * k;
  rig.head.rotation.z += (headZ - rig.head.rotation.z) * k;
  rig.legL.rotation.x += (legL - rig.legL.rotation.x) * k;
  rig.legR.rotation.x += (legR - rig.legR.rotation.x) * k;
  rig.armL.rotation.x += (armL - rig.armL.rotation.x) * k;
  rig.armR.rotation.x += (armR - rig.armR.rotation.x) * k;
  rig.armL.rotation.z += (-armOut + life.armInL - rig.armL.rotation.z) * k;
  rig.armR.rotation.z += (armOut - rig.armR.rotation.z) * k;
  poseJoints(rig.joints, rig, c, t, k, { legL, legR, armL, armR, phase, visual, style }, life);
  if (rig.band?.visible) rig.band.scale.setScalar(1 + Math.sin(t * 6 + c.id) * 0.05);
  if (visual === 'jitter' && c.pose !== 'lie') {
    // pins and needles: a constant fizzing shiver
    rig.body.position.x = Math.sin(t * 47 + c.id) * 0.012;
    rig.legL.rotation.z = Math.sin(t * 39 + c.id) * 0.07;
    rig.legR.rotation.z = Math.sin(t * 43 + c.id) * 0.07;
  } else if (rig.visual === 'jitter') {
    rig.body.position.x = 0;
    rig.legL.rotation.z = rig.legR.rotation.z = 0;
  }
  if (rig.bob && !rig.cured) {
    rig.bob.position.y = 0.4 + Math.sin(t * 2.2 + c.id) * 0.03;
    rig.bob.visible = c.pose !== 'lie';
  }
  if (rig.blink) rig.blink.emissiveIntensity = Math.sin(t * 6 + c.id) > 0 ? 1.5 : 0.05;
  if (rig.orbit && !rig.cured) {
    rig.orbit.rotation.y = t * 3.5 + c.id;
    rig.orbit.visible = c.pose !== 'lie';
  }
  if (rig.knot?.visible) rig.knot.rotation.z = Math.sin(t * 2 + c.id) * 0.2;
  if (rig.steam?.visible) {
    rig.steam.children.forEach((p, i) => {
      const f = (t * 0.9 + i * 0.33 + c.id * 0.1) % 1;
      p.position.y = f * 0.4;
      p.scale.setScalar(0.5 + f);
      p.visible = c.pose !== 'lie';
    });
  }

  if (rig.sage && rig.sageTip && rig.smoke) {
    rig.sage.visible = smudging;
    if (smudging) rig.group.updateMatrixWorld(true);
    driftSmoke(rig.smoke, rig.sageTip, t, smudging);
  }

  // someone about to quit keeps a warning over their head until it is dealt with
  let bubble = c.kind === 'staff' && aboutToQuit(c) ? '⚠️' : c.bubbleT > 0 ? c.bubble : '';
  if (!bubble && c.kind === 'guest') {
    const waiting = c.state === 'waiting' || c.state === 'toWait';
    if (waiting && c.patience < 25) bubble = '💢';
    else if (waiting && !c.outcome && c.health < POOR_CONDITION) bubble = '🤕';
    else if (waiting && c.bladder >= 95) bubble = '🚻';
    else if (waiting && c.thirst >= 95) bubble = '🍵';
  } else if (!bubble && c.kind === 'staff') {
    if (c.state === 'onBreak') bubble = '💤';
    else if (c.state === 'training') bubble = '📚';
    else if (c.energy < 15) bubble = '😴';
  }
  if (bubble !== rig.bubbleKey) {
    rig.bubbleKey = bubble;
    rig.bubble.visible = !!bubble;
    if (bubble) {
      rig.bubble.material.map = emojiTexture(bubble);
      rig.bubble.material.needsUpdate = true;
    }
  }
  if (bubble) rig.bubble.position.y = (c.pose === 'lie' ? 1.0 : 1.72) + Math.sin(t * 3 + c.id) * 0.04;
}

/** How a person's limbs are posed this frame, from which the knees, elbows and waist follow. */
interface Limbs {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  phase: number;
  visual: CharRig['visual'];
  style: WorkStyle;
}

/** How far an elbow bends for an arm raised this far: hanging, a little; reaching forward, more; straight overhead. */
export const elbowFor = (arm: number) => (arm < -2 ? -0.12 : -(0.2 + Math.min(1, Math.max(0, -arm - 0.3)) * 0.6));

/**
 * Pose the knees, elbows and waist of someone built with them, following their legs and arms: a knee bends as its leg
 * swings through a step and the shoulders turn against the hips, shins hang down from a seat, and elbows bend as the
 * arms reach forward.
 */
function poseJoints(j: Joints, rig: CharRig, c: Char, t: number, k: number, limbs: Limbs, life: Life) {
  const { legL, legR, armL, armR, phase, visual, style } = limbs;
  let kneeL = 0.04;
  let kneeR = 0.04;
  let twist = 0;
  if (c.pose === 'walk') {
    kneeL = 0.08 + Math.max(0, -Math.cos(phase)) * 0.95;
    kneeR = 0.08 + Math.max(0, Math.cos(phase)) * 0.95;
    twist = Math.sin(phase) * 0.14;
  } else if (c.pose === 'sit') {
    kneeL = -legL;
    kneeR = -legR;
  } else if (c.pose === 'lie') kneeL = kneeR = 0.03;
  else if (style === 'qigong') kneeL = kneeR = 0.3 * (1 + Math.cos(t * 0.9)) * 0.5;
  else if (c.busy) kneeL = kneeR = 0.12;
  let elbowL = elbowFor(armL);
  let elbowR = elbowFor(armR);
  if (visual === 'stiff') {
    kneeL = kneeR = 0;
    elbowL = elbowR = 0;
    twist = 0;
  } else if (visual === 'flex' && c.pose !== 'lie') elbowL = elbowR = -1.5;
  kneeL += life.kneeL;
  kneeR += life.kneeR;
  elbowL += life.elbowL;
  elbowR += life.elbowR;
  j.shinL.rotation.x += (kneeL - j.shinL.rotation.x) * k;
  j.shinR.rotation.x += (kneeR - j.shinR.rotation.x) * k;
  j.foreL.rotation.x += (elbowL - j.foreL.rotation.x) * k;
  j.foreR.rotation.x += (elbowR - j.foreR.rotation.x) * k;
  rig.torso.rotation.y += (twist - rig.torso.rotation.y) * k;
  rig.head.rotation.y += (life.headYaw - rig.head.rotation.y) * k;
  rig.body.rotation.y += (life.bodyYaw - rig.body.rotation.y) * k;
  rig.body.position.x += (life.swayX - rig.body.position.x) * k;
}

/** What liveliness adds to a pose: turns in radians and shifts in meters, on top of what the pose sets. */
interface Life {
  lean: number;
  side: number;
  headX: number;
  headZ: number;
  /** The head turning to look one way or the other. */
  headYaw: number;
  bodyY: number;
  /** The hips shifting sideways, over one foot or the other. */
  swayX: number;
  /** The hips turning, against the shoulders as they walk. */
  bodyYaw: number;
  armL: number;
  armR: number;
  armOut: number;
  /** The left arm turning in across the body, to bring a watch in front. */
  armInL: number;
  kneeL: number;
  kneeR: number;
  elbowL: number;
  elbowR: number;
}

/** No liveliness: for someone too stiff to move. */
const NO_LIFE: Readonly<Life> = {
  lean: 0,
  side: 0,
  headX: 0,
  headZ: 0,
  headYaw: 0,
  bodyY: 0,
  swayX: 0,
  bodyYaw: 0,
  armL: 0,
  armR: 0,
  armOut: 0,
  armInL: 0,
  kneeL: 0,
  kneeR: 0,
  elbowL: 0,
  elbowR: 0,
};

/** A steady pseudo-random number from 0 to 1 for a number, the same every time. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** The small things people do while they wait: standing, and sitting. */
type Fidget = 'look' | 'watch' | 'stretch' | 'tap' | 'swing';
const STANDING_FIDGETS: readonly (Fidget | null)[] = ['look', 'watch', 'look', 'stretch', 'tap', 'look', null];
const SEATED_FIDGETS: readonly (Fidget | null)[] = ['look', 'watch', 'swing', 'swing', null];

/** The fidgets that take over the arms. */
const ARM_FIDGETS: ReadonlySet<Fidget> = new Set(['watch', 'stretch']);

/** How often someone may fidget, and how long a fidget lasts, in seconds. */
const FIDGET = { every: 5.5, lasts: 1.9 };

/** What someone is fidgeting with now, if anything, how far into it they are (0 to 1, easing in and out), and which
 * way they turn, from a steady roll for each person and stretch of time. */
function fidgetAt(id: number, t: number, kinds: readonly (Fidget | null)[]) {
  const s = t + id * 1.37;
  const n = Math.floor(s / FIDGET.every);
  const u = (s - n * FIDGET.every) / FIDGET.lasts;
  const kind = kinds[Math.floor(hash(n * 7.1 + id * 3.3) * kinds.length)];
  if (u >= 1 || !kind) return null;
  return { kind, amount: Math.min(1, Math.sin(Math.PI * u) * 1.6), way: hash(n * 3.7 + id) < 0.5 ? -1 : 1 };
}

/** How fast each treatment's strokes go, in radians a second, matching the arms' rhythm in `poseChar`. */
const RHYTHM: Partial<Record<Modality, number>> = {
  swedish: 4.2,
  deep: 3.2,
  sports: 2.3,
  stone: 2,
  cupping: 2.4,
  needling: 5.5,
  electro: 3,
  cranio: 1.1,
  usui: 0.9,
  crystal: 0.9,
  chakra: 0.6,
  moxa: 1.3,
};

/**
 * The life a person built with knees and elbows moves with, on top of their pose. Walking, the hips shift over each
 * foot as it takes the weight and turn against the shoulders, the step bounces, and the head and forearms trail a
 * beat behind. Standing, they breathe, shift their weight from foot to foot with the other knee easing, and every so
 * often fidget: a look round, a glance at a watch, a stretch, a tapping foot. Sitting, they
 * breathe, swing their feet and look about. Working, they lean into each stroke and shift their weight in its rhythm,
 * knees giving, head following the hands. `armL` and `armR` are the arms' turns as posed, which a fidget takes over;
 * someone holding something or showing a symptom with their arms only looks round instead.
 */
function liveliness(
  c: Char,
  t: number,
  phase: number,
  style: WorkStyle,
  smudging: boolean,
  armL: number,
  armR: number,
  handsFree: boolean,
): Life {
  const life = { ...NO_LIFE };
  if (c.pose === 'lie') return life;
  const breath = Math.sin(t * 1.7 + c.id);
  if (c.pose === 'walk') {
    const cp = Math.cos(phase);
    const sp = Math.sin(phase);
    life.swayX = -cp * 0.022;
    life.side = cp * 0.035;
    life.bodyY = Math.abs(cp) * 0.012;
    life.lean = 0.07;
    life.headX = -0.03 + Math.sin(2 * phase + 0.9) * 0.035;
    life.headYaw = -sp * 0.09;
    life.bodyYaw = -sp * 0.06;
    life.elbowL = -0.22 * (0.5 + 0.5 * Math.sin(phase + 2.2));
    life.elbowR = -0.22 * (0.5 + 0.5 * Math.sin(phase + 2.2 + Math.PI));
    life.armOut = 0.08;
    return life;
  }
  // breathing, whatever else they are doing
  life.lean = breath * 0.012;
  life.bodyY = breath * 0.004;
  life.headX = -breath * 0.012;
  if (c.busy && c.pose === 'stand' && style !== 'qigong') {
    const f = (style && RHYTHM[style]) ?? 7.5;
    // gentle treatments barely move the body; brisk ones rock it
    const push = Math.sin(t * f + c.id) * Math.min(1, f / 3);
    life.swayX = push * 0.02;
    life.lean += push * 0.05;
    life.kneeL = life.kneeR = 0.05 * (1 + push);
    life.bodyY -= 0.01 * (1 + push);
    life.headYaw = push * 0.1;
    life.headX += 0.04;
    return life;
  }
  if (c.busy || smudging || style) return life;
  const fidget = fidgetAt(c.id, t, c.pose === 'sit' ? SEATED_FIDGETS : STANDING_FIDGETS);
  if (c.pose === 'stand') {
    const w = Math.sin(t * 0.42 + c.id * 2.1);
    life.swayX = w * 0.02;
    life.side += w * 0.04;
    life.kneeL = Math.max(0, w) * 0.16;
    life.kneeR = Math.max(0, -w) * 0.16;
    life.bodyY -= Math.abs(w) * 0.008;
  }
  if (!fidget) return life;
  const { amount: a, way } = fidget;
  const kind = handsFree || !ARM_FIDGETS.has(fidget.kind) ? fidget.kind : 'look';
  if (kind === 'look') {
    life.headYaw = way * 0.7 * a;
    life.headX -= 0.05 * a;
  } else if (kind === 'watch') {
    // the forearm brought up level in front of the body, the wrist turned in to read it, and a look down at it
    life.armL = (-0.45 - armL) * a;
    life.elbowL = -1.25 * a;
    life.armInL = 0.3 * a;
    life.headX += 0.32 * a;
    life.headYaw = -0.3 * a;
  } else if (kind === 'stretch') {
    life.armL = (-2.9 - armL) * a;
    life.armR = (-2.9 - armR) * a;
    life.lean -= 0.12 * a;
    life.bodyY += 0.02 * a;
    life.headX -= 0.2 * a;
  } else if (kind === 'tap') {
    life.kneeR += 0.22 * Math.max(0, Math.sin(t * 13)) * a;
    life.swayX -= 0.015 * a;
  } else {
    life.kneeL += 0.3 * Math.sin(t * 3.2) * a;
    life.kneeR += 0.3 * Math.sin(t * 3.2 + Math.PI) * a;
  }
  return life;
}
