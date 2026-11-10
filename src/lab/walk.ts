// People walking round loops a few tiles across, turning at each corner, at any of the game's speeds: for the model
// lab, to see how people walk. One guest walks the game's own walk; the same guest walks each of the walks being tried
// out (`render/gait.ts`) side by side with it; and one walker for each way of walking the `character` walk shows.

import * as THREE from 'three';

import { CONDITIONS, GUEST_WALK, STAFF_WALK, TIRED_WALK } from '../core/data';
import { moveAlong } from '../core/sim/movement';
import type { Char, Guest, Staff } from '../core/state/types';
import { must } from '../core/util';
import { type Gait, setGait } from '../render/gait';
import { buildCharacter, type CharRig } from '../render/models/character';
import { poseChar, treadmill } from '../render/pose';
import type { Specimen } from './catalog';
import { choice, type Control, toggle } from './controls';
import { demoGuest, demoStaff, LAB_LOOK } from './people';

/** The sim's steps, sixty a second. */
const STEP = 1 / 60;

/** The corners of a loop, round its middle, in meters. */
const CORNERS: readonly [number, number][] = [
  [-1.5, -1],
  [1.5, -1],
  [1.5, 1],
  [-1.5, 1],
];

/** A smaller loop, for the many walkers of `walk:states`. */
const SMALL: readonly [number, number][] = CORNERS.map(([x, y]) => [x * 0.75, y * 0.75]);

/**
 * How long a walker stopping at a corner stands there, in the game's seconds, and at which corners they stop: every
 * other, so they also walk on round one without stopping.
 */
const PAUSE = { lasts: 1.2, at: [0, 2] } as const;

/** How long a walker on the spot walks before they stop, in the game's seconds, when they stop at all. */
const WALK_FOR = 2.6;

/** The walks side by side in `walk:compare`, the game's own first, left to right. */
const COMPARED: readonly (Gait | 'today')[] = ['today', 'weighted', 'bouncy', 'character'];

/** What each walk is called over it. */
const TITLES: Readonly<Record<Gait | 'today', string>> = {
  today: 'Today',
  weighted: 'Weighted',
  bouncy: 'Bouncy',
  character: 'Character',
};

/** How far apart the loops side by side are, in meters. */
const APART = 4.2;

/** One walker round a loop: who, posed on which rig, where their loop is, how fast they walk, and how far round it. */
interface Lap {
  c: Char;
  rig: CharRig;
  at: readonly [number, number];
  corners: readonly (readonly [number, number])[];
  pace: number;
  next: number;
  /** How much longer they stand at a corner, in the game's seconds, and how long they have walked on the spot. */
  rest: number;
  walked: number;
}

/** A guest as the lab shows them walking, with no symptom showing, so nothing but the walk catches the eye. */
function walkingGuest(): Guest {
  const condition = must(CONDITIONS[0], 'a condition');
  return { ...demoGuest(LAB_LOOK, condition.id), state: 'called', pose: 'walk', path: null };
}

/** Set a walker at the first corner of their loop, walking to the next, posed on a rig of their own with a walk. */
function lapFor(
  c: Char,
  at: readonly [number, number],
  corners: Lap['corners'],
  gait: Gait | 'today' | undefined,
  pace: number,
): Lap {
  const rig = buildCharacter(c.look, c.kind === 'staff' ? c.role : undefined);
  if (gait) setGait(rig, gait);
  const [x, y] = must(corners[0], 'a corner');
  c.x = at[0] + x;
  c.y = at[1] + y;
  return { c, rig, at, corners, pace, next: 1, rest: 0, walked: 0 };
}

/**
 * Walk someone on round their loop by so many of the game's seconds, a sim step at a time, stopping a while at every
 * other corner if `stops`. On the spot, they face along the loop's long side and walk in place, stopping now and then.
 */
function lapOn(lap: Lap, by: number, stops: boolean, onTheSpot: boolean) {
  const { c } = lap;
  if (onTheSpot) {
    c.x = lap.at[0];
    c.y = lap.at[1];
    c.facing = Math.PI / 2;
    c.path = null;
    for (let left = by; left > 1e-6; left -= STEP) {
      const dt = Math.min(STEP, left);
      if (lap.rest > 0) {
        lap.rest -= dt;
        c.pose = 'stand';
        continue;
      }
      c.pose = 'walk';
      treadmill(lap.rig, dt, lap.pace);
      lap.walked += dt;
      if (stops && lap.walked >= WALK_FOR) {
        lap.walked = 0;
        lap.rest = PAUSE.lasts;
      }
    }
    return;
  }
  for (let left = by; left > 1e-6; left -= STEP) {
    const dt = Math.min(STEP, left);
    if (lap.rest > 0) {
      lap.rest -= dt;
      continue;
    }
    if (!c.path) {
      const [cx, cy] = must(lap.corners[lap.next], 'a corner');
      const x = lap.at[0] + cx;
      const y = lap.at[1] + cy;
      c.path = [[x, y, 0]];
      c.dest = [Math.floor(x), Math.floor(y), 0, 0, 0];
      lap.next = (lap.next + 1) % lap.corners.length;
    }
    const arrived = moveAlong(c, dt, lap.pace);
    c.pose = 'walk';
    // the corner just reached, the one before the next
    const reached = (lap.next + lap.corners.length - 1) % lap.corners.length;
    if (arrived && stops && (PAUSE.at as readonly number[]).includes(reached)) {
      lap.rest = PAUSE.lasts;
      c.pose = 'stand';
    }
  }
}

/** How high over a walker's feet their name floats, in meters: clear of their head and anything over it. */
const LABEL_HEIGHT = 2.1;

/** A name floating over a walker, to tell the walks apart: for the lab alone, so a texture of its own is no matter. */
function label(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = must(canvas.getContext('2d'), 'a canvas to write on');
  g.fillStyle = 'rgba(255, 248, 234, 0.92)';
  g.beginPath();
  g.roundRect(8, 8, 496, 112, 40);
  g.fill();
  g.fillStyle = '#24384a';
  g.font = '600 64px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = LABEL_HEIGHT;
  sprite.renderOrder = 10;
  return sprite;
}

/** The lab's settings for a room of walkers: the game's speed, whether they stop now and then, and on the spot. */
interface Walking {
  speed: string;
  stops: boolean;
  spot: boolean;
}

/** The settings for a room of walkers, as controls. */
const walkingControls = (st: Walking): Control[] => [
  choice('Game speed', st, 'speed', [
    ['1', 'Speed 1'],
    ['2', 'Speed 2'],
    ['3', 'Speed 3'],
  ]),
  toggle('Stop at corners', st, 'stops', true),
  toggle('On the spot', st, 'spot', true),
];

/**
 * Walk everyone on by as far as the game would since the last frame, and pose them there. The walk goes by the lab's
 * clock, not the frame's step, which is a whole second while the lab is held still: so held still for a picture, each
 * walker stops half a second's walk at the game speed from where they set off, however many frames the picture waits.
 */
function walkAll(laps: readonly Lap[], st: Walking) {
  let last: number | null = null;
  return (t: number, dt: number) => {
    const since = last === null ? 0.5 : t - last;
    last = t;
    for (const lap of laps) {
      lapOn(lap, since * Number(st.speed), st.stops, st.spot);
      poseChar(lap.rig, lap.c, t, dt, { style: null });
    }
  };
}

/** A guest walking round and round the loop, in the game's own walk, or the one the address asks for. */
export function walkSpecimen(): Specimen {
  return {
    id: 'walk:guest',
    group: 'Acts',
    name: 'A guest walking round corners',
    footprint: [4, 3],
    /** Build the guest at the first corner, walking to the next. */
    build() {
      const st: Walking = { speed: '3', stops: false, spot: false };
      const lap = lapFor(walkingGuest(), [0, 0], CORNERS, undefined, GUEST_WALK);
      return {
        root: lap.rig.group,
        controls: walkingControls(st).slice(0, 1),
        animate: walkAll([lap], st),
      };
    },
  };
}

/**
 * The same guest walking the same loop in each of the walks side by side, the game's own on the left, then weighted,
 * bouncy and character, each named over its loop. They stop at every other corner, to show how they set off and
 * settle, and can walk on the spot instead, facing right, for a look at the cycle from the side.
 */
export function walkCompareSpecimen(): Specimen {
  const st: Walking = { speed: '1', stops: true, spot: false };
  return {
    id: 'walk:compare',
    group: 'Acts',
    name: 'Walks side by side: today, weighted, bouncy, character',
    footprint: [16, 3],
    /** Build a guest for each walk at the first corner of their loop. */
    build() {
      const root = new THREE.Group();
      const laps = COMPARED.map((gait, i) => {
        const at = [(i - (COMPARED.length - 1) / 2) * APART, 0] as const;
        const lap = lapFor(walkingGuest(), at, CORNERS, gait, GUEST_WALK);
        root.add(lap.rig.group);
        // named over their head, wherever they walk
        lap.rig.group.add(label(TITLES[gait]));
        return lap;
      });
      return { root, controls: walkingControls(st), animate: walkAll(laps, st) };
    },
  };
}

/** A walker for `walk:states`: what they are called, who they are, and how fast the game walks them. */
interface StateWalker {
  name: string;
  c: Char;
  pace: number;
}

/** A member of staff of a role in a state, with so much energy. */
function staffIn(role: Staff['role'], state: Staff['state'], energy = 100): Staff {
  return { ...demoStaff(LAB_LOOK, role), state, energy, pose: 'walk', path: null };
}

/** The ways of walking `character` shows, one walker each, made afresh. */
function stateWalkers(): StateWalker[] {
  const guest = walkingGuest;
  return [
    { name: 'At ease', c: guest(), pace: GUEST_WALK },
    { name: 'Hurrying', c: staffIn('therapist', 'toJob'), pace: STAFF_WALK },
    { name: 'Worn out', c: staffIn('therapist', 'toBreak', 8), pace: STAFF_WALK * TIRED_WALK },
    { name: 'Nothing to do', c: staffIn('receptionist', 'wander'), pace: STAFF_WALK },
    { name: 'Impatient', c: { ...guest(), state: 'toWait', patience: 35 }, pace: GUEST_WALK },
    { name: 'Fed up', c: { ...guest(), state: 'toWait', patience: 15 }, pace: GUEST_WALK },
    { name: 'Unwell', c: { ...guest(), health: 18 }, pace: GUEST_WALK },
    { name: 'Healed', c: { ...guest(), state: 'leaving', outcome: 'healed' }, pace: GUEST_WALK },
  ];
}

/** How many walkers of `walk:states` go in a row, and how far apart the rows are, in meters. */
const ROW = 4;
const ROWS_APART = 3.4;

/** How far apart the walkers of `walk:states` stand in their one row on the spot, in meters. */
const SPOT_APART = 2.2;

/**
 * One walker for each way of walking the `character` walk shows, each named over their loop: at ease, hurrying to a
 * job, worn out, with nothing to do, impatient, fed up, unwell and healed. The other walks can be chosen, to see what
 * each makes of the same people.
 */
export function walkStatesSpecimen(): Specimen {
  const st: Walking & { walk: string } = { speed: '1', stops: false, spot: false, walk: 'character' };
  return {
    id: 'walk:states',
    group: 'Acts',
    name: 'How people walk as they feel: at ease, hurrying, worn out, idle, impatient, fed up, unwell, healed',
    footprint: [14, 7],
    /** Build a walker for each state at the first corner of their loop. */
    build() {
      const root = new THREE.Group();
      const laps = stateWalkers().map((s, i) => {
        const col = i % ROW;
        const row = Math.floor(i / ROW);
        // on the spot, all in one row, to be seen side on
        const at = st.spot
          ? ([(i - 3.5) * SPOT_APART, 0] as const)
          : ([(col - (ROW - 1) / 2) * APART * 0.8, (row - 0.5) * ROWS_APART] as const);
        const { c } = s;
        c.id = 11 + i * 7;
        const lap = lapFor(c, at, SMALL, st.walk as Gait | 'today', s.pace);
        root.add(lap.rig.group);
        lap.rig.group.add(label(s.name));
        return lap;
      });
      return {
        root,
        controls: [
          choice(
            'Walk',
            st,
            'walk',
            COMPARED.map((g) => [g, TITLES[g]] as const),
            true,
          ),
          ...walkingControls(st),
        ],
        animate: walkAll(laps, st),
      };
    },
  };
}
