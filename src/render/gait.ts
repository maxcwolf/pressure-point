// The walks being tried out for the graphics pass, each a way of turning a person's joints as they walk, chosen from
// the page's address: `?walk=weighted`, `?walk=bouncy` or `?walk=character`. With none, `pose.ts` walks everyone as
// it always has, and nothing here runs.
//
// Each walk is a cycle of two steps worked out from how far round it someone is, put straight onto their joints on
// top of the rest of their pose, which eases as it always has (see `ride`): so a walk keeps its shape at any speed,
// while a pose that changes, a symptom, something carried or a look round, still eases in. The cycle goes round with
// the ground covered, as the game's own does, until the steps would come quicker than `CADENCE` allows, as they would
// at double and triple speed: from there it goes round no faster, and the feet glide a little instead. People ease
// into their first step and settle on their last rather than snapping to a stand. Nothing here touches the game or
// its random numbers: all a person's walk remembers is kept here, by their rig.

import * as THREE from 'three';

import { POOR_CONDITION, TIRED_ENERGY } from '../core/data';
import type { Char } from '../core/state/types';
import { fxChoice } from './fx';
import type { CharRig } from './models/character';
import { HIP, KNEE } from './models/character-detail';

const { clamp, lerp, smoothstep } = THREE.MathUtils;

/** The walks that can be tried, by the name each goes under in the address. */
export const GAITS = ['weighted', 'bouncy', 'character'] as const;
export type Gait = (typeof GAITS)[number];

/** The walk the page's address asks for, if it names one of them. */
const ASKED: Gait | undefined = GAITS.find((g) => g === fxChoice('walk'));

/**
 * How many steps a second people take at most, whatever the game's speed: up to `from` the steps follow the ground
 * covered, so the feet plant at speed 1; past it they come no quicker than `most`, softly, and the feet glide the
 * rest of the way. A guest walking at speed 1 takes about 3.2 steps a second and staff about 3.5; at triple speed it
 * would be nearly 10. `stretch` is how much longer the steps are shown at most once the feet glide, to make up a
 * little of it.
 */
export const CADENCE = { from: 3.6, most: 4.1, stretch: 1.12 } as const;

/** How far round the cycle of two steps goes for each meter walked, in radians, as the game's own walk does. */
const STRIDE = 4.8;

/**
 * How long someone takes to ease into their first step and to settle on their last, in seconds, and how quickly the
 * pace their steps are counted from follows the ground they cover, each second.
 */
const EASE = { start: 0.35, stop: 0.3, pace: 6 } as const;

/** How quickly someone's way of walking changes as they do, from hurrying to dawdling, each second. */
const RESTYLE = 3;

/** How long the thigh is, and the shin from the knee to the ankle, in meters before scaling. */
const THIGH = KNEE;
const SHIN = 0.17;

/** How far below the ankle the sole is, and how far behind and ahead of it the heel and the toe are, in meters. */
const SOLE = HIP - KNEE - SHIN;
const HEEL = 0.08;
const TOE = 0.165;

/** Where the ankle is on the shin, which the foot rolls about, in meters from the knee. */
const ANKLE = new THREE.Vector3(0, -SHIN, 0.005);

/** How far the toe is up as the heel strikes the floor, and down as it pushes off, in radians from flat. */
const ROLL = { heel: 0.25, toe: 0.4, swing: 0.08 } as const;

/** How far through a leg's swing its knee is bent most, as a share of the swing. */
const KNEE_TOP = 0.35;

/**
 * How the body rides on the legs: how much of the rise as a foot pushes off on its toe it keeps, and how quickly it
 * follows the legs up and down, in seconds, so the hand-over from one foot to the other never jolts it.
 */
const RIDE = { rise: 0.35, lag: 0.035 } as const;

/** How far the knee is bent in a straight leg, in radians: never quite locked. */
export const KNEE_REST = 0.06;

/**
 * A way of walking, in numbers. The legs: how many steps a meter (`stride`, times the game's), how much quicker they
 * may come at most (`cap`), the share of the cycle a foot is on the floor (`duty`), how far forward a leg reaches and
 * how far back it goes as a share of that, in radians, how far it overshoots and settles at each end of a swing
 * (`tangent`), how far the knee gives as the heel strikes (`load`), bends as the foot leaves the floor (`pre`) and
 * lifts as it swings through (`lift`), and how far the foot rolls heel to toe (`roll`, a share). The arms: how far
 * they swing forward from the shoulder and back as a share of that, how much they trail the legs and the elbows the
 * arms (`armLag`, `elbowLag`, shares of a cycle), how far the elbows are bent and bend more as an arm comes forward,
 * and how far the arms flap out with each step. The body: how far the hips sway over the standing foot, in meters, and
 * the shoulders roll with it (`hipDrop`), how far the hips and the shoulders turn against each other, how far the
 * body nods into each step, how much of their turning the head takes out (`steady`), how much of the dip as the legs
 * spread the body follows (`bob`), how high it springs up from each step, and the squash and stretch of the body with
 * each, a share of its height. The head: how far it nods a beat behind the bounce (`headLag`) and jolts down as a foot
 * stamps (`stomp`). The healed: how high they skip. And the posture the walk is held in, which eases rather than goes
 * round: how far they lean forward, hold the head down, hold the arms out and bend the elbows, and how far they hold an
 * arm across the belly, or both behind the back, from 0 to 1.
 */
interface Style {
  stride: number;
  cap: number;
  duty: number;
  reach: number;
  back: number;
  tangent: number;
  load: number;
  pre: number;
  lift: number;
  roll: number;
  arm: number;
  armBack: number;
  armLag: number;
  elbow: number;
  elbowSwing: number;
  elbowLag: number;
  flap: number;
  sway: number;
  hipDrop: number;
  hipYaw: number;
  twist: number;
  nod: number;
  steady: number;
  bob: number;
  bounce: number;
  squash: number;
  headLag: number;
  stomp: number;
  skip: number;
  lean: number;
  headDown: number;
  armOut: number;
  belly: number;
  behind: number;
}

/**
 * A real walk, kept gentle: the leg goes back slowly with the foot on the floor and forward quickly through the air,
 * the knee giving as the heel strikes and lifting through the pass, the foot rolling heel to toe; the hips sway over
 * the standing foot and turn against the shoulders; the arms swing from the shoulder, more forward than back, with
 * the elbow trailing; and the head is held steadier than the body.
 */
const WEIGHTED: Readonly<Style> = {
  stride: 1,
  cap: 1,
  duty: 0.58,
  reach: 0.5,
  back: 0.85,
  tangent: 0.5,
  load: 0.2,
  pre: 0.3,
  lift: 0.95,
  roll: 1,
  arm: 0.42,
  armBack: 0.6,
  armLag: 0.04,
  elbow: 0.1,
  elbowSwing: 0.35,
  elbowLag: 0.08,
  flap: 0,
  sway: 0.022,
  hipDrop: 0.03,
  hipYaw: 0.07,
  twist: 0.12,
  nod: 0.02,
  steady: 0.8,
  bob: 1,
  bounce: 0,
  squash: 0,
  headLag: 0,
  stomp: 0,
  skip: 0.07,
  lean: 0.06,
  headDown: -0.02,
  armOut: 0.08,
  belly: 0,
  behind: 0,
};

/**
 * A clay cartoon's walk: a spring up off each step, the body squashing a little as the foot lands and stretching as it
 * pushes off, the head nodding a beat behind, and the arms loose, swinging wide and flapping out.
 */
const BOUNCY: Readonly<Style> = {
  ...WEIGHTED,
  duty: 0.52,
  reach: 0.52,
  back: 0.8,
  tangent: 0.7,
  load: 0.28,
  pre: 0.35,
  lift: 1.1,
  roll: 0.6,
  arm: 0.6,
  armBack: 0.8,
  armLag: 0.08,
  elbow: 0.1,
  elbowSwing: 0.5,
  elbowLag: 0.15,
  flap: 0.1,
  sway: 0.018,
  hipDrop: 0.05,
  hipYaw: 0.05,
  twist: 0.1,
  nod: 0.03,
  steady: 0.4,
  bob: 0.7,
  bounce: 0.035,
  squash: 0.06,
  headLag: 0.09,
  lean: 0.03,
  headDown: -0.04,
  armOut: 0.12,
};

/** Every number a walk is made of, to go through them all. */
const STYLE_KEYS = Object.keys(WEIGHTED) as readonly (keyof Style)[];

/** The walks to choose from, by name. */
const STYLES: Readonly<Record<Gait, Readonly<Style>>> = { weighted: WEIGHTED, bouncy: BOUNCY, character: WEIGHTED };

/**
 * How each way people can be walking changes a walk, in `character`: what each sets outright, and what it multiplies
 * (`times`) or adds to (`plus`). Staff hurrying to a job lean into it with their elbows bent, pumping their arms;
 * worn-out staff slouch and drag their feet with their arms hanging; a fed-up guest stamps, knees high, arms stiff and
 * head down; an unwell guest shuffles small steps, hunched, an arm across the belly; the healed skip, head up and arms
 * swinging high; staff with nothing to do stroll with their hands behind their back; an impatient guest walks
 * briskly; and anyone running, as on a really bad trip, runs.
 */
type Change = Partial<Style> & { times?: Partial<Style>; plus?: Partial<Style> };
const MOODS = {
  hurry: {
    duty: 0.55,
    arm: 0.8,
    armBack: 1,
    elbowSwing: 0.12,
    elbowLag: 0.04,
    nod: 0.03,
    headDown: -0.12,
    times: { stride: 1.15, cap: 1.35, reach: 1.08, lift: 1.2 },
    plus: { lean: 0.2, elbow: 1.3 },
  },
  tired: {
    lift: 0.3,
    load: 0.1,
    pre: 0.15,
    roll: 0.25,
    arm: 0.12,
    armBack: 1,
    elbow: 0,
    elbowSwing: 0.04,
    elbowLag: 0.25,
    armOut: 0,
    headDown: 0.5,
    bob: 0.6,
    times: { stride: 0.72, reach: 0.75, sway: 2.2, hipDrop: 2.6, twist: 0.4, hipYaw: 0.5 },
    plus: { lean: 0.3 },
  },
  stomp: {
    duty: 0.55,
    lift: 1.6,
    load: 0.5,
    arm: 0.55,
    armBack: 0.9,
    armLag: 0,
    elbow: 0,
    elbowSwing: 0.04,
    elbowLag: 0,
    armOut: 0.02,
    stomp: 0.22,
    nod: 0.04,
    headDown: 0.26,
    times: { stride: 1.05, reach: 1.05, hipDrop: 1.6 },
    plus: { lean: 0.08 },
  },
  shuffle: {
    duty: 0.72,
    reach: 0.2,
    back: 1,
    lift: 0.22,
    load: 0.05,
    pre: 0.1,
    roll: 0.15,
    arm: 0.12,
    elbowSwing: 0.1,
    belly: 1,
    headDown: 0.2,
    bob: 0.5,
    times: { sway: 2.2, hipDrop: 2.4, twist: 0.3, hipYaw: 0.4 },
    plus: { lean: 0.22 },
  },
  skip: {
    lift: 1.25,
    arm: 0.75,
    armBack: 0.9,
    elbow: 0.25,
    elbowSwing: 0.4,
    skip: 0.1,
    headDown: -0.14,
    nod: 0.02,
    plus: { lean: -0.08 },
  },
  stroll: {
    arm: 0.04,
    behind: 1,
    headDown: -0.05,
    times: { stride: 0.85, reach: 0.85, lift: 0.8, sway: 1.2 },
    plus: { lean: -0.06 },
  },
  brisk: {
    times: { stride: 1.06, arm: 1.3 },
    plus: { lean: 0.06, elbow: 0.35 },
  },
  run: {
    duty: 0.42,
    reach: 0.68,
    lift: 1.5,
    load: 0.3,
    bob: 0.9,
    bounce: 0.03,
    times: { stride: 0.85, cap: 1.7 },
    plus: { lean: 0.12 },
  },
} as const satisfies Record<string, Change>;
type Mood = keyof typeof MOODS;

/**
 * How the symptoms that change how someone walks change any of these walks: too stiff to bend, a shuffle with the
 * legs straight; potted from the waist down, the pot's own waddle (`pose.ts`) and no step at all; bent as if the chair
 * were still there, short steps in the crouch; and a fizzing shiver, no sway to fight it.
 */
const SYMPTOMS: Partial<Record<string, Change>> = {
  stiff: {
    duty: 0.5,
    reach: 0.14,
    back: 1,
    load: 0,
    pre: 0,
    lift: 0,
    roll: 0,
    twist: 0,
    hipYaw: 0,
    nod: 0,
    bounce: 0,
    squash: 0,
    headLag: 0,
    times: { sway: 0.5 },
  },
  cactus: {
    reach: 0,
    load: 0,
    pre: 0,
    lift: 0,
    roll: 0,
    sway: 0,
    hipDrop: 0,
    bob: 0,
    bounce: 0,
    squash: 0,
    times: { arm: 0.4 },
  },
  chairshape: { bob: 0, bounce: 0, times: { reach: 0.4, lift: 0.5 } },
  jitter: { sway: 0 },
};

/**
 * How people of each role walk on top of who they are, in `character`: the consultant and the receptionist neat,
 * their arms close; the Caretaker heavy-footed, rolling from side to side; the therapist springy.
 */
const ROLE_WALKS: Partial<Record<string, Change>> = {
  consultant: { times: { arm: 0.75, sway: 0.8 }, plus: { lean: -0.02 } },
  receptionist: { times: { arm: 0.85 } },
  caretaker: { times: { sway: 1.35, hipDrop: 1.3, lift: 0.9, stride: 0.95 } },
  therapist: { times: { lift: 1.12 } },
};

/** A walk changed: set, multiplied and added to. */
function changed(s: Style, ch: Change | undefined, by = 1): Style {
  if (!ch || by <= 0) return s;
  const out = { ...s };
  for (const key of STYLE_KEYS) {
    let v = s[key];
    const set = ch[key];
    if (typeof set === 'number') v = set;
    v *= ch.times?.[key] ?? 1;
    v += ch.plus?.[key] ?? 0;
    out[key] = lerp(s[key], v, by);
  }
  return out;
}

/** A steady pseudo-random number from 0 to 1 for a number, the same every time. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** How much someone's own walk differs from the next person's, at most, each way: their pace, swing and posture. */
const PERSONAL = { stride: 0.07, arm: 0.25, lift: 0.15, lean: 0.03, cadence: 0.1 } as const;

/**
 * Someone's own walk, before how they feel: taller people take longer, fewer steps, stockier ones roll more from side
 * to side and slighter ones less, and each swings their arms, lifts their knees and holds themselves a little
 * differently, from their id, so a crowd is never in step. Their steps come up to `PERSONAL.cadence` quicker or
 * slower than the next person's.
 */
function personal(c: Char, scale: number, wide: number): Style {
  /** A steady number from -1 to 1 of their own, a different one for each `n`. */
  const u = (n: number) => 2 * hash(c.id * 7.31 + n) - 1;
  const stride = clamp(
    Math.pow(1 / scale, 0.5) * (1 + PERSONAL.stride * u(1)) * (1 + (1 - wide) * 0.2),
    1 - PERSONAL.cadence,
    1 + PERSONAL.cadence,
  );
  return changed(WEIGHTED, {
    stride,
    times: {
      arm: 1 + PERSONAL.arm * u(2),
      lift: 1 + PERSONAL.lift * u(3),
      sway: wide * wide,
      hipDrop: wide * wide,
    },
    plus: { lean: PERSONAL.lean * u(4) },
  });
}

/**
 * What the walk needs to know about someone that `pose.ts` works out: how their patience shows, whether they are
 * staff with nothing to do, whether their symptom has gone, and the symptom showing, if any.
 */
export interface Walker {
  mood: 'content' | 'restless' | 'impatient' | 'fedUp';
  idle: boolean;
  cured: boolean;
  visual: string | undefined;
}

/**
 * How someone is walking, in `character`, and how much: hurrying to a job, worn out, fed up, unwell, healed, idling
 * or impatient, the most telling first; or none of these.
 */
export function moodOfWalk(c: Char, w: Walker): { mood: Mood; by: number } | undefined {
  if (c.kind === 'guest' && c.state === 'running') return { mood: 'run', by: 1 };
  if (w.cured) return { mood: 'skip', by: 1 };
  if (c.kind === 'staff') {
    // worn out shows from a little before the game slows them, all the way once it does
    const tired = smoothstep(TIRED_ENERGY * 2 - c.energy, 0, TIRED_ENERGY);
    if (tired > 0) return { mood: 'tired', by: tired };
    if (c.state === 'toJob' || c.state === 'toCall' || (c.state === 'toPost' && c.busy))
      return { mood: 'hurry', by: 1 };
    if (w.idle) return { mood: 'stroll', by: 1 };
    return undefined;
  }
  if (c.kind !== 'guest') return undefined;
  const fedUp = w.mood === 'fedUp' || c.outcome === 'stormed' || c.outcome === 'failed' || c.outcome === 'worse';
  if (fedUp) return { mood: 'stomp', by: 1 };
  if (!c.outcome && c.health < POOR_CONDITION) return { mood: 'shuffle', by: 1 };
  if (w.mood === 'impatient') return { mood: 'brisk', by: 1 };
  if (w.mood === 'restless') return { mood: 'brisk', by: 0.5 };
  return undefined;
}

/**
 * The walk someone is to walk this moment, before it eases there from the last: worked out afresh only when how they
 * are walking changes, as it seldom does, and kept with the rest of their walk till then.
 */
function styleFor(gait: Gait, c: Char, rig: CharRig, w: Walker, kept: GaitState): Style {
  const running = c.kind === 'guest' && c.state === 'running';
  const m = gait === 'character' ? moodOfWalk(c, w) : undefined;
  // how tired shows in steps of a twentieth, so it is not worked out again every frame as their energy runs down
  const key = `${gait}|${m?.mood}|${Math.round((m?.by ?? 0) * 20)}|${w.visual}|${running}`;
  if (kept.want && kept.wantKey === key) return kept.want;
  let s: Style = STYLES[gait];
  if (gait === 'character') {
    s = personal(c, rig.scale, rig.wide);
    if (c.kind === 'staff') s = changed(s, ROLE_WALKS[c.role]);
    if (m) s = changed(s, MOODS[m.mood], Math.round(m.by * 20) / 20);
    // a symptom that weighs them down drags the feet; one that sways them, more so
    if (w.visual === 'slump' || w.visual === 'battery' || w.visual === 'oldsoul')
      s = changed(s, { times: { stride: 0.9, lift: 0.6, arm: 0.6 } });
    else if (w.visual === 'sway') s = changed(s, { times: { sway: 2.5, hipDrop: 2 } });
  } else if (running) s = changed(s, MOODS.run);
  kept.want = changed(s, w.visual ? SYMPTOMS[w.visual] : undefined);
  kept.wantKey = key;
  return kept.want;
}

/**
 * The parts of a walk that go round with each step, each the turn or shift of a joint in radians or meters on top of
 * the rest of the pose: the thighs forward and back and out to the side, the knees, the feet at the ankle, the arms
 * at the shoulder and out to the side, the elbows, the body up and down and side to side, the hips turning, the body
 * leaning, rolling and turning at the waist, the head nodding, tipping, turning and bobbing, and the body squashing
 * (less than 0) and stretching (more).
 */
export interface Cycle {
  legL: number;
  legR: number;
  legZL: number;
  legZR: number;
  kneeL: number;
  kneeR: number;
  footL: number;
  footR: number;
  armL: number;
  armR: number;
  armOut: number;
  elbowL: number;
  elbowR: number;
  bodyY: number;
  swayX: number;
  hipYaw: number;
  lean: number;
  roll: number;
  twist: number;
  headX: number;
  headZ: number;
  headYaw: number;
  headY: number;
  squash: number;
}

/** No walk going round: the game's own walk, or someone standing still. */
export const NO_CYCLE: Readonly<Cycle> = {
  legL: 0,
  legR: 0,
  legZL: 0,
  legZR: 0,
  kneeL: 0,
  kneeR: 0,
  footL: 0,
  footR: 0,
  armL: 0,
  armR: 0,
  armOut: 0,
  elbowL: 0,
  elbowR: 0,
  bodyY: 0,
  swayX: 0,
  hipYaw: 0,
  lean: 0,
  roll: 0,
  twist: 0,
  headX: 0,
  headZ: 0,
  headYaw: 0,
  headY: 0,
  squash: 0,
};

/**
 * All a person's walk remembers from one frame to the next: which walk they walk, how far round its cycle they are,
 * in radians, how far they had walked by last frame, how many radians a second their steps would come at from the
 * ground they cover and how many they are shown at, how far into walking they are (0 standing, 1 walking), the walk
 * as it eases from one way of walking to another, what the cycle put on their joints last frame, and their shoes.
 */
interface GaitState {
  gait: Gait | undefined;
  phase: number;
  walked: number;
  pace: number;
  shown: number;
  on: number;
  /** How far the body is down from standing height on the legs as they are, followed smoothly, in meters. */
  dip: number;
  style: Style | undefined;
  /** The walk they are easing toward, and what it was worked out for. */
  want: Style | undefined;
  wantKey: string;
  applied: Cycle;
  shoes: [THREE.Object3D | undefined, THREE.Object3D | undefined] | undefined;
}

/** Each person's walk, kept by their rig. */
const STATES = new WeakMap<CharRig, GaitState>();

/** A person's walk, made the first time it is asked for. */
function stateOf(rig: CharRig): GaitState {
  let s = STATES.get(rig);
  if (!s) {
    s = {
      gait: ASKED,
      phase: NaN,
      walked: 0,
      pace: 0,
      shown: 0,
      on: NaN,
      dip: 0,
      style: undefined,
      want: undefined,
      wantKey: '',
      applied: NO_CYCLE,
      shoes: undefined,
    };
    STATES.set(rig, s);
  }
  return s;
}

/** Which walk someone walks: the one the address asks for, or the one the model lab gives them; none for the game's own. */
export const gaitOf = (rig: CharRig): Gait | undefined => (STATES.get(rig) ?? (ASKED ? stateOf(rig) : undefined))?.gait;

/** Give someone a walk of their own, or the game's own (`'today'`), whatever the address asks for: for the model lab. */
export function setGait(rig: CharRig, gait: Gait | 'today') {
  stateOf(rig).gait = gait === 'today' ? undefined : gait;
}

/** How fast the cycle is shown going round, in radians a second, for a pace the ground would set it going at. */
export function cadenceFor(pace: number, cap = 1) {
  const from = CADENCE.from * Math.PI * cap;
  const most = CADENCE.most * Math.PI * cap;
  if (pace <= from) return pace;
  return from + (most - from) * Math.tanh((pace - from) / (most - from));
}

/** Where someone's walk has got to this frame. */
export interface GaitNow {
  state: GaitState;
  /** How far round the cycle of two steps they are, in radians. */
  phase: number;
}

/**
 * Move someone's walk on for this frame: ease toward the way they walk now, count the ground covered since last frame
 * into their steps, no quicker than `CADENCE` allows, and ease into walking or out of it. Someone who stops finishes
 * their step, slowing, as they settle; someone who sits or lies down stops walking at once.
 */
export function advanceGait(rig: CharRig, c: Char, dt: number, gait: Gait, w: Walker): GaitNow {
  const s = stateOf(rig);
  const walking = c.pose === 'walk';
  if (Number.isNaN(s.phase)) {
    s.phase = rig.walked * STRIDE + c.id * 1.7;
    s.walked = rig.walked;
    s.on = walking ? 1 : 0;
  }
  const want = styleFor(gait, c, rig, w, s);
  if (!s.style) s.style = { ...want };
  else {
    const a = 1 - Math.exp(-dt * RESTYLE);
    for (const key of STYLE_KEYS) s.style[key] += (want[key] - s.style[key]) * a;
  }
  const st = s.style;
  const covered = Math.max(0, rig.walked - s.walked);
  s.walked = rig.walked;
  const perMeter = STRIDE * st.stride;
  if (dt > 0) s.pace += ((covered * perMeter) / dt - s.pace) * (1 - Math.exp(-dt * EASE.pace));
  if (walking) {
    const shown = cadenceFor(s.pace, st.cap);
    s.shown = shown;
    s.phase += covered * perMeter * (s.pace > 1e-6 ? shown / s.pace : 1);
    s.on = Math.min(1, s.on + dt / EASE.start);
  } else if (c.pose === 'stand') {
    // finishing the step they were on, slowing as they settle
    s.phase += s.shown * dt * smoothstep(s.on, 0, 1);
    s.on = Math.max(0, s.on - dt / EASE.stop);
  } else s.on = 0;
  return { state: s, phase: s.phase };
}

/**
 * What the walk holds steady while someone walks, which eases in and out as the rest of the pose does: their lean,
 * the head held down or up, the arms out, the elbows bent, an arm across the belly or both behind the back, and,
 * strolling with nothing to do, a look round as they go. Only arms free to swing (`armsL`, `armsR`) are held.
 */
export function gaitPosture(now: GaitNow, c: Char, t: number, idle: boolean, armL: boolean, armR: boolean) {
  const st = now.state.style ?? WEIGHTED;
  const belly = armL ? st.belly : 0;
  const behind = st.behind;
  const out = {
    lean: st.lean,
    headX: st.headDown,
    headYaw: idle ? Math.sin(t * 0.8 + c.id) * 0.45 : 0,
    armOut: st.armOut,
    armL: 0,
    armR: 0,
    elbowL: -st.elbow,
    elbowR: -st.elbow,
    bendL: 0,
    bendR: 0,
  };
  if (behind > 0) {
    // the hands clasped behind the back, as staff with nothing to do look round the room
    if (armL) Object.assign(out, { armL: 0.56 * behind, elbowL: lerp(out.elbowL, -0.4, behind), bendL: 2.1 * behind });
    if (armR) Object.assign(out, { armR: 0.56 * behind, elbowR: lerp(out.elbowR, -0.4, behind), bendR: 2.1 * behind });
    out.armOut = lerp(out.armOut, -0.22, behind);
  }
  if (belly > 0) {
    // the left forearm across the belly, holding it
    out.armL = -0.75 * belly;
    out.elbowL = lerp(out.elbowL, -1.15, belly);
    out.bendL = 1.3 * belly;
  }
  return out;
}

/** An angle brought round to between 0 and 1 of a turn. */
const turnOf = (a: number) => a - Math.floor(a);

/**
 * How far a leg is turned at a point in the cycle `u`, from 0 as its heel strikes to 1 as it strikes again, forward
 * of straight down being negative, in a walk's style: back steadily with the foot on the floor, then swung forward
 * through the air, easing out of the push and overshooting a little before it settles into the next step.
 */
function legAt(u: number, st: Style) {
  const front = -st.reach;
  const rear = st.reach * st.back;
  if (u < st.duty) return lerp(front, rear, u / st.duty);
  const s = (u - st.duty) / (1 - st.duty);
  // the speed the leg goes back at on the floor, carried into the swing's ends, for a smooth hand-over
  const m = ((rear - front) / st.duty) * (1 - st.duty) * st.tangent;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * rear + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * front + (s3 - s2) * m;
}

/**
 * How far a knee bends beyond straight at a point in the cycle: giving a little as the heel strikes, straight under the
 * body, bending as the foot leaves the floor, high as the leg swings through, and straight again to meet the floor.
 */
function kneeAt(u: number, st: Style) {
  const give = 0.3;
  let k = u < give ? st.load * Math.sin((Math.PI * u) / give) : 0;
  const before = 0.12;
  if (u >= st.duty - before && u < st.duty) k += st.pre * smoothstep(u, st.duty - before, st.duty);
  if (u >= st.duty) {
    const s = (u - st.duty) / (1 - st.duty);
    const fading = st.pre * (1 - s);
    // up to its highest a third of the way through, and down again, without a jerk as it leaves the floor
    const w = s < KNEE_TOP ? (0.5 * s) / KNEE_TOP : 0.5 + (0.5 * (s - KNEE_TOP)) / (1 - KNEE_TOP);
    k += fading + (st.lift - fading) * Math.sin(Math.PI * w);
  }
  return k;
}

/**
 * How far a foot is turned at the ankle at a point in the cycle, toe down being positive: its toe up as the heel
 * strikes, flat on the floor under the body, its heel rising as it pushes off, and held near square to the shin in the
 * air, a little toe up.
 */
function footAt(u: number, st: Style, leg: number, knee: number) {
  const strike = 0.1;
  const push = 0.2;
  // how the foot lies on the floor, turned against the leg above it
  let floor = 0;
  if (u < strike) floor = -ROLL.heel * (1 - smoothstep(u, 0, strike));
  else if (u > st.duty - push && u < st.duty) floor = ROLL.toe * smoothstep(u, st.duty - push, st.duty);
  else if (u >= st.duty) floor = u > 0.85 ? -ROLL.heel * smoothstep(u, 0.85, 1) : ROLL.toe;
  const onFloor = floor - leg - knee;
  // in the air, square to the shin, but handed over smoothly from and back to the floor
  const air = u < st.duty ? 0 : smoothstep(u, st.duty, st.duty + 0.15) * (1 - smoothstep(u, 0.85, 1));
  return lerp(onFloor, -ROLL.swing, air) * st.roll;
}

/**
 * How far below the hip a leg reaches, turned so far at the hip, knee and ankle, in meters before scaling: down the
 * thigh and shin to the ankle, and on to whichever of the heel and the toe is lower.
 */
function reachOf(leg: number, knee: number, foot: number) {
  const shin = leg + knee;
  const pitch = shin + foot;
  const ankle = THIGH * Math.cos(leg) + SHIN * Math.cos(shin);
  const heel = SOLE * Math.cos(pitch) - HEEL * Math.sin(pitch);
  const toe = SOLE * Math.cos(pitch) + TOE * Math.sin(pitch);
  return ankle + Math.max(heel, toe);
}

/** A soft bump of height 1 at a point of a cycle, so wide either side, coming round again each cycle. */
function pulse(u: number, at: number, wide: number) {
  const d = turnOf(u - at + 0.5) - 0.5;
  return Math.exp(-(d * d) / (wide * wide));
}

/**
 * The cycle of a walk at this frame, to put on the joints over the rest of the pose: the legs, knees and feet at their
 * points in the cycle, a half apart; the body dipping as far as the lower foot needs to stay on the floor; the arms
 * swinging against the legs, if they are free to (`armL`, `armR`); the hips swaying and turning, the shoulders turning
 * against them, the head held steady; and, as the walk asks, a bounce, a squash and stretch, a lagging head, a stamp
 * or a skip. All of it scaled down as someone eases into walking or settles out of it.
 */
export function gaitCycle(rig: CharRig, c: Char, dt: number, now: GaitNow, armL: boolean, armR: boolean): Cycle {
  const s = now.state;
  const st = s.style ?? WEIGHTED;
  const on = smoothstep(s.on, 0, 1);
  if (on <= 0) {
    s.dip = 0;
    return NO_CYCLE;
  }
  const uL = turnOf(now.phase / (Math.PI * 2));
  const uR = turnOf(uL + 0.5);
  // gliding at a higher speed of the game, the steps reach a little further
  const glide = s.shown > 0 ? clamp((s.pace / s.shown - 1) / 1.5, 0, 1) : 0;
  const reach = on * (1 + (CADENCE.stretch - 1) * glide);
  const legL = legAt(uL, st) * reach;
  const legR = legAt(uR, st) * reach;
  const kneeL = kneeAt(uL, st) * on;
  const kneeR = kneeAt(uR, st) * on;
  const footL = footAt(uL, st, legL, kneeL + KNEE_REST) * on;
  const footR = footAt(uR, st, legR, kneeR + KNEE_REST) * on;
  // down as far as the lower foot needs to stay on the floor, or a share of it; up as far as it must not go through it
  const dip =
    Math.max(reachOf(legL, kneeL + KNEE_REST, footL), reachOf(legR, kneeR + KNEE_REST, footR)) -
    reachOf(0, KNEE_REST, 0);
  const step = turnOf(uL * 2);
  const ridden = (Math.min(0, dip) * st.bob + Math.max(0, dip) * RIDE.rise) * rig.scale;
  s.dip += (ridden - s.dip) * (dt > 0 ? 1 - Math.exp(-dt / RIDE.lag) : 1);
  let bodyY = s.dip;
  bodyY += st.bounce * Math.pow(Math.sin(Math.PI * step), 0.8) * on;
  if (st.skip && c.kind === 'guest' && c.outcome === 'healed' && rig.cured)
    bodyY += Math.abs(Math.sin(now.phase * 0.5)) * st.skip * on;
  // the hips over the standing foot, the shoulders rolling with them, and the standing leg leaning in to keep its
  // foot where it is
  const over = Math.cos(Math.PI * 2 * (uL - st.duty / 2));
  const swayX = -st.sway * over * on;
  const legZ = -Math.asin(clamp(swayX / (HIP * rig.scale * rig.wide), -1, 1));
  const swing = -Math.cos(Math.PI * 2 * uL);
  const hipYaw = st.hipYaw * -swing * on;
  const twist = st.twist * swing * on;
  // into each step, and a stamp of the foot as it lands
  const stamp = st.stomp * (pulse(uL, 0.03, 0.05) + pulse(uR, 0.03, 0.05)) * on;
  const lean = st.nod * Math.cos(Math.PI * 4 * (uL - 0.05)) * on + stamp * 0.4;
  const roll = st.hipDrop * over * on;
  /** An arm against the leg on the other side, at that leg's point `u`, more forward than back, the elbow trailing. */
  const armOf = (u: number, free: boolean) => {
    if (!free) return { arm: 0, elbow: 0 };
    const v = -Math.cos(Math.PI * 2 * (u - st.armLag));
    const e = Math.max(0, Math.cos(Math.PI * 2 * (u - st.armLag - st.elbowLag)));
    return { arm: v * st.arm * (v < 0 ? 1 : st.armBack) * on, elbow: -st.elbowSwing * e * on };
  };
  const left = armOf(uR, armL);
  const right = armOf(uL, armR);
  // the head nodding a beat behind the bounce, and jolting down with a stamp
  const lag = st.headLag * Math.sin(Math.PI * 2 * (step - 0.3)) * on;
  // squashed as the foot lands, stretched as it pushes off
  const squash = st.squash * on * (0.7 * pulse(step, 0.25, 0.09) - pulse(step, 0.03, 0.07));
  return {
    legL,
    legR,
    legZL: legZ,
    legZR: legZ,
    kneeL,
    kneeR,
    footL,
    footR,
    armL: left.arm,
    armR: right.arm,
    armOut: st.flap * Math.sin(Math.PI * step) * on,
    elbowL: left.elbow,
    elbowR: right.elbow,
    bodyY,
    swayX,
    hipYaw,
    lean,
    roll,
    twist,
    headX: -lean * st.steady + lag + stamp,
    headZ: -roll * st.steady,
    headYaw: -(hipYaw + twist) * st.steady,
    headY: -lag * 0.04,
    squash,
  };
}

/**
 * Turn an eased part of the pose with the walk's cycle on top: take off what the cycle put on last frame, ease what is
 * left toward where the pose wants it, and put this frame's cycle on. With no cycle, it eases as the pose always has.
 */
export const ride = (now: number, to: number, k: number, was: number, add: number) => {
  const base = now - was;
  return base + (to - base) * k + add;
};

/**
 * Put on what the cycle moves that the pose never does, now that the rest is posed: each shoe rolled at the ankle,
 * the body squashed or stretched, the head bobbing on the neck. Then note the cycle, to take it off again next frame.
 */
export function finishGait(rig: CharRig, now: GaitNow, cycle: Cycle) {
  const s = now.state;
  s.shoes ??= [rig.joints.shinL.getObjectByName('shoe'), rig.joints.shinR.getObjectByName('shoe')];
  rollShoe(s.shoes[0], cycle.footL);
  rollShoe(s.shoes[1], cycle.footR);
  const sq = cycle.squash;
  rig.torso.scale.set(1 - sq / 2, 1 + sq, 1 - sq / 2);
  rig.head.position.y += cycle.headY - s.applied.headY;
  s.applied = cycle;
}

/** The axis a foot rolls about, across the body, and a turn about it and a point turned by it, kept to be reused. */
const ACROSS = new THREE.Vector3(1, 0, 0);
const turned = new THREE.Quaternion();
const pivot = new THREE.Vector3();

/**
 * Roll a shoe at the ankle, toe down being positive: it hangs from the knee, so it is turned there and moved back by
 * however far that turn would carry the ankle, which leaves it turned about the ankle.
 */
function rollShoe(shoe: THREE.Object3D | undefined, by: number) {
  if (!shoe) return;
  shoe.rotation.x = by;
  turned.setFromAxisAngle(ACROSS, by);
  pivot.copy(ANKLE).applyQuaternion(turned);
  shoe.position.copy(ANKLE).sub(pivot);
}
