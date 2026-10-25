// Staff: hiring and firing, pay and morale, breaks and finding work to do.

import {
  BOOKCASE_MAX,
  BOOKCASE_SPEEDUP,
  BREAK_REST,
  COFFEE_BREAK_BOOST,
  DAY_SECONDS,
  DIRT_CLEAN,
  DIRT_FILTHY,
  DISCOMFORT_MORALE,
  INSTALL_SECONDS,
  isWatered,
  ITEMS,
  LAUNDER_SECONDS,
  MAINTENANCE_SPEED,
  MISERABLE_MORALE,
  MOTIVATION_SPEED,
  POOL_TABLE_MORALE,
  PROMOTION_SULK,
  QUIT_AFTER,
  QUIT_THINKING,
  QUIT_WARNING,
  RED_MONTH_MORALE,
  RED_MORALE,
  RIVAL_NAME,
  ROLES,
  STAFF_NEED_MORALE,
  STAMINA_DRAIN,
  traitOf,
  traitSpeed,
  VIBES_MORALE,
  WEAR_REPAIR,
  XP_PER_JOB,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { fairSalary, scalePay } from '../people';
import { pick, random } from '../random';
import { staffStart } from '../state/game';
import type { Item, Job, Staff } from '../state/types';
import { clamp, must } from '../util';
import { accessPose, accessTile, footprint } from '../world';
import { prestige } from './ambience';
import { worksAt } from './assignments';
import { sameRoomCount } from './building';
import { leaveForCall, returnFromCall } from './calls';
import { CHEER_MORALE, cheeredUp, gainXp, hasGeneral, jobDuty, onDuty, stationDuty } from './careers';
import { bless, clearingSeconds } from './ceremonies';
import { guestById, lobbyTile, say, staffById, streetTile } from './chars';
import { newChar } from './chars';
import { accessIndex, claim, findAccess, release } from './claims';
import { backForClass, isClassLead, restDue } from './classes';
import type { SimContext } from './context';
import { changeRep, longInRed, payOff, recoup } from './economy';
import { emit, staffRequest, tipOnce, toast } from './events';
import { resetGuest } from './guests';
import { changeLinens, hamperFull, hamperWithRoom, hasLinens, launder, wantsLaundering } from './linens';
import { startWard, wardStep, wardWanted } from './mishaps';
import { goTo, halt, moveAlong } from './movement';
import { hasItem } from './progress';
import { calmStep, followRunner } from './runaways';
import { isLeadStation, matsOf, sessionState } from './sessions';
import { burntOut, reachSoul, soulStep, soulToRetrieve, startSoul } from './souls';
import type { BreakRoom } from './staff-needs';
import { fedUp, goRefresh, growNeeds, refreshed, refreshSeconds, wants, wantsRefresh } from './staff-needs';
import { graduate } from './training';
import { deliveryProblem, modalityOf } from './treatments';
import { installUpgrade } from './upgrades';
import { clearVibes, roomToSmudge, smudgeSeconds, smudging, startSmudge, wander } from './vibes';
import { clockBreak, posterMorale } from './wall-items';
import { discomfort, warmthAt } from './warmth';

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
  const [x, y] = streetTile(s, ctx.world.building, ctx.world.w);
  const st: Staff = {
    ...newChar(ctx, c.name, c.look, x, y),
    kind: 'staff',
    role: c.role,
    skill: c.skill,
    salary: c.salary,
    paidTo: s.day,
    traits: c.traits,
    energy: 100,
    state: 'arriving',
    post: 0,
    job: null,
    served: 0,
    quals: [...c.quals],
    ...staffStart(c.skill),
  };
  const [lx, ly] = lobbyTile(s, ctx.world.building);
  if (!goTo(ctx, st, lx, ly)) return null;
  s.staff.push(st);
  // their place in the pool fills again as new applicants turn up
  s.candidates = s.candidates.filter((x) => x !== c);
  emit(ctx, { type: 'sfx', name: 'hire' });
  toast(ctx, `${c.name} joins as a ${ROLES[c.role].name}.`, 'good', { kind: 'staff', id: st.id });
  return st;
}

/** Send a member of staff home for good, either fired or because they quit. */
export function fire(ctx: SimContext, id: number, how: 'fired' | 'quit' | 'poached' = 'fired') {
  const st = staffById(ctx, id);
  if (!st || st.state === 'leaving') return;
  staffIdle(ctx, st);
  // they are paid for the days they worked, and no more
  payOff(ctx, st);
  st.state = 'leaving';
  st.raiseAsked = false;
  st.offer = 0;
  say(st, how === 'fired' ? 'bubble-fired' : 'bubble-angry', 6);
  const [x, y] = streetTile(ctx.s, ctx.world.building, ctx.world.w);
  if (!goTo(ctx, st, x, y)) ctx.s.staff = ctx.s.staff.filter((q) => q !== st);
  if (how === 'fired') {
    toast(ctx, `${st.name} has been let go.`, 'info');
    return;
  }
  ctx.s.stats.lastQuit = ctx.s.day;
  changeRep(ctx, -2);
  const text =
    how === 'quit'
      ? `${st.name} has quit. Unhappy staff do not stay.`
      : `${st.name} has left to work at ${RIVAL_NAME}. Unhappy staff do not stay.`;
  toast(ctx, text, 'bad', { kind: 'staff', id: st.id });
  emit(ctx, { type: 'sfx', name: 'fail' });
}

/** What this member of staff could reasonably expect to be paid, with salaries scaled as the game's difficulty sets. */
export function fairPay(st: Staff, scale = 1): number {
  return scalePay(fairSalary(st.role, st.skill, st.traits, st.quals, st.general.length), scale);
}

/** The salary a raise would take them to: the going rate, or 10% more if they already earn it. */
export function raiseTo(st: Staff, scale = 1): number {
  return Math.max(fairPay(st, scale), Math.round((st.salary * 1.1) / 10) * 10);
}

/** Give a member of staff the raise they are due, which lifts their morale. */
export function giveRaise(ctx: SimContext, id: number) {
  const st = staffById(ctx, id);
  if (!st || st.state === 'leaving') return;
  st.salary = raiseTo(st, tuning(ctx.s, 'salaries'));
  st.morale = Math.min(100, st.morale + 22);
  st.raiseAsked = false;
  st.unhappyT = 0;
  say(st, 'bubble-happy', 4);
  emit(ctx, { type: 'sfx', name: 'cash' });
}

/** How much faster than usual a member of staff on a break gets their energy back: quicker with an Espresso Machine or a Wall Clock in the room. */
export function breakBoost(ctx: SimContext, st: Staff): number {
  const seat = ctx.world.item(st.claimItem);
  const coffee = seat && sameRoomCount(ctx, seat, 'coffee_machine') > 0 ? COFFEE_BREAK_BOOST : 1;
  return coffee * clockBreak(ctx, st);
}

/** What the Staff Room someone is on a break in offers them to eat and drink. */
function breakRoom(ctx: SimContext, st: Staff): BreakRoom {
  const seat = st.state === 'onBreak' ? ctx.world.item(st.claimItem) : undefined;
  if (!seat) return { espresso: false, fridge: false };
  return {
    espresso: sameRoomCount(ctx, seat, 'coffee_machine') > 0,
    fridge: sameRoomCount(ctx, seat, 'staff_fridge') > 0,
  };
}

/** How much faster than usual someone's course is going: quicker with bookcases in the Training Room. */
export function courseSpeed(ctx: SimContext, st: Staff): number {
  const desk = ctx.world.item(st.claimItem);
  let learn = 1;
  for (const t of st.traits) learn *= traitOf(t).learn ?? 1;
  return trainingSpeed(desk ? sameRoomCount(ctx, desk, 'bookcase') : 0) * learn;
}

/** How much faster a course goes with this many bookcases in its room. Only the first few count. */
export function trainingSpeed(bookcases: number): number {
  return 1 + BOOKCASE_SPEEDUP * Math.min(BOOKCASE_MAX, bookcases);
}

/** The morale a member of staff drifts toward: set by their pay, energy, workplace and the state of the center. */
export function moraleTarget(ctx: SimContext, st: Staff): number {
  let target = 62 + clamp((st.salary / fairPay(st, tuning(ctx.s, 'salaries')) - 1) * 90, -45, 20);
  if (st.energy < 20) target -= 18;
  const post = ctx.world.item(st.post);
  const room = post && st.state === 'atPost' ? ctx.world.roomOfItem(post) : undefined;
  if (room) target += (prestige(ctx, room) - 2) * 5;
  if (room && room.vibes > 0) target -= VIBES_MORALE;
  target -= discomfort(warmthAt(ctx, st.tx, st.ty)) * DISCOMFORT_MORALE;
  if (fedUp(st)) target -= STAFF_NEED_MORALE;
  if (hasItem(ctx, 'pool_table')) target += POOL_TABLE_MORALE;
  target += posterMorale(ctx);
  if (ctx.s.litter.length > 6) target -= 6;
  if (st.promotion) target -= PROMOTION_SULK;
  if (cheeredUp(ctx.s, st)) target += CHEER_MORALE;
  // with the bank in the red they worry about their wages, and more so once it has been there a month
  if (ctx.s.bankruptcyOn && ctx.s.money < 0) target -= longInRed(ctx.s) ? RED_MONTH_MORALE : RED_MORALE;
  return target;
}

/** Days until a miserable member of staff walks out, or null while they are not on course to quit. */
export function daysUntilQuit(st: Staff): number | null {
  if (st.state === 'leaving' || st.morale >= MISERABLE_MORALE || st.unhappyT <= 0) return null;
  return Math.max(0, (QUIT_AFTER - st.unhappyT) / DAY_SECONDS);
}

/** Whether someone will walk out within two days unless something changes. */
export function aboutToQuit(st: Staff): boolean {
  const days = daysUntilQuit(st);
  return days !== null && days * DAY_SECONDS <= QUIT_WARNING;
}

/** Drift morale toward what pay and conditions deserve; the unhappy ask for a raise, then quit. */
function updateMorale(ctx: SimContext, st: Staff, dt: number) {
  if (st.state === 'leaving' || st.state === 'arriving' || st.state === 'toCall' || st.state === 'away') return;
  const fair = fairPay(st, tuning(ctx.s, 'salaries'));
  const target = moraleTarget(ctx, st);
  st.morale = clamp(st.morale + (target - st.morale) * Math.min(1, dt * 0.03), 0, 100);
  // cheered up before a Shaman could come: there is no soul to retrieve, and they can be asked for again if need be
  if (st.soulAsked && !burntOut(st.morale)) st.soulAsked = false;

  // the underpaid ask for a raise once unhappy; after a month with the bank in the red, so does anyone unhappy, to stay
  const red = ctx.s.bankruptcyOn && ctx.s.money < 0 && longInRed(ctx.s);
  if (!st.raiseAsked && (st.salary < fair * 0.97 || red) && st.morale < 56) {
    st.raiseAsked = true;
    say(st, 'bubble-raise', 5);
    if (st.salary < fair * 0.97)
      staffRequest(
        ctx,
        st,
        'raise',
        `${st.name} thinks they are worth ${money(fair)} a month and wants a raise.`,
        'info',
      );
    else
      staffRequest(
        ctx,
        st,
        'raise',
        `${st.name} has watched the bank sit in the red for a month, and wants a raise to ${money(raiseTo(st, tuning(ctx.s, 'salaries')))} to stay.`,
        'bad',
      );
  }
  const before = st.unhappyT;
  if (st.morale < MISERABLE_MORALE) st.unhappyT += dt;
  else st.unhappyT = Math.max(0, st.unhappyT - dt);
  const about = { kind: 'staff', id: st.id } as const;
  if (before < QUIT_THINKING && st.unhappyT >= QUIT_THINKING) {
    say(st, 'bubble-angry', 6);
    toast(ctx, `${st.name} is miserable and thinking of quitting.`, 'bad', about);
  }
  const alarm = QUIT_AFTER - QUIT_WARNING;
  if (before < alarm && st.unhappyT >= alarm) {
    toast(ctx, `${st.name} will quit within two days. Give them a raise or a break, now.`, 'bad', about, 'ui-warning');
    emit(ctx, { type: 'sfx', name: 'error' });
  }
  if (st.unhappyT > QUIT_AFTER && !st.busy && !st.training) fire(ctx, st.id, 'quit');
}

/**
 * Whether a member of staff at their post has someone in hand they must see to before they go: a guest being seen, a
 * Qi Gong class under way, which ends for everyone together and is not to be left halfway, or a sound bath playing.
 */
function inHand(ctx: SimContext, it: Item): boolean {
  if (it.serving) return true;
  if (isClassLead(it)) return it.progress > 0;
  return isLeadStation(it) && sessionState(ctx, it).playing;
}

/**
 * Whether guests are waiting in a station's line to be called. At an Instructor's Mat they wait at the studio's
 * Practice Spots: in their lines, or on them for the class to begin.
 */
function lineWaiting(ctx: SimContext, it: Item): boolean {
  if (isClassLead(it)) return matsOf(ctx, it).some((m) => !!guestById(ctx, m.serving) || lineWaiting(ctx, m));
  return it.queue.some((id) => {
    const g = guestById(ctx, id);
    return g?.station === it.id && (g.state === 'waiting' || g.state === 'toWait');
  });
}

/**
 * Whether a member of staff at their post is wanted elsewhere, as soon as they have nobody in hand: kept from its duty
 * or outside their rooms, a priority room short of someone, bad vibes to clear, a soul to retrieve or a mishap to ward
 * off, or a drink or a snack to be had. With guests waiting in their line, they see to them first: bad vibes can wait
 * unless they are in this room, and a drink or a snack until they are close to fed up. Being sent elsewhere by the
 * player, and emergencies, cannot wait.
 */
function wantedElsewhere(ctx: SimContext, st: Staff, it: Item): boolean {
  const line = lineWaiting(ctx, it);
  const cloudy = roomToSmudge(ctx, st);
  return (
    !onDuty(st, stationDuty(it)) ||
    !worksAt(ctx, st, it.x, it.y) ||
    (!inPriorityRoom(ctx, it.x, it.y) && !!openPriorityPost(ctx, st)) ||
    (!!cloudy && (!line || cloudy === ctx.world.roomOfItem(it))) ||
    !!soulToRetrieve(ctx, st) ||
    wardWanted(ctx, st) ||
    wantsRefresh(ctx, st, line) ||
    (!line && lineElsewhere(ctx, st, it))
  );
}

/**
 * Whether someone at a machine with nobody waiting for it is wanted at a station of theirs with a line and nobody
 * posted: a machine's own guests are few, and the tables' line should not grow while they wait by it.
 */
function lineElsewhere(ctx: SimContext, st: Staff, it: Item): boolean {
  if (!ITEMS[it.type].machine) return false;
  return ctx.s.items.some((o) => {
    const def = ITEMS[o.type].station;
    return (
      o !== it &&
      def?.staff === st.role &&
      !def.group &&
      !o.staffId &&
      ctx.world.usable(o) &&
      worksAt(ctx, st, o.x, o.y) &&
      // a Sound Healer's line is at the mats their instrument plays for
      (def.goal === 'lead' ? matsOf(ctx, o).some((m) => lineWaiting(ctx, m)) : lineWaiting(ctx, o))
    );
  });
}

/**
 * Whether a member of staff at their post wants to be off once they have nobody in hand: wanted elsewhere, or due a
 * break with somewhere to take it. A Sound Healer who does calls nobody more to the mats.
 */
export function wantsAway(ctx: SimContext, st: Staff, it: Item): boolean {
  return wantedElsewhere(ctx, st, it) || (restDue(ctx, st) && !!findAccess(ctx, 'rest', st.tx, st.ty));
}

/** Step away from the station they were staffing. */
function leavePost(ctx: SimContext, st: Staff) {
  const it = ctx.world.item(st.post);
  if (it?.staffId === st.id) {
    it.staffId = 0;
    // whoever they had called or were seeing goes back to the line, rather than wait on the table for nobody
    const g = guestById(ctx, it.serving);
    if (g) resetGuest(ctx, g);
    // a class they were leading is called off, and can start again when someone is there to lead it
    if (isClassLead(it) && it.progress > 0) {
      it.progress = 0;
      const room = ctx.world.roomOfItem(it);
      if (room) delete room.lastClass;
    }
    // and at the bowls, so does everyone lying on the mats they played for
    if (isLeadStation(it))
      for (const m of matsOf(ctx, it)) {
        const lying = guestById(ctx, m.serving);
        if (lying) resetGuest(ctx, lying);
      }
  }
  st.post = 0;
  st.busy = false;
}

/** Give up the cleaning, watering or repair job they had claimed. */
function dropJob(ctx: SimContext, st: Staff) {
  const job = st.job;
  if (!job) return;
  const claimed =
    job.kind === 'litter'
      ? ctx.s.litter.find((x) => x.id === job.id)
      : job.kind === 'smudge'
        ? ctx.s.rooms.find((r) => r.id === job.id)
        : // a soul retrieval is for a member of staff, and a runner is calmed wherever they are: neither claims anything
          job.kind === 'soul' || job.kind === 'ward' || job.kind === 'calm'
          ? undefined
          : ctx.world.item(job.id);
  if (claimed?.claimedBy === st.id) claimed.claimedBy = 0;
  st.job = null;
}

/** Drop whatever a member of staff is doing and leave them free for new work. */
export function staffIdle(ctx: SimContext, st: Staff) {
  if (st.training) {
    // interrupted before finishing: the course fee comes back
    recoup(ctx, st.training.cost, 'training');
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
  // how long the walk there takes, as a guide to how long the walk back will
  st.timer = 0;
  say(st, 'bubble-break');
  return true;
}

/**
 * How much faster than usual a Caretaker gets through their jobs: quicker with Maintenance, and with Motivation, and
 * as their quirks make them.
 */
export function caretakerSpeed(st: Staff): number {
  return (
    (hasGeneral(st, 'maintenance') ? MAINTENANCE_SPEED : 1) *
    (hasGeneral(st, 'motivation') ? MOTIVATION_SPEED : 1) *
    traitSpeed(st.traits)
  );
}

/** How long a Caretaker takes over a chore. */
export function jobSeconds(kind: Job['kind'] | undefined): number {
  if (kind === 'repair') return 3.2;
  if (kind === 'install') return INSTALL_SECONDS;
  if (kind === 'clean') return 2.4;
  if (kind === 'launder') return LAUNDER_SECONDS;
  return 1.6;
}

/** Whether a tile is in a room the player has put first. */
export function inPriorityRoom(ctx: SimContext, x: number, y: number): boolean {
  return !!ctx.world.room(ctx.world.zoneAt(x, y))?.priority;
}

/** A station in a priority room that nobody is working and this member of staff could. */
export function openPriorityPost(ctx: SimContext, st: Staff): Item | undefined {
  if (!ctx.s.rooms.some((r) => r.priority)) return undefined;
  return ctx.s.items.find(
    (it) =>
      ITEMS[it.type].station?.staff === st.role &&
      !ITEMS[it.type].station?.group &&
      onDuty(st, stationDuty(it)) &&
      worksAt(ctx, st, it.x, it.y) &&
      !it.staffId &&
      ctx.world.usable(it) &&
      inPriorityRoom(ctx, it.x, it.y),
  );
}

/** Find something to do: a break if tired, then a job or a station to staff, or else a wander. */
function findWork(ctx: SimContext, st: Staff) {
  if (restDue(ctx, st) && tryBreak(ctx, st)) return;
  if (goRefresh(ctx, st)) return;
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
    // bad vibes first of all, for a Caretaker who knows how to clear them
    const cloudy = roomToSmudge(ctx, st);
    if (cloudy && startSmudge(ctx, st, cloudy)) return;
    /** Note a task, ahead of the same kind of thing elsewhere if it is in a priority room. */
    const add = (kind: Job['kind'], id: number, x: number, y: number, urgency: number) => {
      if (!onDuty(st, jobDuty(kind, kind === 'litter' ? undefined : ctx.world.item(id)))) return;
      if (!worksAt(ctx, st, x, y)) return;
      tasks.push({ kind, id, x, y, urgency: urgency + (inPriorityRoom(ctx, x, y) ? 0.5 : 0) });
    };
    // a flooded restroom is out of action until it is mopped out, as urgent as anything broken
    for (const l of s.litter) if (!l.claimedBy) add('litter', l.id, l.x, l.y, l.flood ? 2 : 1);
    for (const p of s.items) {
      if (p.claimedBy) continue;
      // a Mechanic installs an upgrade waiting on equipment, which services it too
      if (p.upgradePaid && hasGeneral(st, 'mechanics')) add('install', p.id, p.x, p.y, 1);
      else if (p.wear >= WEAR_REPAIR) add('repair', p.id, p.x, p.y, p.wear >= 100 ? 2 : 0);
      // linens can only be changed with a hamper to take fresh ones from and put the used ones in
      else if (p.dirt >= DIRT_CLEAN && (!hasLinens(p) || hamperWithRoom(ctx)))
        add('clean', p.id, p.x, p.y, p.dirt >= DIRT_FILTHY ? 1 : 0);
      else if (wantsLaundering(p)) add('launder', p.id, p.x, p.y, hamperFull(p) ? 1 : 0);
      else if ((isWatered(p.type) && p.water <= 40) || (p.type === 'stone_warmer' && p.water <= 55))
        add('water', p.id, p.x, p.y, 0);
    }
    /** How far a task is from this member of staff. */
    const dist = (t: Task) => Math.hypot(t.x - st.tx, t.y - st.ty);
    tasks.sort((a, b) => b.urgency - a.urgency || dist(a) - dist(b));
    for (const task of tasks.slice(0, 4)) {
      let ok = false;
      if (task.kind === 'litter') ok = goTo(ctx, st, task.x, task.y);
      else {
        // stand next to the item, on whichever side can be reached, and on the same side of the building's walls
        const item = must(ctx.world.item(task.id), 'item to tend');
        const indoors = ctx.world.inside(item.x, item.y);
        search: for (const [fx, fy] of footprint(item)) {
          for (const [dx, dy] of BESIDE) {
            const [bx, by] = [fx + dx, fy + dy];
            if (ctx.world.walkable(bx, by) && ctx.world.inside(bx, by) === indoors && goTo(ctx, st, bx, by)) {
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
    // a Reiki Practitioner or a Shaman clears bad vibes before taking up a post
    const cloudy = roomToSmudge(ctx, st);
    if (cloudy && startSmudge(ctx, st, cloudy)) return;
    // and a Shaman goes to anyone whose soul they have been asked to retrieve, and wards off a mishap if asked
    const lost = soulToRetrieve(ctx, st);
    if (lost && startSoul(ctx, st, lost)) return;
    if (wardWanted(ctx, st)) {
      startWard(st);
      return;
    }
    const posts: { it: Item; score: number }[] = [];
    for (const it of s.items) {
      const def = ITEMS[it.type].station;
      // a group station has nobody posted at it: it is worked from its room's lead station
      if (def?.staff !== st.role || def.group || it.staffId || !ctx.world.usable(it) || !onDuty(st, stationDuty(it)))
        continue;
      if (!worksAt(ctx, st, it.x, it.y)) continue;
      let score = it.queue.length * 10 - Math.hypot(it.x - st.tx, it.y - st.ty);
      // a lead station is as busy as the mats it serves
      if (def.goal === 'lead') for (const m of matsOf(ctx, it)) score += (m.queue.length + (m.serving ? 1 : 0)) * 10;
      if (inPriorityRoom(ctx, it.x, it.y)) score += 1000;
      if (def.goal === 'treat') {
        for (const id of it.queue) {
          const q = guestById(ctx, id);
          if (q && !deliveryProblem(ctx, it, st, modalityOf(q))) score += 8;
        }
      }
      posts.push({ it, score });
    }
    // the best post first, and one that cannot be reached is passed over for the next, as a job is
    posts.sort((a, b) => b.score - a.score);
    for (const { it } of posts.slice(0, 4)) {
      const ai = accessIndex(it, 'staff');
      const [x, y] = accessTile(it, ai);
      if (!goTo(ctx, st, x, y, accessPose(it, ai))) continue;
      it.staffId = st.id;
      st.post = it.id;
      st.state = 'toPost';
      return;
    }
  }
  // nothing to do: amble about, inside their own rooms if they have been assigned some
  if (st.state === 'idle' && random(s) < 0.25) {
    const own = st.rooms.map((id) => ctx.world.room(id)).filter((r) => r !== undefined);
    if (own.length) {
      if (wander(ctx, st, pick(s, own))) st.state = 'wander';
      return;
    }
    const spots = ctx.world.standSpots(st.tx, st.ty, 40);
    if (spots.length) {
      const [x, y] = pick(s, spots);
      if (goTo(ctx, st, x, y)) st.state = 'wander';
    }
  }
}

/** Walk the room wafting burning sage, until the bad vibes are gone. */
function smudgeStep(ctx: SimContext, st: Staff, dt: number) {
  const room = smudging(ctx, st);
  if (!room) {
    staffIdle(ctx, st);
    return;
  }
  st.timer -= dt;
  // done when the time is up, or sooner if the vibes have faded away meanwhile
  if (st.timer > 0 && room.vibes > 0) {
    if (!st.path) wander(ctx, st, room);
    return;
  }
  // vibes that faded on their own while the walk went on leave nothing to clear, bless or learn from
  const cleared = room.vibes > 0;
  clearVibes(room);
  if (!cleared) {
    staffIdle(ctx, st);
    return;
  }
  // a Shaman leaves a blessing behind them
  const shaman = st.role === 'shaman';
  if (shaman) bless(room, ctx.s.day);
  st.job = null;
  st.yearServed++;
  gainXp(ctx, st, XP_PER_JOB);
  say(st, 'bubble-sparkle', 3);
  emit(ctx, { type: 'float', text: shaman ? 'Cleared and blessed' : 'Vibes cleared', x: st.x, y: st.y, kind: 'good' });
  staffIdle(ctx, st);
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
  if (hasGeneral(st, 'stamina')) stamina *= STAMINA_DRAIN;
  if (st.energy < 15) walk *= 0.75;
  const arrived = moveAlong(st, dt, walk);
  // someone who quits this very step has only just set off for the door
  const wasLeaving = st.state === 'leaving';

  updateMorale(ctx, st, dt);
  if (st.state === 'leaving' && !ctx.s.staff.includes(st)) return;
  growNeeds(ctx, st, dt, breakRoom(ctx, st));
  if (st.state === 'onBreak') st.energy = Math.min(100, st.energy + dt * BREAK_REST * breakBoost(ctx, st));
  else if (st.state !== 'leaving' && st.state !== 'training' && st.state !== 'away') {
    const rate = st.busy ? 0.42 * (st.strain || 1) : st.state === 'atPost' ? 0.14 : 0.2;
    st.energy = Math.max(0, st.energy - rate * stamina * tuning(ctx.s, 'tiredness') * dt);
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
      // free to go, and wanted elsewhere: off to find something else, once whoever is in hand is seen to
      else if (!inHand(ctx, it) && wantedElsewhere(ctx, st, it)) staffIdle(ctx, st);
      else if (restDue(ctx, st) && !inHand(ctx, it)) {
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
      st.timer += dt;
      if (arrived) st.state = 'onBreak';
      else if (!st.path) staffIdle(ctx, st);
      break;
    case 'onBreak':
      if (st.energy >= 100 || !st.claimItem) staffIdle(ctx, st);
      // an Instructor gets up in time to be back for their next class, rested enough
      else if (st.role === 'instructor' && backForClass(ctx, st, st.timer)) staffIdle(ctx, st);
      break;
    case 'toJob':
      // a soul is retrieved from someone who may have moved on: follow them until close enough
      if (st.job?.kind === 'soul') {
        if ((arrived || !st.path) && !reachSoul(ctx, st)) staffIdle(ctx, st);
        break;
      }
      // and a guest on a really bad trip runs on: chase them, and talk them down once close enough
      if (st.job?.kind === 'calm') {
        if (!followRunner(ctx, st, arrived)) staffIdle(ctx, st);
        break;
      }
      if (arrived) {
        st.state = 'doingJob';
        st.busy = true;
        if (st.job?.kind === 'smudge') {
          st.timer = clearingSeconds(st, smudgeSeconds(caretakerSpeed(st)));
          say(st, 'bubble-smudge', 2);
          break;
        }
        if (st.job?.kind === 'refresh') {
          st.timer = refreshSeconds();
          say(st, wants(st) === 'eat' ? 'bubble-hungry' : 'bubble-thirsty', 2);
          break;
        }
        st.timer = jobSeconds(st.job?.kind) / caretakerSpeed(st);
        if (st.job?.kind === 'install') say(st, 'bubble-installing', 2);
        if (st.job && st.job.kind !== 'litter') {
          const p = ctx.world.item(st.job.id);
          if (p) st.facing = Math.atan2(p.x + 0.5 - st.x, p.y + 0.5 - st.y);
        }
      } else if (!st.path) staffIdle(ctx, st);
      break;
    case 'doingJob':
      if (st.job?.kind === 'smudge') {
        smudgeStep(ctx, st, dt);
        break;
      }
      if (st.job?.kind === 'soul') {
        if (soulStep(ctx, st, dt)) staffIdle(ctx, st);
        break;
      }
      if (st.job?.kind === 'ward') {
        if (wardStep(ctx, st, dt)) staffIdle(ctx, st);
        break;
      }
      if (st.job?.kind === 'calm') {
        if (calmStep(ctx, st, dt)) staffIdle(ctx, st);
        break;
      }
      // the guest on a table is treated before a Mechanic starts work on it
      if (st.job?.kind === 'install' && ctx.world.item(st.job.id)?.serving) break;
      st.timer -= dt;
      if (st.timer <= 0) {
        const job = st.job;
        if (job?.kind === 'refresh') {
          refreshed(st, ctx.world.item(job.id));
          st.job = null;
          staffIdle(ctx, st);
          break;
        }
        if (job?.kind === 'litter') ctx.s.litter = ctx.s.litter.filter((l) => l.id !== job.id);
        else if (job) {
          const p = ctx.world.item(job.id);
          if (p) {
            if (job.kind === 'repair') {
              p.wear = 0;
              delete p.overloaded;
            } else if (job.kind === 'install') installUpgrade(ctx, p);
            else if (job.kind === 'clean') {
              if (!hasLinens(p)) p.dirt = 0;
              else if (changeLinens(ctx, p)) say(st, 'bubble-linens', 2);
            } else if (job.kind === 'launder') launder(p);
            else p.water = 100;
            p.claimedBy = 0;
            if (job.kind === 'repair') ctx.world.version++;
          }
        }
        if (job) {
          st.yearServed++;
          gainXp(ctx, st, XP_PER_JOB);
        }
        st.job = null;
        staffIdle(ctx, st);
      }
      break;
    case 'toCall':
      // the days away count from leaving the building, not from setting off across it
      if (arrived || !st.path) leaveForCall(ctx, st);
      break;
    case 'away':
      if (st.call && ctx.s.day >= st.call.back) returnFromCall(ctx, st);
      else if (!st.call) st.state = 'arriving';
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
