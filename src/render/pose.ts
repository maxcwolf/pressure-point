// How a person is posed each frame: walking, sitting, lying down, working, and showing their symptoms.

import * as THREE from 'three';

import { FREAK_RANGE, type Modality, POOR_CONDITION } from '../core/data';
import { aboutToQuit } from '../core/sim/staffing';
import type { Char } from '../core/state/types';
import { must } from '../core/util';
import type { Act, Lying } from './acts';
import {
  BUBBLE_SIZE,
  BUBBLE_TAIL,
  bubbleScale,
  type BubbleShown,
  follow,
  nudging,
  POP_IN,
  quiet,
  type Said,
  saying,
} from './bubbles';
import { rattle, RATTLE_PEAK } from './item-cues';
import { buildBurst } from './models/burst';
import { type CharRig, cureRig, endCure, type Joints } from './models/character';
import { type Expression, showExpression, showEyes } from './models/character-detail';
import { buildHeld, type HeldKind } from './models/held';
import { iconTexture } from './models/icons';
import { mat } from './models/parts';
import { driftSmoke } from './models/sage';

/**
 * A hip's rotation that points its thigh along `along` and turns it on its own length so the knee hinges about
 * `hinge`, the shin swinging toward `hinge × along` as the knee bends.
 */
function hip(along: THREE.Vector3, hinge: THREE.Vector3) {
  const d = along.normalize();
  const h = hinge.addScaledVector(d, -hinge.dot(d)).normalize();
  const swing = new THREE.Vector3().crossVectors(h, d);
  return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(h, d.clone().negate(), swing.negate()));
}

/**
 * How people sit on the floor: below the height `floor`, rather than on a seat, they sit cross-legged. Each thigh points
 * forward, out and down to a knee on the floor, turned outward so its knee hinges about the vertical, tipped forward so
 * the foot lies down, and the shin folds in across the body, the right one bent a little less to cross in front.
 */
const SIT = {
  floor: -0.1,
  crossed: {
    left: hip(new THREE.Vector3(-0.8, -0.42, 0.6), new THREE.Vector3(0, 1, 0.6)),
    right: hip(new THREE.Vector3(0.8, -0.34, 0.6), new THREE.Vector3(0, -1, -0.6)),
    kneeL: 2.5,
    kneeR: 2.2,
  },
};

/** Whether someone is walking a room with a bundle of sage, clearing it of bad vibes. */
export const wafting = (c: Char) => c.kind === 'staff' && c.state === 'doingJob' && c.job?.kind === 'smudge';

/** How someone is working, so each kind of work moves differently: a treatment they are giving, or Qi Gong. */
export type WorkStyle = Modality | 'qigong' | null;

/**
 * The patience under which a waiting guest shows each mood, so a player can see it running out in time to act. Above
 * them all a guest is content. Restless, they shift their weight and glance about; impatient, they fold their arms and
 * tap a foot; fed up, they stand with their hands on their hips (or sit with their head in their hands) turned toward
 * the door, and the 💢 bubble goes up as the last alarm before they leave.
 */
export const PATIENCE_SIGNS = { restless: 60, impatient: 40, fedUp: 25 } as const;

/** How a guest's patience shows in how they stand and sit. */
export type Mood = 'content' | keyof typeof PATIENCE_SIGNS;

/** The mood a waiting guest with this much patience is in. */
export function moodFor(patience: number): Mood {
  if (patience < PATIENCE_SIGNS.fedUp) return 'fedUp';
  if (patience < PATIENCE_SIGNS.impatient) return 'impatient';
  if (patience < PATIENCE_SIGNS.restless) return 'restless';
  return 'content';
}

/** How someone's patience shows: a guest waiting for their turn, or on their way to wait, by it; anyone else, content. */
export const moodOf = (c: Char): Mood =>
  c.kind === 'guest' && (c.state === 'waiting' || c.state === 'toWait') ? moodFor(c.patience) : 'content';

/**
 * The face someone wears. A guest: delighted once healed, frightened on a really bad trip or stressed in an outbreak,
 * unhappy if they leave otherwise worse off or as their patience runs short, wincing in poor condition. Staff: unhappy
 * about to quit, wincing worn out. Else, at ease.
 */
export function expressionOf(c: Char): Expression {
  if (c.kind === 'guest') {
    if (c.outcome === 'healed') return 'delighted';
    if (c.state === 'running' || c.stressed) return 'scared';
    if (c.outcome === 'stormed' || c.outcome === 'failed' || c.outcome === 'worse') return 'unhappy';
    if (c.patience < PATIENCE_SIGNS.impatient) return 'unhappy';
    if (!c.outcome && c.health < POOR_CONDITION) return 'wince';
  } else if (c.kind === 'staff') {
    if (aboutToQuit(c)) return 'unhappy';
    if (c.energy < 15) return 'wince';
  }
  return 'neutral';
}

/**
 * Whether a member of staff has nothing to do: at their post with no one to see, or standing or wandering about for
 * want of work. Someone on a break or training has something to do.
 */
export const hasNothingToDo = (c: Char) =>
  c.kind === 'staff' && !c.busy && (c.state === 'atPost' || c.state === 'idle' || c.state === 'wander');

/** What a member of staff with nothing to do does to pass the time, each in turn. */
export type IdleAct = 'stretch' | 'look' | 'watch';
const IDLE_ACTS: readonly IdleAct[] = ['stretch', 'look', 'watch'];

/** How long someone has had nothing to do before it shows, and how long each act lasts, in seconds. */
export const IDLE = { after: 4, lasts: 3 } as const;

/**
 * What someone who has had nothing to do for so long is doing to pass the time, if it shows yet, and how far into it
 * they are (0 to 1, easing in and out). Each starts on a different act, so a room of them are not all in step.
 */
export function idleAct(id: number, idleFor: number): { kind: IdleAct; amount: number } | null {
  const s = idleFor - IDLE.after;
  if (!(s >= 0)) return null;
  const n = Math.floor(s / IDLE.lasts);
  const u = s / IDLE.lasts - n;
  return {
    kind: must(IDLE_ACTS[(n + id) % IDLE_ACTS.length], 'an idle act'),
    amount: Math.min(1, Math.sin(Math.PI * u) * 1.8),
  };
}

/** How long someone must have had nothing to do to be in the middle of an act: for the model lab, to show each. */
export function idleMoment(id: number, kind: IdleAct) {
  const n = (IDLE_ACTS.indexOf(kind) - (id % IDLE_ACTS.length) + IDLE_ACTS.length) % IDLE_ACTS.length;
  return IDLE.after + (n + 0.5) * IDLE.lasts;
}

/** An angle brought round to between -pi and pi. */
const wrap = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

/**
 * How far round the legs' cycle goes for each meter walked, in radians: a full cycle of two steps every 1.3 m, about the
 * 9.5 rad/s the walk had at 2.1 m/s.
 */
export const STRIDE = 4.8;

/** How far someone may move in a frame and still have walked there, in meters: further, they were put there. */
const TELEPORT = 2;

/** How far a body leans into a turn for each radian a second it turns, and how fast a turn it leans for at most. */
const TURN_LEAN = { body: 0.02, head: 0.01, most: 8 } as const;

/** How long a sip of a drink or a bite of a snack takes, hand up and down again, in seconds. */
export const SIP = 2.4;

/** How long it takes to stoop for a piece of litter, pick it up and straighten again, in seconds. */
export const PICK = 1.8;

/** The acts that go round in a cycle, and how long each takes. */
const ACT_CYCLES: Partial<Record<Act, number>> = { drink: SIP, eat: SIP, litter: PICK };

/**
 * How far a guest lying face down on a table turns their head aside to rest on a cheek, in radians: away from the
 * practitioner's side of the table, which turns it toward the game's camera, so the face shows.
 */
export const PRONE_TURN = -1.45;

/** How long a healed guest's symptom takes to shrink away in a puff of sparkles, in seconds. */
export const CURE = 0.8;

/** How long the hop for joy as it goes lasts, in seconds. */
const HOP = 0.5;

/**
 * Show a healed guest's symptom going, partway through: every prop shrinking away as it rises, a swollen head going
 * down, the skin coming back at the half, and a ring of sparkles round the head bursting outward and turning. Once it
 * has gone, put it away for good.
 */
function showCure(rig: CharRig, c: Char, t: number) {
  const u = Math.max(0, (t - rig.curedAt) / CURE);
  if (u >= 1) {
    endCure(rig, c.look);
    return;
  }
  rig.props.forEach((o, i) => {
    const rest = rig.rest?.[i];
    if (!rest) return;
    o.scale.copy(rest.scale).multiplyScalar(Math.max(0.001, 1 - u));
    o.position.y = rest.y + 0.25 * u;
  });
  if (rig.visual === 'bighead') {
    const size = 1.45 - 0.45 * u;
    rig.head.scale.set(size / rig.wide, size, size / rig.wide);
  }
  if (u > 0.5) rig.headMesh.material = mat(c.look.skin, 0.65);
  rig.burst ??= buildBurst(rig.head);
  rig.burst.visible = true;
  rig.burst.scale.setScalar(0.3 + 1.5 * u);
  rig.burst.rotation.y = u * 2.5;
}

/** How long a blink lasts, in seconds. */
export const BLINK = 0.13;

/**
 * Whether someone is blinking at a moment: once every 3.2 to 5.4 seconds, each person at their own pace and time, so a
 * crowd never blinks together.
 */
export function blinkAt(id: number, t: number) {
  const period = 3.2 + hash(id) * 2.2;
  const s = t + id * 0.73;
  return ((s % period) + period) % period < BLINK;
}

/** How high a guest lying face down on a table lies, in meters, for the cheek and not the nose to meet it. */
const PRONE_Y = 0.21;

/** How the arms of a guest lying on a table or a mat lie along their sides, turned forward from straight. */
const LYING_ARMS = 0.12;

/** How far a cup or a snack tips back toward the mouth at the height of a sip or a bite, from upright, in radians. */
const SIP_TIP = 0.65;

/** What each act has in the right hand. */
const HELD_FOR: Partial<Record<Act, HeldKind>> = { drink: 'cup', eat: 'snack', water: 'can', repair: 'wrench' };

/** How far into an act's cycle someone is, from 0 to 1, each person at their own point in it. */
const cycleOf = (act: Act, id: number, t: number) => {
  const period = ACT_CYCLES[act] ?? 1;
  return (((t / period + id * 0.37) % 1) + 1) % 1;
};

/** A moment at which someone is at the height of an act: the cup at their lips, or stooped for the litter. */
export function actMoment(act: Act, id: number) {
  const period = ACT_CYCLES[act];
  return period ? period * ((((0.5 - id * 0.37) % 1) + 1) % 1) : 0;
}

/** How far a cycle at this point has someone into the act, from 0 to 1: all the way through its middle, eased at each end. */
const peakOf = (u: number) => THREE.MathUtils.clamp((Math.sin(Math.PI * u) - 0.5) * 3, 0, 1);

/**
 * Count the ground someone has covered since last frame toward their stride, and note where they are. Someone placed
 * somewhere new, arriving at the pavement's end or carried off by a machine, has not walked there.
 */
export function stepOn(rig: CharRig, x: number, y: number) {
  const d = Math.hypot(x - rig.lastX, y - rig.lastY);
  // NaN, before their first frame, is never a step
  if (d <= TELEPORT) rig.walked += d;
  rig.lastX = x;
  rig.lastY = y;
}

/** Walk someone on the spot, for the model lab, where nobody goes anywhere: so far at a pace, in meters a second. */
export function treadmill(rig: CharRig, dt: number, pace: number) {
  rig.walked += pace * dt;
}

/** Where a fed-up guest looks: the front door, in tiles. */
export interface Door {
  x: number;
  y: number;
}

/** How far the head dips at the height of each rattle from the Gong next door, and the share of that lying down. */
const RATTLE_DIP = 0.12;
const RATTLE_LYING = 1 / 3;

/** How far someone's head dips this moment in a room the Gong rattles, in step with the furniture: none between strikes. */
export const rattleDip = (c: Char, t: number) =>
  ((RATTLE_DIP * Math.max(0, rattle(t, c.id))) / RATTLE_PEAK) * (c.pose === 'lie' ? RATTLE_LYING : 1);

/** How near a runner comes for people to turn their heads to look, in tiles, and how far round they turn. */
const RUNNER_LOOK = FREAK_RANGE + 1;
const RUNNER_TURN = 0.6;

/** How far to turn the head toward the nearest runner close by, if any is: none for a runner themselves, or anyone lying or on a table. */
function lookAtRunner(c: Char, runners: Cues['runners']): number | undefined {
  if (!runners?.length || c.pose === 'lie' || c.state === 'served' || c.state === 'running') return undefined;
  let near: { x: number; y: number } | undefined;
  let best = RUNNER_LOOK;
  for (const r of runners) {
    const d = Math.hypot(r.x - c.x, r.y - c.y);
    if (r.id !== c.id && d < best) [near, best] = [r, d];
  }
  if (!near) return undefined;
  return THREE.MathUtils.clamp(wrap(Math.atan2(near.x - c.x, near.y - c.y) - c.facing), -RUNNER_TURN, RUNNER_TURN);
}

/**
 * What the people layer works out about someone from the world once a frame, for posing them: how they are working,
 * where the front door is, what they are doing at the item they are at, how they lie on it, and what is going on
 * around them that they react to.
 */
export interface Cues {
  style: WorkStyle;
  door?: Door;
  act?: Act | undefined;
  lie?: Lying | undefined;
  /** Where everyone running round on a really bad trip is, for anyone near to turn and look. */
  runners?: readonly { id: number; x: number; y: number }[];
  /** Whether the litter a Caretaker is cleaning up is flood water, which they mop. */
  mopping?: boolean;
  /** Whether the room they are in is rattled through the wall by the Gong of Last Resort, which they flinch at. */
  rattled?: boolean;
}

/**
 * Pose a person for this frame: position, limbs, face, symptom effects and speech bubble. A fed-up guest turns toward
 * the door, if there is one, and anyone near a guest on a really bad trip turns to look.
 */
export function poseChar(rig: CharRig, c: Char, t: number, dt: number, cues: Cues) {
  const { style, door } = cues;
  // an act is done standing at the item: on the way there, they walk, and a Caretaker mopping has a pose of their own
  const act = c.pose === 'stand' && !cues.mopping ? cues.act : undefined;
  rig.group.position.set(c.x, c.h, c.y);
  rig.group.rotation.y = c.facing;
  // the stride follows the ground covered, not the clock, so the feet plant where they land whatever the game's speed
  stepOn(rig, c.x, c.y);
  const first = Number.isNaN(rig.lastFacing);
  const turning = dt > 0 && !first ? wrap(c.facing - rig.lastFacing) / dt : 0;
  rig.lastFacing = c.facing;
  const healed = c.kind === 'guest' && c.outcome === 'healed';
  // healed while in sight, the symptom goes in a puff; anyone seen first already healed, as from a save, is simply well
  if (healed) cureRig(rig, first ? t - 2 * CURE : t);
  const curing = healed && !rig.cured ? Math.max(0, t - rig.curedAt) : NaN;
  showExpression(rig.face, expressionOf(c));
  // resting on their back, on a table, a mat or a Recliner, the eyes are shut; anyone else blinks now and then
  const asleep =
    c.kind === 'guest' && c.pose === 'lie' && (c.state === 'resting' || (c.state === 'served' && cues.lie === 'back'));
  showEyes(rig.face, asleep || blinkAt(c.id, t));
  const visual = healed ? undefined : rig.visual;
  const phase = rig.walked * STRIDE + c.id * 1.7;
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
  /** Whether they sit on the floor rather than a seat. */
  const onFloor = c.pose === 'sit' && c.h < SIT.floor;
  if (c.pose === 'walk') {
    const sw = Math.sin(phase) * (visual === 'stiff' ? 0.14 : 0.62);
    legL = sw;
    legR = -sw;
    armL = -sw * 0.85;
    armR = sw * 0.85;
    bodyY = Math.abs(Math.cos(phase)) * 0.04;
    if (healed && rig.cured) bodyY += Math.abs(Math.sin(phase * 0.5)) * 0.07;
    // leaning into a corner, the head leading
    const turn = THREE.MathUtils.clamp(turning, -TURN_LEAN.most, TURN_LEAN.most);
    side -= turn * TURN_LEAN.body;
    headZ -= turn * TURN_LEAN.head;
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
    if (onFloor) {
      // cross-legged on the floor: thighs out to the sides, shins folded in front
      legL = SIT.crossed.left.x;
      legR = SIT.crossed.right.x;
    }
  } else if (c.pose === 'lie') {
    bodyRX = Math.PI / 2;
    // on a table face down, the cheek rests on it rather than the nose
    bodyY = cues.lie === 'prone' ? PRONE_Y : 0.16;
    bodyZ = -0.6 * rig.scale;
    // the arms down along the sides on a table or a mat, or out to the sides on a machine
    armOut = cues.lie ? 0.14 : 0.5;
    if (cues.lie) armL = armR = LYING_ARMS;
  } else if (act) {
    const a = actPose(act, c, t);
    ({ armL, armR, armOut, lean, headX, side, bodyY } = a);
    if (a.legs !== undefined) legL = legR = a.legs;
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
  } else if (c.busy && style === 'kneading') {
    // jabbing at the console's buttons, then a hopeful thump on the side of it
    headX = 0.3;
    armL = -0.9;
    armR = -1.0 + Math.max(0, Math.sin(t * 6 + c.id)) * 0.35;
  } else if (c.busy && style === 'impression') {
    // tapping the pin home with the little hammer, peering at it between taps
    lean = 0.12;
    headX = 0.1;
    armL = -1.3;
    armR = -1.7 + Math.abs(Math.sin(t * 7 + c.id)) * 0.7;
  } else if (c.busy && style === 'aurawash') {
    // one hand on the lever, the other waving the guest through
    armL = -1.1;
    armR = -1.6 + Math.sin(t * 2.5 + c.id) * 0.5;
    headZ = 0.2;
  } else if (c.busy && style === 'alphorn') {
    // both hands up at the mouthpiece, leaning into one enormous breath
    const breath = (Math.sin(t * 0.9 + c.id) + 1) / 2;
    armL = armR = -2.1;
    armOut = 0.15;
    lean = -0.2 + breath * 0.3;
    headX = -0.25 + breath * 0.25;
  } else if (c.busy && style === 'pressing') {
    // hauling the bar of the screw round, chanting
    const turn = Math.sin(t * 1.6 + c.id);
    lean = 0.2 + turn * 0.1;
    armL = -2.3 + turn * 0.3;
    armR = -2.3 - turn * 0.3;
    headX = -0.2;
  } else if (c.busy && style === 'rebirth') {
    // leaning on the lever, then a cheerful wave as they come round
    lean = 0.15;
    armL = -0.8;
    armR = -2.6 + Math.max(0, Math.sin(t * 2 + c.id)) * 0.6;
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
  const mopping = !!cues.mopping && c.kind === 'staff' && c.state === 'doingJob' && c.job?.kind === 'litter';
  if (mopping) {
    // both hands on the mop, pushing it to and fro across the floor
    const sweep = Math.sin(t * 2.6 + c.id);
    lean = 0.18;
    armR = -0.85 + sweep * 0.08;
    armL = -0.95 - sweep * 0.08;
    armOut = -0.75;
    headX = 0.15;
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
  // on a really bad trip: arms flung up and waving, head whipping round at whatever they think they see
  if (c.kind === 'guest' && c.state === 'running') {
    armL = -2.7 + Math.sin(t * 11 + c.id) * 0.5;
    armR = -2.7 + Math.sin(t * 11 + c.id + Math.PI) * 0.5;
    armOut = 0.45;
    headZ += Math.sin(t * 7 + c.id) * 0.35;
    headX -= 0.2;
  }
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
  else if (visual === 'chairshape' && c.pose !== 'sit' && c.pose !== 'lie') {
    // bent at the hips and knees, as if the chair were still there
    lean += 0.3;
    legL = legR = Math.min(legL, legR) - 0.7;
    bodyY -= 0.12;
  } else if (visual === 'bags' && c.pose !== 'lie') {
    // leaning back against the weight of the shopping
    lean -= 0.12;
    armL = armR = 0.05;
  } else if (visual === 'bluescreen' && c.pose !== 'lie') {
    // frozen mid-sentence, one hand still raised to make a point
    armR = -1.3;
    headZ = 0.1;
  } else if (visual === 'oldsoul' && c.pose !== 'lie') {
    // stooped, as their grandfather was
    lean += 0.25;
    headX -= 0.15;
  }
  // a hop for joy as the symptom goes
  if (curing < HOP && c.pose !== 'lie') bodyY += Math.sin((Math.PI * curing) / HOP) * 0.1;
  if (c.pose === 'lie') {
    lean = 0;
    headX = 0;
    headZ = 0;
    side = 0;
    if (visual === 'flex') armOut = 0.5;
  }
  // a strike of the Gong next door, felt through the wall
  if (cues.rattled) headX += rattleDip(c, t);
  // people move with life: weight shifting, follow-through, breathing and fidgets, unless too stiff to
  // only someone with their hands free (the inspector carries a clipboard) and no symptom to show fidgets with their
  // arms
  const handsFree = !visual && !(c.kind === 'visitor' && c.visit === 'inspector');
  // a member of staff left with nothing to do passes the time, once it has gone on a while
  if (!hasNothingToDo(c)) rig.idleSince = NaN;
  else if (Number.isNaN(rig.idleSince)) rig.idleSince = t;
  const doing: Doing = {
    style,
    smudging,
    handsFree,
    // arms held stiff, flexed or frozen by a symptom show it, whatever else
    armsFree: visual !== 'stiff' && visual !== 'flex' && visual !== 'frost' && visual !== 'bluescreen',
    rightHolds: visual === 'mallet' || visual === 'leash',
    act,
    idle: idleAct(c.id, t - rig.idleSince),
    mood: moodOf(c),
    toDoor: door ? wrap(Math.atan2(door.x - c.x, door.y - c.y) - c.facing) : 0,
    armL,
    armR,
    armOut,
  };
  // too stiff, or frozen like a crashed computer, to move with life, they can still show their patience running out
  const frozen = visual === 'stiff' || visual === 'bluescreen';
  const life = !frozen ? liveliness(c, t, phase, doing) : showMood({ ...NO_LIFE }, c, t, doing);
  lean += life.lean;
  side += life.side;
  headX += life.headX;
  headZ += life.headZ;
  bodyY += life.bodyY;
  // the mop swept from side to side, the body turning with it
  if (mopping) life.bodyYaw = Math.sin(t * 2.6 + c.id) * 0.3;
  const look = lookAtRunner(c, cues.runners);
  if (look !== undefined) life.headYaw = look;
  armL += life.armL;
  armR += life.armR;
  armOut += life.armOut;
  if (c.pose === 'lie' && cues.lie) {
    life.elbowL += bendTo(armL, -0.08, 1);
    life.elbowR += bendTo(armR, -0.08, 1);
    // face down, the face turned aside, away from whoever works on the back; on their back, the body turned over
    if (cues.lie === 'prone') life.headYaw = PRONE_TURN;
    else life.bodyYaw = Math.PI;
  }
  if (act) actJoints(life, act, c, t, armL, armR);
  // what is held is kept at a tilt of its own, whatever the forearm holding it is doing
  const held = act && !doing.rightHolds ? HELD_FOR[act] : undefined;
  if (held || rig.held) holdFor(rig, held, heldTilt(act, c, t) - (armR + elbowFor(armR) + life.elbowR));
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
  rig.legL.rotation.y += ((onFloor ? SIT.crossed.left.y : 0) - rig.legL.rotation.y) * k;
  rig.legR.rotation.y += ((onFloor ? SIT.crossed.right.y : 0) - rig.legR.rotation.y) * k;
  rig.armL.rotation.x += (armL - rig.armL.rotation.x) * k;
  rig.armR.rotation.x += (armR - rig.armR.rotation.x) * k;
  rig.armL.rotation.z += (-armOut + life.armInL - rig.armL.rotation.z) * k;
  rig.armR.rotation.z += (armOut - rig.armR.rotation.z) * k;
  poseJoints(rig.joints, rig, c, t, k, { legL, legR, armL, armR, phase, visual, style, onFloor }, life);
  if (rig.band?.visible) rig.band.scale.setScalar(1 + Math.sin(t * 6 + c.id) * 0.05);
  if (visual === 'jitter' && c.pose !== 'lie') {
    // pins and needles: a constant fizzing shiver
    rig.body.position.x = Math.sin(t * 47 + c.id) * 0.012;
    rig.legL.rotation.z = Math.sin(t * 39 + c.id) * 0.07;
    rig.legR.rotation.z = Math.sin(t * 43 + c.id) * 0.07;
  } else {
    if (rig.visual === 'jitter') rig.body.position.x = 0;
    rig.legL.rotation.z += ((onFloor ? SIT.crossed.left.z : 0) - rig.legL.rotation.z) * k;
    rig.legR.rotation.z += ((onFloor ? SIT.crossed.right.z : 0) - rig.legR.rotation.z) * k;
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

  if (rig.mop) rig.mop.visible = mopping;
  if (healed && !rig.cured) showCure(rig, c, t);

  if (rig.sage && rig.sageTip && rig.smoke) {
    rig.sage.visible = smudging;
    if (smudging) rig.group.updateMatrixWorld(true);
    driftSmoke(rig.smoke, rig.sageTip, t, smudging);
  }

  poseBubble(rig, c, t, doing.mood);
}

/**
 * What someone has to say, in what color, before any bubble is held up for reading: first trouble a player should act
 * on now, in red (about to quit, fed up, getting worse while waiting), then whatever the game has them say, then needs
 * in amber (the toilet, a drink, worn out), then what staff are busy with, and last, now and then, an amber hourglass
 * from a guest running out of patience.
 */
export function bubbleWanted(c: Char, t: number, mood: Mood): Said | null {
  if (c.kind === 'staff' && aboutToQuit(c)) return saying('bubble-quitting');
  const waiting = c.kind === 'guest' && (c.state === 'waiting' || c.state === 'toWait');
  if (c.kind === 'guest') {
    if (mood === 'fedUp') return saying('bubble-impatient');
    if (waiting && !c.outcome && c.health < POOR_CONDITION) return saying('bubble-hurt');
  }
  if (c.bubbleT > 0 && c.bubble) return saying(c.bubble);
  if (c.kind === 'guest') {
    if (waiting && c.bladder >= 95) return saying('bubble-restroom');
    if (waiting && c.thirst >= 95) return saying('bubble-thirsty');
    if (mood === 'impatient' && nudging(t, c.id)) return { id: 'bubble-impatient', tone: 'need' };
    return null;
  }
  if (c.kind !== 'staff') return null;
  if (c.state === 'onBreak') return saying('bubble-break');
  if (c.state === 'training') return saying('bubble-training');
  if (c.energy < 15) return saying('bubble-exhausted');
  return null;
}

/**
 * Show someone's bubble over their head: popping in, held long enough to read, shrinking away, an alarm pulsing, from
 * the tip of its tail so it seems to come out of the head. A bubble nobody has said is left alone, as it is in the lab,
 * and one already up the first time someone is posed shows at once.
 */
function poseBubble(rig: CharRig, c: Char, t: number, mood: Mood) {
  const sprite = rig.bubble;
  const kept = sprite.userData.shown as BubbleShown | undefined;
  const before = kept ?? quiet();
  // someone posed for the first time, as in a picture of them, has their bubble up already
  const shown = follow(before, bubbleWanted(c, t, mood), kept ? t : t - POP_IN);
  sprite.userData.shown = shown;
  if (!shown.said) {
    if (before.said) sprite.visible = false;
    rig.bubbleKey = '';
    return;
  }
  const key = `${shown.said.id}|${shown.said.tone}`;
  if (key !== rig.bubbleKey) {
    rig.bubbleKey = key;
    sprite.material.map = iconTexture(shown.said.id, shown.said.tone);
    sprite.material.needsUpdate = true;
    sprite.center.set(0.5, BUBBLE_TAIL);
  }
  const size = bubbleScale(shown, t);
  sprite.visible = size > 0;
  sprite.scale.setScalar(BUBBLE_SIZE * size);
  sprite.position.y = (c.pose === 'lie' ? 0.72 : 1.44) + Math.sin(t * 3 + c.id) * 0.04;
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
  /** Sitting cross-legged on the floor. */
  onFloor: boolean;
}

/** How far an elbow bends for an arm raised this far: hanging, a little; reaching forward, more; straight overhead. */
export const elbowFor = (arm: number) => (arm < -2 ? -0.12 : -(0.2 + Math.min(1, Math.max(0, -arm - 0.3)) * 0.6));

/**
 * Pose the knees, elbows and waist of someone built with them, following their legs and arms: a knee bends as its leg
 * swings through a step and the shoulders turn against the hips, shins hang down from a seat, and elbows bend as the
 * arms reach forward.
 */
function poseJoints(j: Joints, rig: CharRig, c: Char, t: number, k: number, limbs: Limbs, life: Life) {
  const { legL, legR, armL, armR, phase, visual, style, onFloor } = limbs;
  let kneeL = 0.04;
  let kneeR = 0.04;
  let twist = 0;
  if (c.pose === 'walk') {
    kneeL = 0.08 + Math.max(0, -Math.cos(phase)) * 0.95;
    kneeR = 0.08 + Math.max(0, Math.cos(phase)) * 0.95;
    twist = Math.sin(phase) * 0.14;
  } else if (onFloor) {
    kneeL = SIT.crossed.kneeL;
    kneeR = SIT.crossed.kneeR;
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
  j.foreL.rotation.y += (life.bendL - j.foreL.rotation.y) * k;
  j.foreR.rotation.y += (-life.bendR - j.foreR.rotation.y) * k;
}

/** What someone is doing, and how their arms are posed before any life is added: what their life moves with. */
interface Doing {
  style: WorkStyle;
  smudging: boolean;
  /** Their hands are free to fidget with, holding nothing and showing no symptom. */
  handsFree: boolean;
  /** Their arms are free to fold or set on the hips, not held stiff, flexed or frozen by a symptom. */
  armsFree: boolean;
  /** Their right hand holds what shows their symptom, so only the left arm is free. */
  rightHolds: boolean;
  /** What they are doing at the item they are at, which poses them alone. */
  act: Act | undefined;
  /** What they are doing to pass the time, with nothing to do. */
  idle: ReturnType<typeof idleAct>;
  mood: Mood;
  /** How far round the front door is from the way they face, in radians, the left being positive. */
  toDoor: number;
  /** The arms' turns as posed, forward and outward, which passing the time or a mood takes over. */
  armL: number;
  armR: number;
  armOut: number;
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
  /** Which way each elbow bends, turned inward from straight ahead: to cross the arms, or set the hands on the hips. */
  bendL: number;
  bendR: number;
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
  bendL: 0,
  bendR: 0,
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
/** What a restless guest fidgets with, and how much more often: an eye on the time, above all. */
const RESTLESS_FIDGETS: readonly Fidget[] = ['watch', 'look', 'watch', 'tap'];
const RESTLESS_EVERY = 3;

/** The fidgets that take over the arms. */
const ARM_FIDGETS: ReadonlySet<Fidget> = new Set(['watch', 'stretch']);

/** How often someone may fidget, and how long a fidget lasts, in seconds. */
const FIDGET = { every: 5.5, lasts: 1.9 };

/** What someone is fidgeting with now, if anything, how far into it they are (0 to 1, easing in and out), and which
 * way they turn, from a steady roll for each person and stretch of time, fidgeting as often as `every` seconds. */
function fidgetAt(id: number, t: number, kinds: readonly (Fidget | null)[], every: number = FIDGET.every) {
  const s = t + id * 1.37;
  const n = Math.floor(s / every);
  const u = (s - n * every) / FIDGET.lasts;
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
 * knees giving, head following the hands. Someone holding something or showing a symptom only looks round instead of
 * fidgeting with their hands. Someone with nothing to do passes the time, strolling about with their arms barely
 * swinging, and a guest waiting shows how patient they are.
 */
function liveliness(c: Char, t: number, phase: number, doing: Doing): Life {
  const { style, smudging, armL, armR, handsFree } = doing;
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
    if (doing.idle) {
      // strolling, with nowhere to be: the arms barely swing, and they look about them
      life.armL = -armL * 0.75;
      life.armR = -armR * 0.75;
      life.headYaw += Math.sin(t * 0.8 + c.id) * 0.45;
    }
    return life;
  }
  // breathing, whatever else they are doing
  life.lean = breath * 0.012;
  life.bodyY = breath * 0.004;
  life.headX = -breath * 0.012;
  // an act poses the whole body, and only breathes
  if (doing.act) return life;
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
  if (c.pose === 'stand') {
    const w = Math.sin(t * 0.42 + c.id * 2.1);
    life.swayX = w * 0.02;
    life.side += w * 0.04;
    life.kneeL = Math.max(0, w) * 0.16;
    life.kneeR = Math.max(0, -w) * 0.16;
    life.bodyY -= Math.abs(w) * 0.008;
  }
  if (doing.idle) return passTime(life, c, t, doing.idle, doing);
  if (doing.mood !== 'content') showMood(life, c, t, doing);
  // a restless guest fidgets all the more; an impatient or fed-up one has gone past fidgeting
  if (doing.mood !== 'content' && doing.mood !== 'restless') return life;
  const fidget =
    doing.mood === 'restless'
      ? fidgetAt(c.id, t, RESTLESS_FIDGETS, RESTLESS_EVERY)
      : fidgetAt(c.id, t, c.pose === 'sit' ? SEATED_FIDGETS : STANDING_FIDGETS);
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
  } else if (c.h >= SIT.floor) {
    life.kneeL += 0.3 * Math.sin(t * 3.2) * a;
    life.kneeR += 0.3 * Math.sin(t * 3.2 + Math.PI) * a;
  }
  return life;
}

/** How someone doing an act holds their body and arms: turns in radians, shifts in meters. */
interface ActPose {
  armL: number;
  armR: number;
  armOut: number;
  lean: number;
  headX: number;
  side: number;
  bodyY: number;
  /** Both thighs swung forward, for a crouch. */
  legs?: number;
}

/** The body and arms of someone doing an act, at a moment. */
function actPose(act: Act, c: Char, t: number): ActPose {
  const p: ActPose = { armL: 0, armR: 0, armOut: 0.06, lean: 0, headX: 0, side: 0, bodyY: 0 };
  const u = peakOf(cycleOf(act, c.id, t));
  if (act === 'checkin') {
    // forearms level on the keyboard, head up to the guest with a nod now and then
    p.armL = p.armR = -0.4;
    p.headX = 0.05 + Math.max(0, Math.sin(t * 1.4 + c.id)) * 0.14;
  } else if (act === 'drink' || act === 'eat') {
    // the right hand up to the mouth and down again, the left hanging
    p.armR = -0.7 + (-1.85 + 0.7) * u;
    p.armL = 0.04;
    p.headX = -0.12 * u + (act === 'eat' ? Math.sin(t * 9) * 0.02 * u : 0);
  } else if (act === 'play') {
    // both hands forward on the controls, swaying with the game
    p.armL = p.armR = -1.15;
    p.lean = 0.15;
    p.headX = 0.2;
    p.side = Math.sin(t * 2.6 + c.id) * 0.06;
  } else if (act === 'shop') {
    // one hand on the counter, the other pointing at something on the shelf
    p.armR = -0.95;
    p.armL = -2.0;
  } else if (act === 'litter') {
    // a stoop to the floor, knees giving and the right hand reaching straight down for the litter, the left out
    // behind for balance; then straight again, the right arm forward for the toss into the sack
    p.lean = 1.15 * u;
    p.legs = -0.55 * u;
    p.bodyY = -0.05 * u;
    p.armR = -0.6 - 0.55 * u;
    p.armL = -0.6 * u;
  } else if (act === 'water') {
    // the can held out over the plant
    p.armR = -0.9;
    p.lean = 0.15;
    p.headX = 0.15;
  } else {
    // crouched on the heels, working at something low down, the other hand steadying on the knee
    p.legs = -1.2;
    p.bodyY = -0.18;
    p.lean = 0.45;
    p.headX = 0.25;
    p.armR = -0.75;
    p.armL = -0.3;
  }
  return p;
}

/** The elbows, wrists, knees and head of someone doing an act, on top of the arms as posed. */
function actJoints(life: Life, act: Act, c: Char, t: number, armL: number, armR: number) {
  const u = peakOf(cycleOf(act, c.id, t));
  if (act === 'checkin') {
    // the fingers going
    life.elbowL += bendTo(armL, -1.15 + Math.sin(t * 11 + c.id) * 0.05, 1);
    life.elbowR += bendTo(armR, -1.15 + Math.sin(t * 11 + c.id + 1.6) * 0.05, 1);
    life.bendL = life.bendR = 0.3;
  } else if (act === 'drink' || act === 'eat') {
    // the forearm folding up and in, so the hand comes to the middle of the face
    life.elbowR += bendTo(armR, -0.6 + (-1.05 + 0.6) * u, 1);
    life.bendR = 0.85 * u;
  } else if (act === 'play') {
    // quick alternate jabs at the buttons
    life.elbowL += bendTo(armL, -1.4 + Math.max(0, Math.sin(t * 10 + c.id)) * 0.18, 1);
    life.elbowR += bendTo(armR, -1.4 + Math.max(0, Math.sin(t * 10 + c.id + Math.PI)) * 0.18, 1);
  } else if (act === 'shop') {
    life.elbowR += bendTo(armR, -1.2, 1);
    life.elbowL += bendTo(armL, -0.2, 1);
    life.armInL = -0.45;
    // a look at the shelf, and back
    life.headYaw = 0.5 * Math.max(0, Math.sin(t * 0.8 + c.id));
  } else if (act === 'litter') {
    life.kneeL = life.kneeR = 0.9 * u;
    life.elbowR += bendTo(armR, -0.1, u);
    life.elbowL += bendTo(armL, -0.1, u);
  } else if (act === 'repair') {
    life.kneeL = life.kneeR = 1.85;
    life.elbowR += bendTo(armR, -0.6, 1);
    life.elbowL += bendTo(armL, -0.9, 1);
    // a twist of the wrench every half second
    life.bendR = 0.2 + Math.sin(t * 4 + c.id) * 0.35;
  }
}

/**
 * How far forward from upright what someone holds for an act is tipped: a cup or a snack tipping back toward the mouth
 * as it comes up, and a watering can tipping forward and back as it pours.
 */
function heldTilt(act: Act | undefined, c: Char, t: number) {
  if (act === 'drink' || act === 'eat') return -SIP_TIP * peakOf(cycleOf(act, c.id, t));
  if (act === 'water') return 0.3 + Math.sin(t * 1.2) * 0.25;
  return 0;
}

/**
 * Show what someone holds in their right hand for what they are doing, making it the first time, and nothing else.
 * Anything but a wrench, which is held as a fist holds it, is turned in the hand by `turn` to keep its tilt.
 */
function holdFor(rig: CharRig, kind: HeldKind | undefined, turn: number) {
  if (kind && !rig.held?.[kind]) (rig.held ??= {})[kind] = buildHeld(rig.joints.foreR, kind);
  if (!rig.held) return;
  for (const [k, o] of Object.entries(rig.held)) o.visible = k === kind;
  const o = kind && kind !== 'wrench' ? rig.held[kind] : undefined;
  if (o) o.rotation.x = turn;
}

/** What to add to a turn as posed to take it to another, by an amount from 0 to 1. */
const toward = (posed: number, to: number, a: number) => (to - posed) * a;

/** What to add to an elbow's bend, which follows its arm, to bend it so far once the arm is turned to `arm`, by an amount. */
const bendTo = (arm: number, to: number, a: number) => (to - elbowFor(arm)) * a;

/**
 * Pass the time, with nothing to do, in ways big enough to see from across the building: a long stretch with both arms
 * overhead, a slow look round with the hands behind the back, or a long look at a watch.
 */
function passTime(life: Life, c: Char, t: number, act: { kind: IdleAct; amount: number }, doing: Doing) {
  const { armL, armR, armOut } = doing;
  const a = act.amount;
  if (act.kind === 'stretch') {
    life.armL += toward(armL, -2.95, a);
    life.armR += toward(armR, -2.95, a);
    life.armOut += toward(armOut, 0.32, a);
    life.elbowL += bendTo(-2.95, -0.04, a);
    life.elbowR += bendTo(-2.95, -0.04, a);
    life.lean -= 0.16 * a;
    life.bodyY += 0.025 * a;
    life.headX -= 0.3 * a;
  } else if (act.kind === 'look') {
    // hands clasped behind the back, rocking on the heels and looking slowly round the room
    const sweep = Math.sin(t * 1.1 + c.id) * a;
    life.armL += toward(armL, 0.56, a);
    life.armR += toward(armR, 0.56, a);
    life.armOut += toward(armOut, -0.16, a);
    life.elbowL += bendTo(0.56, -0.6, a);
    life.elbowR += bendTo(0.56, -0.6, a);
    life.bendL = life.bendR = 2.1 * a;
    life.headYaw = sweep * 0.6;
    if (c.pose === 'stand') {
      life.bodyYaw = sweep * 0.35;
      life.lean += Math.sin(t * 3 + c.id) * 0.05 * a;
      life.kneeL = life.kneeR = 0;
    }
  } else {
    // the forearm brought up level in front of the body, the wrist turned in to read it, and a long look down at it
    life.armL += toward(armL, -0.5, a);
    life.elbowL += bendTo(-0.5, -1.45, a);
    life.armInL = 0.3 * a;
    life.headX += 0.36 * a;
    life.headYaw = -0.32 * a;
  }
  return life;
}

/**
 * A way of holding the arms, worked out so the hands land where they should on this body: how far the arms turn
 * forward and out, how far each elbow bends, and how far each bend turns inward from straight ahead.
 */
interface Hold {
  arm: number;
  out: number;
  elbowL: number;
  elbowR: number;
  bendL: number;
  bendR: number;
}

/** The arms folded across the chest, the left forearm over the right. */
const FOLDED: Hold = { arm: -0.72, out: -0.26, elbowL: -1.15, elbowR: -0.9, bendL: 1, bendR: 1.1 };
/** The hands on the hips, the elbows out. */
const ON_HIPS: Hold = { arm: 0.32, out: 0.48, elbowL: -1.25, elbowR: -1.25, bendL: 1.1, bendR: 1.1 };
/** The head in the hands, sitting, leaning on the elbows. */
const HEAD_IN_HANDS: Hold = { arm: -1.08, out: -0.4, elbowL: -1.4, elbowR: -1.4, bendL: 0.4, bendR: 0.4 };

/** Hold the arms a way: both, or the left alone, the right being busy holding something. */
function hold(life: Life, { armL, armR, armOut }: Doing, h: Hold, both: boolean) {
  life.armL += toward(armL, h.arm, 1);
  life.elbowL += bendTo(h.arm, h.elbowL, 1);
  life.bendL = h.bendL;
  if (!both) {
    // the left arm turned out on its own, leaving the right where it is
    life.armInL += armOut - h.out;
    return;
  }
  life.armR += toward(armR, h.arm, 1);
  life.armOut += toward(armOut, h.out, 1);
  life.elbowR += bendTo(h.arm, h.elbowR, 1);
  life.bendR = h.bendR;
}

/**
 * Show a waiting guest's patience running out (see `PATIENCE_SIGNS`): restless, shifting their weight and glancing
 * about; impatient, arms folded and a foot tapping; fed up, hands on hips (head in hands, sitting), turned toward the
 * door. Arms a symptom holds keep to it, and the rest still shows.
 */
function showMood(life: Life, c: Char, t: number, doing: Doing) {
  const { mood, armsFree, rightHolds, toDoor } = doing;
  if (c.pose === 'lie' || c.pose === 'walk' || mood === 'content') return life;
  const sitting = c.pose === 'sit';
  if (mood === 'restless') {
    // a quick glance one way down the room, a moment's look, and a glance the other way, and (in `liveliness`) many a
    // look at the time
    life.headYaw = Math.tanh(Math.sin(t * 1.3 + c.id) * 3) * 0.6;
    life.headX -= 0.04;
    if (sitting) life.kneeL += Math.sin(t * 11 + c.id) * 0.1;
    else {
      // shifting from foot to foot, quicker and further than at ease
      const w = Math.sin(t * 1.2 + c.id * 2.1);
      life.swayX = w * 0.032;
      life.side = w * 0.07;
      life.kneeL = Math.max(0, w) * 0.24;
      life.kneeR = Math.max(0, -w) * 0.24;
    }
    return life;
  }
  if (mood === 'impatient') {
    // someone holding something in their right hand sets the other on their hip, rather than fold one arm
    if (armsFree) hold(life, doing, rightHolds ? ON_HIPS : FOLDED, !rightHolds);
    const tap = Math.max(0, Math.sin(t * 10 + c.id));
    life.headX += 0.06;
    life.headYaw = Math.sin(t * 0.6 + c.id) * 0.25;
    if (sitting) {
      // sitting back, a foot tapping
      life.lean -= 0.08;
      life.kneeR -= 0.22 * tap;
    } else {
      // the weight on one foot, the other tapping
      life.swayX = -0.02;
      life.side = 0.04;
      life.kneeL = 0;
      life.kneeR = 0.12 + 0.2 * tap;
    }
    return life;
  }
  // fed up: turned toward the door as far as they can, shaking their head
  const shake = Math.sin(t * 2.4 + c.id) * 0.14;
  if (sitting && armsFree) {
    life.lean += 0.38;
    life.headX += 0.32;
    hold(life, doing, HEAD_IN_HANDS, !rightHolds);
    life.headYaw = shake;
    return life;
  }
  if (!sitting) {
    if (armsFree) hold(life, doing, ON_HIPS, !rightHolds);
    life.bodyYaw = THREE.MathUtils.clamp(toDoor, -1.1, 1.1);
    // a long sigh now and then
    life.bodyY += Math.max(0, Math.sin(t * 0.9 + c.id)) * 0.012;
  }
  life.headYaw = THREE.MathUtils.clamp(toDoor - life.bodyYaw, -0.8, 0.8) + shake;
  life.headX -= 0.1;
  return life;
}
