// Staff: hiring and firing, pay and morale, breaks and finding work to do.

import {
  BOOKCASE_MAX,
  BOOKCASE_SPEEDUP,
  COFFEE_BREAK_BOOST,
  DIRT_CLEAN,
  DIRT_FILTHY,
  ITEMS,
  POOL_TABLE_MORALE,
  ROLES,
  traitOf,
  WEAR_REPAIR,
} from '../data';
import { money } from '../format';
import { fairSalary, makeCandidate } from '../people';
import { pick, random } from '../random';
import type { Item, Job, Staff } from '../state/types';
import { clamp, must } from '../util';
import { accessPose, accessTile, footprint } from '../world';
import { prestige } from './ambience';
import { sameRoomCount } from './building';
import { guestById, lobbyTile, say, staffById, streetTile } from './chars';
import { newChar } from './chars';
import { accessIndex, claim, findAccess, release } from './claims';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit, tipOnce, toast } from './events';
import { resetGuest } from './guests';
import { goTo, halt, moveAlong } from './movement';
import { hasItem } from './progress';
import { graduate } from './training';
import { deliveryProblem, modalityOf } from './treatments';

/** The four tiles beside a tile, for standing next to something. */
const BESIDE: readonly (readonly [dx: number, dy: number])[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];

/** Take on an applicant and send them in from the street. */
export function hire(ctx: SimContext, candidateId: number): Staff | null {
  const s = ctx.s;
  const c = s.candidates.find((x) => x.id === candidateId);
  if (!c) return null;
  const [x, y] = streetTile();
  const st: Staff = {
    ...newChar(ctx, c.name, c.look, x, y),
    kind: 'staff',
    role: c.role,
    skill: c.skill,
    salary: c.salary,
    traits: c.traits,
    energy: 100,
    state: 'arriving',
    post: 0,
    job: null,
    served: 0,
    quals: [...c.quals],
    training: null,
    strain: 1,
    morale: 75,
    raiseAsked: false,
    unhappyT: 0,
  };
  const [lx, ly] = lobbyTile();
  if (!goTo(ctx, st, lx, ly)) return null;
  s.staff.push(st);
  s.candidates = s.candidates.filter((x) => x !== c);
  s.candidates.push(makeCandidate(s, c.role));
  emit(ctx, { type: 'sfx', name: 'hire' });
  toast(ctx, `${c.name} joins as a ${ROLES[c.role].name}.`, 'good');
  return st;
}

/** Send a member of staff home for good, either fired or because they quit. */
export function fire(ctx: SimContext, id: number, quit = false) {
  const st = staffById(ctx, id);
  if (!st || st.state === 'leaving') return;
  staffIdle(ctx, st);
  st.state = 'leaving';
  st.raiseAsked = false;
  say(st, quit ? '😠' : '📦', 6);
  const [x, y] = streetTile();
  if (!goTo(ctx, st, x, y)) ctx.s.staff = ctx.s.staff.filter((q) => q !== st);
  if (quit) {
    changeRep(ctx, -2);
    toast(ctx, `${st.name} has quit. Unhappy staff do not stay.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'fail' });
  } else toast(ctx, `${st.name} has been let go.`, 'info');
}

/** What this member of staff could reasonably expect to be paid. */
export function fairPay(st: Staff): number {
  return fairSalary(st.role, st.skill, st.traits, st.quals);
}

/** The salary a raise would take them to: the going rate, or 10% more if they already earn it. */
export function raiseTo(st: Staff): number {
  return Math.max(fairPay(st), Math.round((st.salary * 1.1) / 10) * 10);
}

/** Give a member of staff the raise they are due, which lifts their morale. */
export function giveRaise(ctx: SimContext, id: number) {
  const st = staffById(ctx, id);
  if (!st || st.state === 'leaving') return;
  st.salary = raiseTo(st);
  st.morale = Math.min(100, st.morale + 22);
  st.raiseAsked = false;
  st.unhappyT = 0;
  say(st, '😊', 4);
  emit(ctx, { type: 'sfx', name: 'cash' });
}

/** How much faster than usual a member of staff on a break gets their energy back: quicker with an Espresso Machine in the room. */
export function breakBoost(ctx: SimContext, st: Staff): number {
  const seat = ctx.world.item(st.claimItem);
  return seat && sameRoomCount(ctx, seat, 'coffee_machine') > 0 ? COFFEE_BREAK_BOOST : 1;
}

/** How much faster than usual someone's course is going: quicker with bookcases in the Training Room. */
export function courseSpeed(ctx: SimContext, st: Staff): number {
  const desk = ctx.world.item(st.claimItem);
  return trainingSpeed(desk ? sameRoomCount(ctx, desk, 'bookcase') : 0);
}

/** How much faster a course goes with this many bookcases in its room. Only the first few count. */
export function trainingSpeed(bookcases: number): number {
  return 1 + BOOKCASE_SPEEDUP * Math.min(BOOKCASE_MAX, bookcases);
}

/** The morale a member of staff drifts toward: set by their pay, energy, workplace and the state of the center. */
export function moraleTarget(ctx: SimContext, st: Staff): number {
  let target = 62 + clamp((st.salary / fairPay(st) - 1) * 90, -45, 20);
  if (st.energy < 20) target -= 18;
  const post = ctx.world.item(st.post);
  const room = post && st.state === 'atPost' ? ctx.world.roomOfItem(post) : undefined;
  if (room) target += (prestige(ctx, room) - 2) * 5;
  if (hasItem(ctx, 'pool_table')) target += POOL_TABLE_MORALE;
  if (ctx.s.litter.length > 6) target -= 6;
  return target;
}

/** Drift morale toward what pay and conditions deserve; the unhappy ask for a raise, then quit. */
function updateMorale(ctx: SimContext, st: Staff, dt: number) {
  if (st.state === 'leaving' || st.state === 'arriving') return;
  const fair = fairPay(st);
  const target = moraleTarget(ctx, st);
  st.morale = clamp(st.morale + (target - st.morale) * Math.min(1, dt * 0.03), 0, 100);

  if (!st.raiseAsked && st.salary < fair * 0.97 && st.morale < 56) {
    st.raiseAsked = true;
    say(st, '💰', 5);
    toast(ctx, `${st.name} thinks they are worth ${money(fair)} a month and wants a raise.`, 'info');
  }
  const before = st.unhappyT;
  if (st.morale < 25) st.unhappyT += dt;
  else st.unhappyT = Math.max(0, st.unhappyT - dt);
  if (before < 20 && st.unhappyT >= 20) {
    say(st, '😠', 6);
    toast(ctx, `${st.name} is miserable and thinking of quitting.`, 'bad');
  }
  if (st.unhappyT > 60 && !st.busy && !st.training) fire(ctx, st.id, true);
}

/** Step away from the station they were staffing. */
function leavePost(ctx: SimContext, st: Staff) {
  const it = ctx.world.item(st.post);
  if (it?.staffId === st.id) {
    it.staffId = 0;
    // whoever they had called or were seeing goes back to the line, rather than wait on the table for nobody
    const g = guestById(ctx, it.serving);
    if (g) resetGuest(ctx, g);
  }
  st.post = 0;
  st.busy = false;
}

/** Give up the cleaning, watering or repair job they had claimed. */
function dropJob(ctx: SimContext, st: Staff) {
  const job = st.job;
  if (!job) return;
  const claimed = job.kind === 'litter' ? ctx.s.litter.find((x) => x.id === job.id) : ctx.world.item(job.id);
  if (claimed?.claimedBy === st.id) claimed.claimedBy = 0;
  st.job = null;
}

/** Drop whatever a member of staff is doing and leave them free for new work. */
export function staffIdle(ctx: SimContext, st: Staff) {
  if (st.training) {
    // interrupted before finishing: the course fee comes back
    ctx.s.money += st.training.cost;
    ctx.s.ledger.training -= st.training.cost;
    st.training = null;
  }
  leavePost(ctx, st);
  release(ctx, st);
  dropJob(ctx, st);
  halt(st);
  st.state = 'idle';
  st.timer = 0.2;
}

/** Head for a free rest spot, if there is one. */
function tryBreak(ctx: SimContext, st: Staff): boolean {
  const sofa = findAccess(ctx, 'rest', st.tx, st.ty);
  if (!sofa) return false;
  leavePost(ctx, st);
  dropJob(ctx, st);
  claim(ctx, st, sofa.item, sofa.idx);
  const [x, y] = accessTile(sofa.item, sofa.idx);
  if (!goTo(ctx, st, x, y, accessPose(sofa.item, sofa.idx))) {
    release(ctx, st);
    return false;
  }
  st.state = 'toBreak';
  say(st, '😴');
  return true;
}

/** How long a Janitor takes over a chore. */
export function jobSeconds(kind: Job['kind'] | undefined): number {
  if (kind === 'repair') return 3.2;
  if (kind === 'clean') return 2.4;
  return 1.6;
}

/** Find something to do: a break if tired, then a job or a station to staff, or else a wander. */
function findWork(ctx: SimContext, st: Staff) {
  if (st.energy < 18 && tryBreak(ctx, st)) return;
  const s = ctx.s;
  if (st.role === 'caretaker') {
    // broken equipment first, then litter and filthy toilets, then routine cleaning, watering and servicing
    interface Task {
      kind: Job['kind'];
      id: number;
      x: number;
      y: number;
      urgency: number;
    }
    const tasks: Task[] = [];
    for (const l of s.litter) if (!l.claimedBy) tasks.push({ kind: 'litter', id: l.id, x: l.x, y: l.y, urgency: 1 });
    for (const p of s.items) {
      if (p.claimedBy) continue;
      if (p.wear >= WEAR_REPAIR)
        tasks.push({ kind: 'repair', id: p.id, x: p.x, y: p.y, urgency: p.wear >= 100 ? 2 : 0 });
      else if (p.dirt >= DIRT_CLEAN)
        tasks.push({ kind: 'clean', id: p.id, x: p.x, y: p.y, urgency: p.dirt >= DIRT_FILTHY ? 1 : 0 });
      else if ((p.type === 'plant' && p.water <= 40) || (p.type === 'stone_warmer' && p.water <= 55))
        tasks.push({ kind: 'water', id: p.id, x: p.x, y: p.y, urgency: 0 });
    }
    /** How far a task is from this member of staff. */
    const dist = (t: Task) => Math.hypot(t.x - st.tx, t.y - st.ty);
    tasks.sort((a, b) => b.urgency - a.urgency || dist(a) - dist(b));
    for (const task of tasks.slice(0, 4)) {
      let ok = false;
      if (task.kind === 'litter') ok = goTo(ctx, st, task.x, task.y);
      else {
        // stand next to the item, on whichever side can be reached
        const item = must(ctx.world.item(task.id), 'item to tend');
        search: for (const [fx, fy] of footprint(item)) {
          for (const [dx, dy] of BESIDE) {
            if (ctx.world.walkable(fx + dx, fy + dy) && goTo(ctx, st, fx + dx, fy + dy)) {
              ok = true;
              break search;
            }
          }
        }
      }
      if (!ok) continue;
      st.job = { kind: task.kind, id: task.id };
      const target = task.kind === 'litter' ? s.litter.find((l) => l.id === task.id) : ctx.world.item(task.id);
      if (target) target.claimedBy = st.id;
      st.state = 'toJob';
      return;
    }
  } else {
    let best: Item | null = null;
    let bestScore = -1e9;
    for (const it of s.items) {
      const def = ITEMS[it.type].station;
      if (def?.staff !== st.role || it.staffId || !ctx.world.usable(it)) continue;
      let score = it.queue.length * 10 - Math.hypot(it.x - st.tx, it.y - st.ty);
      if (def.goal === 'treat') {
        for (const id of it.queue) {
          const q = guestById(ctx, id);
          if (q && !deliveryProblem(ctx, it, st, modalityOf(q))) score += 8;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }
    if (best) {
      const ai = accessIndex(best, 'staff');
      const [x, y] = accessTile(best, ai);
      if (goTo(ctx, st, x, y, accessPose(best, ai))) {
        best.staffId = st.id;
        st.post = best.id;
        st.state = 'toPost';
        return;
      }
    }
  }
  // nothing to do: amble about
  if (st.state === 'idle' && random() < 0.25) {
    const spots = ctx.world.standSpots(st.tx, st.ty, 40);
    if (spots.length) {
      const [x, y] = pick(spots);
      if (goTo(ctx, st, x, y)) st.state = 'wander';
    }
  }
}

/** Move one member of staff forward in time: walking, morale, energy and what they do next. */
export function updateStaff(ctx: SimContext, st: Staff, dt: number) {
  if (st.bubbleT > 0) st.bubbleT -= dt;
  let walk = 2.3;
  let stamina = 1;
  for (const t of st.traits) {
    walk *= traitOf(t).walk ?? 1;
    stamina *= traitOf(t).stamina ?? 1;
  }
  if (st.energy < 15) walk *= 0.75;
  const arrived = moveAlong(st, dt, walk);
  // someone who quits this very step has only just set off for the door
  const wasLeaving = st.state === 'leaving';

  updateMorale(ctx, st, dt);
  if (st.state === 'leaving' && !ctx.s.staff.includes(st)) return;
  if (st.state === 'onBreak') st.energy = Math.min(100, st.energy + dt * 9 * breakBoost(ctx, st));
  else if (st.state !== 'leaving' && st.state !== 'training') {
    const rate = st.busy ? 0.42 * (st.strain || 1) : st.state === 'atPost' ? 0.14 : 0.2;
    st.energy = Math.max(0, st.energy - rate * stamina * dt);
  }

  switch (st.state) {
    case 'arriving':
      if (arrived || !st.path) {
        st.state = 'idle';
        st.timer = 0;
      }
      break;
    case 'idle':
    case 'wander':
      if (st.state === 'wander' && (arrived || !st.path)) st.state = 'idle';
      st.timer -= dt;
      if (st.timer <= 0) {
        st.timer = 0.7;
        findWork(ctx, st);
      }
      break;
    case 'toPost': {
      const it = ctx.world.item(st.post);
      if (it?.staffId !== st.id) staffIdle(ctx, st);
      else if (arrived) st.state = 'atPost';
      else if (!st.path) staffIdle(ctx, st);
      break;
    }
    case 'atPost': {
      const it = ctx.world.item(st.post);
      if (it?.staffId !== st.id || !ctx.world.usable(it)) staffIdle(ctx, st);
      else if (st.energy < 18 && !it.serving) {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.timer = 2;
          if (!tryBreak(ctx, st))
            tipOnce(
              ctx,
              'tired',
              'Tired staff members work slowly and botch treatments. Build a Staff Room so they can rest.',
              'bad',
            );
        }
      }
      break;
    }
    case 'toBreak':
      if (arrived) st.state = 'onBreak';
      else if (!st.path) staffIdle(ctx, st);
      break;
    case 'onBreak':
      if (st.energy >= 100 || !st.claimItem) staffIdle(ctx, st);
      break;
    case 'toJob':
      if (arrived) {
        st.state = 'doingJob';
        st.timer = jobSeconds(st.job?.kind);
        st.busy = true;
        if (st.job && st.job.kind !== 'litter') {
          const p = ctx.world.item(st.job.id);
          if (p) st.facing = Math.atan2(p.x + 0.5 - st.x, p.y + 0.5 - st.y);
        }
      } else if (!st.path) staffIdle(ctx, st);
      break;
    case 'doingJob':
      st.timer -= dt;
      if (st.timer <= 0) {
        const job = st.job;
        if (job?.kind === 'litter') ctx.s.litter = ctx.s.litter.filter((l) => l.id !== job.id);
        else if (job) {
          const p = ctx.world.item(job.id);
          if (p) {
            if (job.kind === 'repair') p.wear = 0;
            else if (job.kind === 'clean') p.dirt = 0;
            else p.water = 100;
            p.claimedBy = 0;
            if (job.kind === 'repair') ctx.world.version++;
          }
        }
        st.job = null;
        staffIdle(ctx, st);
      }
      break;
    case 'toTrain':
      if (arrived) st.state = 'training';
      else if (!st.path) staffIdle(ctx, st);
      break;
    case 'training': {
      const t = st.training;
      if (!t || !st.claimItem) {
        staffIdle(ctx, st);
        break;
      }
      t.progress += (dt / t.seconds) * courseSpeed(ctx, st);
      if (t.progress >= 1) graduate(ctx, st);
      break;
    }
    case 'leaving':
      if ((arrived && wasLeaving) || !st.path) ctx.s.staff = ctx.s.staff.filter((x) => x !== st);
      break;
  }
}
