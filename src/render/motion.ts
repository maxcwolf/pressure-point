// Where someone is shown, which can differ for a moment from where the sim has them. The sim moves people a step at a
// time and changes how they stand all at once: on the tick a guest reaches a table they are lying on it, and on the
// tick they get up they are standing on the floor. Shown, they climb on along the last step of the way there, and off
// along the first step away, so nothing the sim counts changes; and a guest healed lying down stays there until the
// puff of the cure is done, then catches up with where the sim has got to.

import * as THREE from 'three';

import { turnToward } from '../core/sim/movement';
import type { Char } from '../core/state/types';
import type { Lying } from './acts';

const { smoothstep, lerp } = THREE.MathUtils;

/** How far someone may move in a frame and still have walked there, in meters: further, they were put there. */
export const TELEPORT = 2;

/**
 * Where along the last step to a spot they lie on someone stops walking and climbs (as a share of the step, which runs
 * from the middle of the tile beside it to the middle of the spot, crossing its edge about halfway), how far along
 * they are up at the spot's height, and from where they lie down.
 */
export const CLIMB = { from: 0.4, up: 0.62, lie: 0.45 } as const;

/** How long a guest healed lying down is held there, for the puff of the cure to be seen, in seconds. */
export const CURE_HOLD = 0.95;

/** How long someone held back takes to climb down, in seconds, whatever the game's speed. */
export const CLIMB_DOWN = 0.45;

/** How much faster than the sim someone held back catches up, and how fast at least, in meters a second. */
const CATCH = { times: 2.5, least: 2.5 } as const;

/** How fast the way someone is shown facing turns toward the way the sim has them face, in radians a second. */
const TURN = 9;

/** How quickly the height someone is shown at follows the sim's, each second. */
const RISE = 14;

/** A spot someone lay or sat at to be treated, as the sim put them there. */
interface Spot {
  x: number;
  y: number;
  h: number;
  facing: number;
  pose: 'lie' | 'sit';
  lie: Lying | undefined;
}

/** How someone is being shown moving, from one frame to the next. */
export interface Motion {
  /** Where they are shown, how high and which way they face; NaN before their first frame. */
  x: number;
  y: number;
  h: number;
  facing: number;
  /** Where the sim had them last frame. */
  simX: number;
  simY: number;
  /** The spot they were last seen lying or sitting at to be treated, until they are off it. */
  spot: Spot | undefined;
  /** The first point the sim walked them to from the spot, which they climb down to. */
  off: { x: number; y: number } | undefined;
  /** Until when, in the scene's seconds, they are held at the spot; NaN if they are not. */
  hold: number;
  /** Where the sim has walked them since they were held, which they follow to catch up. */
  trail: { x: number; y: number }[];
  /** When they were last down off a spot they were held at, in the scene's seconds, or NaN. */
  upAt: number;
  /** How far they are shown stepped aside from where they would be, to keep out of someone else, in meters. */
  aside: { x: number; y: number };
}

/** A new motion, before the first frame. */
export const newMotion = (): Motion => ({
  x: NaN,
  y: NaN,
  h: 0,
  facing: 0,
  simX: NaN,
  simY: NaN,
  spot: undefined,
  off: undefined,
  hold: NaN,
  trail: [],
  upAt: NaN,
  aside: { x: 0, y: 0 },
});

/**
 * How someone is shown this frame: the person as the sim has them, moved and turned to where they are shown; how they
 * lie, if they are shown lying; how far they are lying down, from 0 (upright) to 1, while they climb on or off; and how
 * long since they got down off a spot they were held at, in seconds, or NaN.
 */
export interface Shown {
  c: Char;
  lie: Lying | undefined;
  lying: number;
  up: number;
}

/** Turn an angle toward another by a share of the way, going the short way round. */
const turnBy = (from: number, to: number, a: number) => from + wrap(to - from) * a;

/**
 * The way the front of someone's body faces, from the way the sim has them face: someone lying on their back faces
 * the way their feet point, having lain back, where the sim has the way their head points.
 */
const frontOf = (facing: number, pose: Char['pose'], lie: Lying | undefined) =>
  facing + (pose === 'lie' && lie === 'back' ? Math.PI : 0);

/** An angle brought round to between -pi and pi. */
const wrap = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

/**
 * Work out how someone is shown this frame, from how the sim has them, how they lie if they are lying where they are
 * treated (`lie`), and how they will lie at the item they are going to (`bed`), if they will.
 */
export function showMotion(
  m: Motion,
  c: Char,
  t: number,
  dt: number,
  lie: Lying | undefined,
  bed: Lying | undefined,
): Shown {
  const step = Math.hypot(c.x - m.simX, c.y - m.simY);
  m.simX = c.x;
  m.simY = c.y;
  // seen for the first time, or put somewhere new: shown where they are
  if (!(step <= TELEPORT)) {
    Object.assign(m, { x: c.x, y: c.y, h: c.h, facing: frontOf(c.facing, c.pose, lie) });
    Object.assign(m, { off: undefined, hold: NaN, trail: [], aside: { x: 0, y: 0 } });
    m.spot = spotOf(c, lie);
    return { c: { ...c }, lie, lying: c.pose === 'lie' ? 1 : 0, up: NaN };
  }
  const spot = m.spot;
  if (spot && !atSpot(c, spot)) {
    // getting up: down to the first point the sim walks them to, held there first if the sim healed them just now
    if (!m.off) {
      const next = c.path?.[0];
      m.off = next ? { x: next[0], y: next[1] } : { x: c.x, y: c.y };
      if (c.kind === 'guest' && c.outcome === 'healed') {
        m.hold = t + CURE_HOLD;
        m.trail = [];
        m.x = spot.x;
        m.y = spot.y;
      }
    }
  } else {
    m.spot = spotOf(c, lie) ?? (spot && atSpot(c, spot) ? spot : undefined);
    m.off = undefined;
  }
  const lagging = Number.isFinite(m.hold);
  if (lagging) {
    // climbing down at a pace of their own, then hurrying after the sim
    const down = m.spot && m.off && Math.hypot(m.off.x - m.spot.x, m.off.y - m.spot.y);
    follow(m, c, t, down ? (down / CLIMB_DOWN) * dt : Math.max(step * CATCH.times, CATCH.least * dt));
  } else {
    m.x = c.x;
    m.y = c.y;
  }
  const shown: Shown = { c: { ...c, x: m.x, y: m.y }, lie, lying: c.pose === 'lie' ? 1 : 0, up: t - m.upAt };
  let h = c.h;
  let facing = frontOf(c.facing, c.pose, lie);
  let exact = false;
  const off = m.spot && m.off ? m.spot : undefined;
  if (off && m.off) {
    // climbing down off the spot, along the way to the first point, once any hold is over
    const span = Math.hypot(m.off.x - off.x, m.off.y - off.y);
    const w = span > 0.05 ? Math.min(1, Math.hypot(m.x - off.x, m.y - off.y) / span) : 1;
    const still = t < m.hold;
    if (off.pose === 'lie' && w < 1) {
      shown.c.pose = 'lie';
      shown.lie = off.lie;
      shown.lying = 1 - smoothstep(w, 0, 1 - CLIMB.lie);
      if (shown.lying <= 0) shown.c.pose = w < 1 - CLIMB.from ? 'stand' : 'walk';
      h = off.h * (1 - smoothstep(w, 1 - CLIMB.up, 1 - CLIMB.from));
      const away = Math.atan2(m.off.x - off.x, m.off.y - off.y);
      facing = turnBy(frontOf(off.facing, 'lie', off.lie), away, smoothstep(w, 0, 1 - CLIMB.from));
      exact = true;
    } else if (still) {
      // held sitting where they were treated
      shown.c.pose = 'sit';
      h = off.h;
      facing = off.facing;
      exact = true;
    } else {
      if (lagging) m.upAt = t;
      m.spot = undefined;
      m.off = undefined;
    }
  } else if (!lagging) {
    const on = bed && climbOn(c, bed);
    if (on) {
      shown.c.pose = on.u < CLIMB.from ? 'walk' : 'lie';
      shown.lie = on.lie;
      shown.lying = smoothstep(on.u, CLIMB.lie, 1);
      h = c.endH * smoothstep(on.u, CLIMB.from, CLIMB.up);
      facing = turnBy(on.toward, frontOf(c.endFace, 'lie', on.lie), smoothstep(on.u, CLIMB.from, 1));
      exact = true;
    }
  }
  if (lagging && !off) {
    // catching up, walking the way the sim went
    const next = m.trail[0] ?? c;
    if (Math.hypot(next.x - m.x, next.y - m.y) > 0.01) facing = Math.atan2(next.x - m.x, next.y - m.y);
    shown.c.pose = 'walk';
    h = 0;
  }
  if (exact) {
    m.h = h;
    m.facing = turnToward(m.facing, facing, TURN * 3 * dt);
  } else if (c.pose === 'walk' && !lagging) {
    // walking, the sim turns them smoothly itself
    m.h = h;
    m.facing = facing;
  } else {
    m.h += (h - m.h) * Math.min(1, dt * RISE);
    m.facing = turnToward(m.facing, facing, TURN * dt);
  }
  shown.c.h = m.h;
  shown.c.facing = m.facing - frontOf(0, shown.c.pose, shown.lie);
  return shown;
}

/** The spot someone is lying or sitting at to be treated now, if they are. */
function spotOf(c: Char, lie: Lying | undefined): Spot | undefined {
  if (c.pose === 'lie' && lie) return { x: c.x, y: c.y, h: c.h, facing: c.facing, pose: 'lie', lie };
  if (c.kind === 'guest' && c.state === 'served' && c.pose === 'sit')
    return { x: c.x, y: c.y, h: c.h, facing: c.facing, pose: 'sit', lie: undefined };
  return undefined;
}

/** Whether someone is still at a spot, as they were put there. */
const atSpot = (c: Char, s: Spot) => c.pose === s.pose && Math.hypot(c.x - s.x, c.y - s.y) < 0.01;

/**
 * How far along the last step to a spot they lie on someone is, from the middle of the tile beside it (0) to the spot
 * (1), the way they came at it, and how they will lie there; or nothing, if they are not on that step.
 */
function climbOn(c: Char, lie: Lying): { u: number; toward: number; lie: Lying } | undefined {
  const last = c.path?.length === 1 ? c.path[0] : undefined;
  if (!last?.[2] || c.endPose !== 'lie' || !c.dest) return undefined;
  const ax = c.dest[0] + 0.5;
  const ay = c.dest[1] + 0.5;
  const span = Math.hypot(last[0] - ax, last[1] - ay);
  if (span < 0.05) return undefined;
  const u = 1 - Math.min(1, Math.hypot(last[0] - c.x, last[1] - c.y) / span);
  return { u, toward: Math.atan2(last[0] - ax, last[1] - ay), lie };
}

/**
 * Note where the sim has walked someone held back, and once the hold is over, walk them on after it so far, until they
 * are back where it has them.
 */
function follow(m: Motion, c: Char, t: number, go: number) {
  const tail = m.trail.at(-1);
  if (!tail || Math.hypot(c.x - tail.x, c.y - tail.y) > 0.01) m.trail.push({ x: c.x, y: c.y });
  if (t < m.hold) return;
  for (let next = m.trail[0]; next && go > 0; next = m.trail[0]) {
    const d = Math.hypot(next.x - m.x, next.y - m.y);
    if (d <= go) {
      m.x = next.x;
      m.y = next.y;
      go -= d;
      m.trail.shift();
    } else {
      m.x = lerp(m.x, next.x, go / d);
      m.y = lerp(m.y, next.y, go / d);
      go = 0;
    }
  }
  if (!m.trail.length) m.hold = NaN;
}

/**
 * How close two people come before they are shown stepping aside from each other, how far aside they step at most, and
 * how quickly they ease there and back, each second. The sim walks people straight through each other; shown, they
 * edge round, a little, without changing where the sim has them.
 */
export const APART = { near: 0.45, most: 0.25, ease: 6 } as const;

/** How far ahead someone walking sees someone coming and starts to step aside, in meters, and how quickly, each second. */
const PASSING = { near: 0.75, ease: 12 } as const;

/** Someone shown this frame, for keeping people apart: where, and whether they step aside or stand their ground. */
export interface Placed {
  m: Motion;
  c: Char;
  /** Whether they keep where they are, lying, sitting or at work, others stepping round them. */
  fixed: boolean;
}

/**
 * Show people who come too close stepping aside from each other: anyone standing eases away from everyone within
 * reach, the more the closer, up to a step, so two both free part by up to two; anyone walking steps to the side,
 * sooner, the way that is already clear of them, so two meeting head on pass each other and two going the same way
 * walk side by side. Moves
 * each shown position by its step aside, from where the motion shows them, so it never adds up from one frame to the
 * next.
 */
export function keepApart(people: readonly Placed[], dt: number) {
  for (const a of people) {
    let x = 0;
    let y = 0;
    const walking = a.c.pose === 'walk';
    const near = walking ? PASSING.near : APART.near;
    // the way to their right as they walk
    const rx = Math.cos(a.c.facing);
    const ry = -Math.sin(a.c.facing);
    if (!a.fixed)
      for (const b of people) {
        if (b === a) continue;
        const dx = a.c.x - b.c.x;
        const dy = a.c.y - b.c.y;
        const d = Math.hypot(dx, dy);
        if (d >= near) continue;
        const push = ((near - d) / near) * APART.most;
        // right on top of each other: apart by who came first, to one side
        let [ux, uy] = d > 1e-4 ? [dx / d, dy / d] : a.c.id < b.c.id ? [1, 0] : [-1, 0];
        if (walking) {
          // aside, not back or ahead: to whichever side they are on already; if neither, to the right of someone
          // coming the other way, and to either side of someone going the same way, each their own
          const across = ux * rx + uy * ry;
          const same = b.c.pose === 'walk' && Math.cos(a.c.facing - b.c.facing) > 0;
          const side = Math.abs(across) > 0.3 ? Math.sign(across) : same && a.c.id > b.c.id ? -1 : 1;
          [ux, uy] = [rx * side, ry * side];
        }
        x += ux * push;
        y += uy * push;
      }
    const far = Math.hypot(x, y);
    if (far > APART.most) {
      x *= APART.most / far;
      y *= APART.most / far;
    }
    const ease = Math.min(1, dt * (walking ? PASSING.ease : APART.ease));
    a.m.aside.x += (x - a.m.aside.x) * ease;
    a.m.aside.y += (y - a.m.aside.y) * ease;
  }
  for (const a of people) {
    a.c.x += a.m.aside.x;
    a.c.y += a.m.aside.y;
  }
}
