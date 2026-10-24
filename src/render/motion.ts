// Where someone is shown, which can differ for a moment from where the sim has them. The sim moves people a step at a
// time and changes how they stand all at once: on the tick a guest reaches a table they are lying on it, and on the
// tick they get up they are standing on the floor. Shown, they walk up to its edge and climb on, and climb back off to
// its edge, in the same time at any speed of the game, then catch up with where the sim has got to, so nothing the sim
// counts changes; and a guest healed where they were treated stays there first while the puff of the cure plays.

import * as THREE from 'three';

import { turnToward } from '../core/sim/movement';
import type { Char } from '../core/state/types';
import type { Lying } from './acts';
import { BACK_Y, HIP, SIT_Y } from './models/character-detail';

const { smoothstep, lerp } = THREE.MathUtils;

/** How far someone may move in a frame and still have walked there, in meters: further, they were put there. */
export const TELEPORT = 2;

/**
 * Where along the last step to a spot they lie on someone stops, at the item's edge, as a share of the step from the
 * middle of the tile beside it to the spot.
 */
export const EDGE = 0.28;

/**
 * How long climbing onto a spot takes, onto their back or face down, and climbing back off it, in seconds, whatever
 * the game's speed.
 */
export const CLIMB = { back: 0.9, prone: 0.9 } as const;

/** How long a guest healed lying down is held there, for the puff of the cure to be seen, in seconds. */
export const CURE_HOLD = 0.95;

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
  /** Whether they were being treated there, rather than resting after it. */
  served: boolean;
}

/** The edge of a spot someone has walked up to and waits at, to climb on once the sim has them there. */
interface Edge {
  x: number;
  y: number;
  /** The way they came at it, the way their front will face lying there, and how high it is. */
  toward: number;
  face: number;
  h: number;
  lie: Lying;
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
  /** The first point the sim walked them to from the spot, the way they get off it. */
  off: { x: number; y: number } | undefined;
  /**
   * Until when, in the scene's seconds, they are held at the spot, NaN if they are not; until when they are climbing
   * down off it; and whether they were healed there, so they hop for joy once down.
   */
  hold: number;
  down: number;
  cured: boolean;
  /** Where the sim has walked them since they were held, which they follow to catch up. */
  trail: { x: number; y: number }[];
  /** When they were last down off a spot they were held at, in the scene's seconds, or NaN. */
  upAt: number;
  /** The edge they stopped at to climb onto a spot, until they are on it, and when they started to climb, or NaN. */
  edge: Edge | undefined;
  climbAt: number;
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
  down: NaN,
  cured: false,
  trail: [],
  upAt: NaN,
  edge: undefined,
  climbAt: NaN,
  aside: { x: 0, y: 0 },
});

/**
 * How someone is shown this frame: the person as the sim has them, moved and turned to where they are shown; how they
 * lie, if they are shown lying; how far they are lying down, from 0 (upright) to 1, while they climb on or off; how
 * long since they got down off a spot they were held at, in seconds, or NaN; and, climbing on face down, how far they
 * are on all fours and how far their hands reach down to it, and onto their back, how far they lie back from sitting
 * rather than from standing, each from 0 to 1.
 */
export interface Shown {
  c: Char;
  lie: Lying | undefined;
  lying: number;
  up: number;
  fours: number;
  hands: number;
  sat: number;
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
    Object.assign(m, { off: undefined, hold: NaN, down: NaN, trail: [], aside: { x: 0, y: 0 } });
    m.spot = spotOf(c, lie);
    return { c: { ...c }, lie, lying: c.pose === 'lie' ? 1 : 0, up: NaN, fours: 0, hands: 0, sat: 0 };
  }
  const spot = m.spot;
  if (spot && !atSpot(c, spot)) {
    // getting up: held there while the sim walks on, through the puff of a cure if the sim healed them just now where
    // they were treated, not on a Lounger after, and climbing down off whatever they lay on
    if (!m.off) {
      const next = c.path?.[0];
      m.off = next ? { x: next[0], y: next[1] } : { x: c.x, y: c.y };
      m.cured = c.kind === 'guest' && c.outcome === 'healed' && spot.served;
      if (m.cured || spot.pose === 'lie') {
        m.hold = t + (m.cured ? CURE_HOLD : 0);
        m.down = m.hold + (spot.pose === 'lie' ? CLIMB[spot.lie ?? 'prone'] : 0);
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
  const shown: Shown = { c: { ...c }, lie, lying: c.pose === 'lie' ? 1 : 0, up: NaN, fours: 0, hands: 0, sat: 0 };
  let h = c.h;
  let facing = frontOf(c.facing, c.pose, lie);
  let exact = false;
  const off = m.spot && m.off ? m.spot : undefined;
  if (off && m.off) {
    if (off.pose === 'lie' && t < m.down) {
      // lying there through any hold, then the climb onto it played backwards, down to its edge
      const e = edgeOf(off, m.off);
      const got = climbPose(shown, e, off, t < m.hold ? 1 : 1 - (t - m.hold) / CLIMB[e.lie], true);
      m.x = shown.c.x;
      m.y = shown.c.y;
      h = got.h;
      facing = got.facing;
      exact = true;
    } else if (t < m.hold) {
      // held sitting where they were treated
      shown.c.pose = 'sit';
      h = off.h;
      facing = off.facing;
      exact = true;
    } else {
      // down, standing at its edge, or up off the seat, to walk on after the sim from there
      if (off.pose === 'lie') {
        const e = edgeOf(off, m.off);
        m.x = e.x;
        m.y = e.y;
        // not back to where the sim had them between the spot and its edge
        const behind = Math.hypot(e.x - off.x, e.y - off.y) + 1e-3;
        while (m.trail[0] && Math.hypot(m.trail[0].x - off.x, m.trail[0].y - off.y) < behind) m.trail.shift();
      }
      if (m.cured) m.upAt = t;
      m.spot = undefined;
      m.off = undefined;
    }
  }
  if (lagging) follow(m, c, !m.off, Math.max(step * CATCH.times, CATCH.least * dt));
  else {
    m.x = c.x;
    m.y = c.y;
  }
  shown.c.x = m.x;
  shown.c.y = m.y;
  shown.up = t - m.upAt;
  if (!off && !lagging) {
    const on = bed && climbOn(c, bed);
    if (on) {
      // walking up to the item's edge, and waiting there for the sim to finish the step onto it
      const ex = lerp(on.ax, on.sx, EDGE);
      const ey = lerp(on.ay, on.sy, EDGE);
      if (on.u >= EDGE) {
        shown.c.x = m.x = ex;
        shown.c.y = m.y = ey;
        shown.c.pose = 'stand';
      }
      m.edge = { x: ex, y: ey, toward: on.toward, face: frontOf(c.endFace, 'lie', on.lie), h: c.endH, lie: on.lie };
      m.climbAt = NaN;
      facing = on.toward;
      exact = on.u >= EDGE;
    } else if (m.edge && m.spot && c.pose === 'lie') {
      // on it, as the sim has them: climbing up from the edge
      if (!Number.isFinite(m.climbAt)) m.climbAt = t;
      const a = (t - m.climbAt) / CLIMB[m.edge.lie];
      if (a < 1) {
        const got = climbPose(shown, m.edge, m.spot, a, false);
        m.x = shown.c.x;
        m.y = shown.c.y;
        h = got.h;
        facing = got.facing;
        exact = true;
      } else m.edge = undefined;
    }
  }
  if (lagging && !m.off) {
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

/**
 * Someone so far through climbing onto a spot from its edge, from 0 (standing at the edge) to 1 (lying there). Onto
 * their back: turn round at the edge, hop up to sit on it, then swing the legs up and lie back along it. Face down:
 * lean forward with the hands on it, climb up onto it on all fours, then stretch out along it. Getting off, it plays
 * backwards, but someone standing up off its edge stays facing away from it. How high they are and which way their
 * front faces.
 */
function climbPose(shown: Shown, e: Edge, spot: Spot, a: number, off: boolean): { h: number; facing: number } {
  const back = e.lie === 'back';
  /** Put them so far from the edge to the spot. */
  const at = (w: number) => {
    shown.c.x = lerp(e.x, spot.x, w);
    shown.c.y = lerp(e.y, spot.y, w);
  };
  if (back) {
    const SIT = 0.45;
    // sitting a little side on to the edge, already turning the way they will lie, so the thighs show
    const perch = turnBy(e.toward + Math.PI, e.face, 0.35);
    if (a < SIT) {
      // round with their back to it, and up onto the edge, sitting with the hips where they will lie, the hips
      // rising from where they are standing
      const seat = e.h + BACK_Y - SIT_Y - HIP * shown.c.look.scale;
      at(0.3 * smoothstep(a, 0.1, SIT));
      shown.c.pose = a < 0.12 ? 'stand' : 'sit';
      shown.lying = 0;
      const h = a < 0.12 ? 0 : lerp(-SIT_Y, seat, smoothstep(a, 0.12, 0.32));
      return { h, facing: off ? perch : turnBy(e.toward, perch, smoothstep(a, 0, 0.22)) };
    }
    // lying back from sitting, the legs swung up and round
    const w = smoothstep(a, SIT, 1);
    at(0.3 + 0.7 * w);
    shown.c.pose = 'lie';
    shown.lie = e.lie;
    shown.lying = w;
    shown.sat = 1;
    return { h: e.h, facing: turnBy(perch, e.face, smoothstep(a, SIT, 0.85)) };
  }
  shown.c.pose = 'lie';
  shown.lie = e.lie;
  if (a < 0.3) {
    // leaning over from the edge, the hands down on it
    const w = smoothstep(a, 0, 0.3);
    at(0.1 * w);
    shown.lying = 0.5 * w;
    shown.hands = w;
    return { h: 0, facing: e.toward };
  }
  if (a < 0.6) {
    // up onto it on all fours, a knee and then the other, the body level over the hands and knees
    const w = smoothstep(a, 0.3, 0.6);
    at(0.1 + 0.3 * w);
    shown.lying = 0.5 + 0.5 * w;
    shown.hands = 1;
    shown.fours = w;
    return { h: e.h * w, facing: e.toward };
  }
  // stretched out along it, the knees going back and the body down onto it, turning to lie the way it says
  const w = smoothstep(a, 0.6, 1);
  at(0.4 + 0.6 * w);
  shown.lying = 1;
  shown.hands = 1 - w;
  shown.fours = 1 - w;
  return { h: e.h, facing: turnBy(e.toward, e.face, w) };
}

/** The spot someone is lying or sitting at to be treated now, if they are. */
function spotOf(c: Char, lie: Lying | undefined): Spot | undefined {
  if (c.pose === 'lie' && lie)
    return {
      x: c.x,
      y: c.y,
      h: c.h,
      facing: c.facing,
      pose: 'lie',
      lie,
      served: c.kind === 'guest' && c.state === 'served',
    };
  if (c.kind === 'guest' && c.state === 'served' && c.pose === 'sit')
    return { x: c.x, y: c.y, h: c.h, facing: c.facing, pose: 'sit', lie: undefined, served: true };
  return undefined;
}

/** The edge of a spot they lay on, from the first point the sim walked them to off it. */
function edgeOf(s: Spot, from: { x: number; y: number }): Edge {
  return {
    x: lerp(from.x, s.x, EDGE),
    y: lerp(from.y, s.y, EDGE),
    toward: Math.atan2(s.x - from.x, s.y - from.y),
    face: frontOf(s.facing, 'lie', s.lie),
    h: s.h,
    lie: s.lie ?? 'prone',
  };
}

/** Whether someone is still at a spot, as they were put there. */
const atSpot = (c: Char, s: Spot) => c.pose === s.pose && Math.hypot(c.x - s.x, c.y - s.y) < 0.01;

/**
 * How far along the last step to a spot they lie on someone is, from the middle of the tile beside it (0) to the spot
 * (1), the way they came at it, and how they will lie there; or nothing, if they are not on that step.
 */
function climbOn(
  c: Char,
  lie: Lying,
): { u: number; toward: number; lie: Lying; ax: number; ay: number; sx: number; sy: number } | undefined {
  const last = c.path?.length === 1 ? c.path[0] : undefined;
  if (!last?.[2] || c.endPose !== 'lie' || !c.dest) return undefined;
  const ax = c.dest[0] + 0.5;
  const ay = c.dest[1] + 0.5;
  const span = Math.hypot(last[0] - ax, last[1] - ay);
  if (span < 0.05) return undefined;
  const u = 1 - Math.min(1, Math.hypot(last[0] - c.x, last[1] - c.y) / span);
  return { u, toward: Math.atan2(last[0] - ax, last[1] - ay), lie, ax, ay, sx: last[0], sy: last[1] };
}

/**
 * Note where the sim has walked someone held back, and once they are free to, walk them on after it so far, until they
 * are back where it has them.
 */
function follow(m: Motion, c: Char, free: boolean, go: number) {
  const tail = m.trail.at(-1);
  if (!tail || Math.hypot(c.x - tail.x, c.y - tail.y) > 0.01) m.trail.push({ x: c.x, y: c.y });
  if (!free) return;
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
