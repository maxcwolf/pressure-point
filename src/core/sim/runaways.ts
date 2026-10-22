// A really bad trip: now and then a guest whose ceremony failed runs round the institute, stopping here and there to
// freak out, and freaks out the guests they pass: a bad feeling, a little lost patience, and in a stress outbreak, the
// stress. It goes on until a member of staff the player sends calms them down, or they find the door.

import {
  CALM_SECONDS,
  FREAK_PATIENCE,
  FREAK_RANGE,
  FREAK_STRESS,
  RUNAWAY_CHANCE,
  RUNAWAY_PAUSE,
  RUNAWAY_SECONDS,
  traitSpeed,
  XP_PER_JOB,
} from '../data';
import { pick, random, stream } from '../random';
import type { Guest, Staff } from '../state/types';
import { gainXp } from './careers';
import { guestById, say } from './chars';
import { release } from './claims';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { feel } from './feelings';
import { decide, leave } from './guests';
import { goTo, halt } from './movement';
import { catchable } from './outbreaks';
import { within } from './souls';
import { staffIdle } from './staffing';
import { removeFromStations } from './stations';

/** Whether a guest is running round on a really bad trip. */
export const running = (g: Guest) => g.state === 'running';

/**
 * A guest whose ceremony failed may have a really bad trip: a small chance, rolled as it fails. The roll is drawn
 * aside from the game's own stream, from where the stream stands and who the guest is, so a game in which nobody runs
 * plays out exactly as it did before there were runaways.
 */
export function rollRunaway(ctx: SimContext, g: Guest) {
  if (random(stream(ctx.s.rng ^ Math.imul(g.id, 0x9e3779b9))) < RUNAWAY_CHANCE) g.runaway = RUNAWAY_SECONDS;
}

/** Set a guest on a really bad trip running round the institute, and tell the player who it is. */
export function startRunning(ctx: SimContext, g: Guest) {
  release(ctx, g);
  removeFromStations(ctx, g);
  halt(g);
  g.state = 'running';
  g.timer = 0;
  say(g, 'bubble-stressed', RUNAWAY_PAUSE);
  toast(
    ctx,
    `${g.name} is having a really bad trip, and is running round freaking everyone out. Select them and calm them down.`,
    'bad',
    { kind: 'guest', id: g.id },
    'feeling-bad-trip',
  );
  emit(ctx, { type: 'sfx', name: 'error' });
}

/** Somewhere else to run to: a spot out in the corridors, well away from where they are if there is one. */
function runOn(ctx: SimContext, g: Guest): boolean {
  // from inside a room, the way out is through its door
  const room = ctx.world.roomAt(g.tx, g.ty);
  const [fx, fy] = room ? [room.door.x + room.door.dx, room.door.y + room.door.dy] : [g.tx, g.ty];
  const spots = ctx.world.standSpots(fx, fy, 160);
  const far = spots.filter(([x, y]) => Math.hypot(x - g.tx, y - g.ty) >= 5);
  const options = far.length ? far : spots;
  if (!options.length) return false;
  const [x, y] = pick(ctx.s, options);
  return goTo(ctx, g, x, y);
}

/** Freak out whoever they come close to, each once: a bad feeling, some patience, and maybe the outbreak's stress. */
function freakOut(ctx: SimContext, g: Guest) {
  for (const o of ctx.s.guests) {
    if (o === g || running(o) || o.state === 'leaving' || o.feelings.includes('freaked')) continue;
    if (Math.hypot(o.x - g.x, o.y - g.y) > FREAK_RANGE) continue;
    feel(o, 'freaked');
    o.patience = Math.max(0, o.patience - FREAK_PATIENCE);
    say(o, 'bubble-sweaty', 2);
    if (ctx.s.outbreak && catchable(o) && random(ctx.s) < FREAK_STRESS) o.stressed = true;
  }
}

/** The member of staff sent to calm a runner down, if one has been. */
export const calmerOf = (ctx: SimContext, g: Guest): Staff | undefined =>
  ctx.s.staff.find((st) => st.job?.kind === 'calm' && st.job.id === g.id);

/** Whether a runner is being talked down this moment, and so stands still for it. */
const beingCalmed = (ctx: SimContext, g: Guest) => calmerOf(ctx, g)?.state === 'doingJob';

/** A guest on a really bad trip goes on for a step: running, freaking out where they stop, and at last the door. */
export function runStep(ctx: SimContext, g: Guest, dt: number, arrived: boolean) {
  if (beingCalmed(ctx, g)) return;
  g.runaway = (g.runaway ?? 0) - dt;
  freakOut(ctx, g);
  if (g.runaway <= 0) {
    foundDoor(ctx, g);
    return;
  }
  if (arrived) {
    g.timer = RUNAWAY_PAUSE;
    say(g, 'bubble-stressed', RUNAWAY_PAUSE);
  }
  if (g.path) return;
  g.timer -= dt;
  if (g.timer > 0) return;
  // nowhere to run to: freak out here a while longer
  if (!runOn(ctx, g)) g.timer = RUNAWAY_PAUSE;
}

/** They find the door at last, still on their trip, and go home. */
function foundDoor(ctx: SimContext, g: Guest) {
  toast(ctx, `${g.name} found the door, and has gone home still tripping.`, 'bad', undefined, 'feeling-bad-trip');
  leave(ctx, g);
}

/** Whether a member of staff is free to be sent: here, and not busy with a guest, a soul, a ward or another runner. */
function free(ctx: SimContext, st: Staff): boolean {
  if (st.busy || st.call || st.training) return false;
  if (st.job?.kind === 'soul' || st.job?.kind === 'ward' || st.job?.kind === 'calm') return false;
  if (st.state === 'atPost') return !ctx.world.item(st.post)?.serving;
  return st.state === 'idle' || st.state === 'wander' || st.state === 'toPost' || st.state === 'toJob';
}

/** The nearest member of staff who could be sent to calm a runner down, if any. */
export function calmerFor(ctx: SimContext, g: Guest): Staff | undefined {
  return ctx.s.staff
    .filter((st) => free(ctx, st))
    .sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
}

/** Whether someone can be sent to calm a guest down: they are running, nobody is on the way, and someone is free. */
export function canCalm(ctx: SimContext, g: Guest): boolean {
  return running(g) && !calmerOf(ctx, g) && !!calmerFor(ctx, g);
}

/** Head for a tile beside a runner. False if there is no way to them. */
function chase(ctx: SimContext, st: Staff, g: Guest): boolean {
  for (const [dx, dy] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const)
    if (ctx.world.walkable(g.tx + dx, g.ty + dy) && goTo(ctx, st, g.tx + dx, g.ty + dy)) return true;
  return goTo(ctx, st, g.tx, g.ty);
}

/** Send the nearest free member of staff to calm a runner down. False if nobody can go, or nobody can reach them. */
export function sendToCalm(ctx: SimContext, guestId: number): boolean {
  const g = guestById(ctx, guestId);
  if (!g || !canCalm(ctx, g)) return false;
  const st = calmerFor(ctx, g);
  if (!st) return false;
  staffIdle(ctx, st);
  if (!chase(ctx, st, g)) return false;
  st.job = { kind: 'calm', id: g.id };
  st.state = 'toJob';
  say(st, 'bubble-relieved', 2);
  toast(ctx, `${st.name} is on the way to calm ${g.name} down.`, 'info', { kind: 'staff', id: st.id });
  return true;
}

/**
 * A member of staff sent to a runner follows them, and once close enough starts talking them down, facing them. False
 * if the job is over: the runner calmed, gone, or out of reach.
 */
export function followRunner(ctx: SimContext, st: Staff, arrived: boolean): boolean {
  const g = st.job?.kind === 'calm' ? guestById(ctx, st.job.id) : undefined;
  if (!g || !running(g)) return false;
  if (within(st, g)) {
    halt(st);
    halt(g);
    st.state = 'doingJob';
    st.busy = true;
    st.timer = CALM_SECONDS / traitSpeed(st.traits);
    st.facing = Math.atan2(g.x - st.x, g.y - st.y);
    g.facing = Math.atan2(st.x - g.x, st.y - g.y);
    return true;
  }
  // they have run on from where they were headed: head for where they are now
  const [dx, dy] = st.dest ?? [st.tx, st.ty];
  if (arrived || !st.path || Math.hypot(dx - g.tx, dy - g.ty) > 2) return chase(ctx, st, g);
  return true;
}

/** Talking a runner down goes on for a step. True when it is over: done, or the runner gone. */
export function calmStep(ctx: SimContext, st: Staff, dt: number): boolean {
  const g = st.job?.kind === 'calm' ? guestById(ctx, st.job.id) : undefined;
  if (!g || !running(g)) return true;
  st.facing = Math.atan2(g.x - st.x, g.y - st.y);
  st.timer -= dt;
  if (st.timer > 0) return false;
  calmedDown(ctx, st, g);
  return true;
}

/** A runner talked down: grateful for it, and on their way again, calmly. */
function calmedDown(ctx: SimContext, st: Staff, g: Guest) {
  delete g.runaway;
  feel(g, 'calmed');
  say(g, 'bubble-relieved', 4);
  st.yearServed++;
  gainXp(ctx, st, XP_PER_JOB);
  emit(ctx, { type: 'float', text: 'Calmed', x: g.x, y: g.y, kind: 'good' });
  emit(ctx, { type: 'sfx', name: 'heal' });
  decide(ctx, g);
}
