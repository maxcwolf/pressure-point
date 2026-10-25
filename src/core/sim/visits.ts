// Visitors who judge the center. A VIP writes ahead, tours a few rooms and judges them by their own tastes, leaving
// a reward if delighted and a dent in the center's reputation if disappointed. The health inspector calls now and
// then, ready or not, and checks a few rooms at random, up to six, for dirt, broken equipment and a Fire Extinguisher
// near its door, or sprinklers. The fire brigade's crew are visitors too, though they judge nothing (see blazes.ts).

import {
  type Aspect,
  ASPECT_NOTES,
  BRIBE_LEAK,
  BRIBE_MIN,
  BRIBE_RECHECK_DAYS,
  BRIBE_REP,
  BRIBE_TIMES,
  centerOf,
  DIRT_FILTHY,
  EXTINGUISHER_REACH,
  IDEAL_TEMP,
  INSPECTION_ALLOWED,
  INSPECTION_CLEAN_REP,
  INSPECTION_FINE,
  INSPECTION_GAP_DAYS,
  INSPECTION_REP,
  INSPECTOR_ROOMS,
  ITEMS,
  LOOK_SECONDS,
  MUSHROOM_FINE,
  MUSHROOM_REP,
  NOISE_LOUD,
  ROOMS,
  VIP_CARES,
  VIP_DELIGHTED,
  VIP_DISAPPOINTED,
  VIP_GAP_DAYS,
  VIP_PRIZE,
  VIP_REP,
  VIP_ROOMS,
  VIPS,
  VISIT_NEWS,
  VISIT_NOTICE_DAYS,
  WEAR_REPAIR,
  WOMEN_VISIT,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { randomLook, randomName, rollSex, sexOfName } from '../people';
import { irnd, pick, random } from '../random';
import type {
  GameState,
  Item,
  JudgeKind,
  Room,
  RoomVerdict,
  VisitNotice,
  Visitor,
  VisitorKind,
  VisitReport,
} from '../state/types';
import { clamp } from '../util';
import { accessTile } from '../world';
import { prestige } from './ambience';
import { updateFirefighter } from './blazes';
import { newChar, say, streetTile } from './chars';
import type { SimContext } from './context';
import { changeRep, earn, spend } from './economy';
import { emit, tipOnce, toast } from './events';
import { goTo, moveAlong } from './movement';
import { counterVerdict, inspectorComing, inspectorGone, MUSHROOMS_FOUND } from './mushrooms';
import { noiseAt } from './noise';
import { vipSetback } from './rival';
import { cutOff } from './twists';
import { discomfort, warmthAt } from './warmth';

/** Days a visitor who cannot get in is waited for before the visit is put off. */
const STUCK_VISIT_DAYS = 3;

/** How a visitor rates each aspect of a room, from 0 (dreadful) to 1 (perfect). */
export type AspectScores = Record<Aspect, number>;

/** The aspects, in the order they are weighed. */
const ASPECTS = Object.keys(ASPECT_NOTES) as Aspect[];

/** The items standing in a room. */
const itemsIn = (ctx: SimContext, room: Room) => ctx.s.items.filter((it) => ctx.world.zoneAt(it.x, it.y) === room.id);

/** The pieces of litter on a room's floor. */
const litterIn = (ctx: SimContext, room: Room) =>
  ctx.s.litter.filter((l) => ctx.world.zoneAt(l.x, l.y) === room.id).length;

/** The spot a visitor stands to look round a room: the open floor nearest its middle, out of everyone's way. */
export function viewingTile(ctx: SimContext, room: Room): [number, number] | null {
  // the spots where people sit, lie or work, and the doorway, are left free if anywhere else will do
  const busy = new Set([`${room.door.x},${room.door.y}`]);
  for (const it of itemsIn(ctx, room))
    for (let i = 0; i < ITEMS[it.type].access.length; i++) busy.add(accessTile(it, i).join(','));
  return nearestMiddle(ctx, room, busy) ?? nearestMiddle(ctx, room, new Set());
}

/** The open floor in a room nearest its middle, leaving out some tiles. */
function nearestMiddle(ctx: SimContext, room: Room, skip: ReadonlySet<string>): [number, number] | null {
  const cx = room.x + (room.w - 1) / 2;
  const cy = room.y + (room.h - 1) / 2;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (ctx.world.zoneAt(x, y) !== room.id || !ctx.world.walkable(x, y) || skip.has(`${x},${y}`)) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [x, y];
      }
    }
  }
  return best;
}

/** How a room does on each aspect a visitor looks at. */
export function aspectScores(ctx: SimContext, room: Room): AspectScores {
  const items = itemsIn(ctx, room);
  const filthy = items.filter((it) => it.dirt >= DIRT_FILTHY).length + litterIn(ctx, room);
  const broken = items.filter((it) => it.wear >= 100).length;
  const worn = items.filter((it) => it.wear >= WEAR_REPAIR && it.wear < 100).length;
  const [x, y] = viewingTile(ctx, room) ?? [room.x, room.y];
  return {
    decor: (prestige(ctx, room) - 1) / 4,
    cleanliness: clamp(1 - filthy * 0.35, 0, 1),
    calm: 1 - Math.min(1, noiseAt(ctx, x, y) / NOISE_LOUD),
    warmth: 1 - discomfort(warmthAt(ctx, x, y)),
    equipment: clamp(1 - broken * 0.5 - worn * 0.2, 0, 1),
  };
}

/** A VIP's score for a room, from 0 to 100: what they care about weighs most, and a gloomy air spoils it all. */
export function vipScore(scores: AspectScores, cares: Aspect, vibes: number): number {
  let total = 0;
  let weight = 0;
  for (const a of ASPECTS) {
    const w = a === cares ? VIP_CARES : 1;
    total += scores[a] * w;
    weight += w;
  }
  return Math.round((total / weight) * (1 - (vibes / 100) * 0.5) * 100);
}

/** How an aspect reads in a note, good or bad: a room too warm reads as hot, not cold. */
function aspectNote(a: Aspect, good: boolean, temp: number): string {
  if (a === 'warmth' && !good) return temp > IDEAL_TEMP ? 'too hot' : 'too cold';
  return good ? ASPECT_NOTES[a].good : ASPECT_NOTES[a].bad;
}

/** A VIP's note on a room: what they made of what they care about, and the worst of the rest if it let them down. */
export function vipNote(scores: AspectScores, cares: Aspect, vibes: number, temp: number): string {
  const liked = scores[cares] >= 0.6;
  let note = aspectNote(cares, liked, temp);
  const worst = ASPECTS.filter((a) => a !== cares).sort((a, b) => scores[a] - scores[b])[0];
  if (worst && scores[worst] < 0.35) note += `${liked ? ', but' : ', and'} ${aspectNote(worst, false, temp)}`;
  if (vibes >= 30) note += ', with a gloomy air about it';
  return `${note.charAt(0).toUpperCase()}${note.slice(1)}.`;
}

/**
 * Whether a room is ready for a fire: sprinklers fitted, or a Fire Extinguisher that works near enough its door, for
 * the inspector, and for a Caretaker to put a fire out there quickly.
 */
export function extinguisherNear(ctx: SimContext, room: Room): boolean {
  if (room.sprinklers) return true;
  const { x, y } = room.door;
  return ctx.s.items.some(
    (it: Item) =>
      it.type === 'fire_extinguisher' &&
      ctx.world.usable(it, true) &&
      Math.max(Math.abs(it.x - x), Math.abs(it.y - y)) <= EXTINGUISHER_REACH,
  );
}

/** What the inspector finds wrong in a room. */
export function inspectionProblems(ctx: SimContext, room: Room): string[] {
  const items = itemsIn(ctx, room);
  const problems: string[] = [];
  if (items.some((it) => it.dirt >= DIRT_FILTHY) || litterIn(ctx, room) > 0) problems.push('dirty');
  if (items.some((it) => it.wear >= 100)) problems.push('broken equipment');
  if (!extinguisherNear(ctx, room)) problems.push('no Fire Extinguisher nearby');
  return problems;
}

/** What a visitor makes of a room. */
export function judgeRoom(ctx: SimContext, v: Visitor, room: Room): RoomVerdict {
  const name = ROOMS[room.type].name;
  if (v.visit === 'inspector') {
    const problems = inspectionProblems(ctx, room);
    const listed = problems.join(', ');
    const note = problems.length ? `${listed.charAt(0).toUpperCase()}${listed.slice(1)}.` : 'All in order.';
    return { room: room.id, name, score: Math.max(0, 100 - problems.length * 34), note, problems };
  }
  const cares = v.cares ?? 'decor';
  const scores = aspectScores(ctx, room);
  const [x, y] = viewingTile(ctx, room) ?? [room.x, room.y];
  return {
    room: room.id,
    name,
    score: vipScore(scores, cares, room.vibes),
    note: vipNote(scores, cares, room.vibes, warmthAt(ctx, x, y)),
    problems: [],
  };
}

/** How a visit turned out, from what the visitor made of each room. */
export function verdict(
  visit: VisitorKind,
  rooms: readonly RoomVerdict[],
  stars: number,
): Pick<VisitReport, 'score' | 'outcome' | 'money' | 'rep'> {
  if (visit === 'inspector') {
    const problems = rooms.reduce((n, r) => n + r.problems.length, 0);
    // mushrooms under the counter fail an inspection on their own, and cost a great deal more
    const found = rooms.some((r) => r.problems.includes(MUSHROOMS_FOUND));
    if (found || problems > INSPECTION_ALLOWED)
      return {
        score: problems,
        outcome: 'failed',
        money: -(problems * INSPECTION_FINE + (found ? MUSHROOM_FINE : 0)),
        rep: -(INSPECTION_REP + (found ? MUSHROOM_REP : 0)),
      };
    return { score: problems, outcome: 'passed', money: 0, rep: problems ? 0 : INSPECTION_CLEAN_REP };
  }
  const score = rooms.length ? Math.round(rooms.reduce((n, r) => n + r.score, 0) / rooms.length) : 0;
  if (score >= VIP_DELIGHTED)
    return { score, outcome: 'delighted', money: VIP_PRIZE * Math.max(1, stars), rep: VIP_REP };
  if (score < VIP_DISAPPOINTED) return { score, outcome: 'disappointed', money: 0, rep: -VIP_REP };
  return { score, outcome: 'satisfied', money: 0, rep: 1 };
}

/** The rooms a visitor will see, by id: a few at random for a VIP, and most of them for the inspector. */
export function chooseTour(ctx: SimContext, visit: VisitorKind): number[] {
  const rooms = ctx.s.rooms.filter((r) => r.done).map((r) => r.id);
  // shuffled, so a VIP sees a different few each time
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(random(ctx.s) * (i + 1));
    const a = rooms[i];
    const b = rooms[j];
    if (a === undefined || b === undefined) continue;
    rooms[i] = b;
    rooms[j] = a;
  }
  return rooms.slice(0, visit === 'inspector' ? INSPECTOR_ROOMS : irnd(ctx.s, VIP_ROOMS[0], VIP_ROOMS[1]));
}

/** What a visitor is called and what they care about, for a VIP or the inspector. */
export function newNotice(ctx: SimContext, visit: JudgeKind): VisitNotice {
  const arrives = ctx.s.day + VISIT_NOTICE_DAYS;
  const name = randomName(ctx.s, rollSex(ctx.s, WOMEN_VISIT));
  if (visit === 'inspector') return { visit, name, title: 'the health inspector', arrives };
  const vip = pick(ctx.s, VIPS);
  return { visit, name, title: vip.title, cares: vip.cares, arrives };
}

/** Put a visit on the calendar, and say who is coming. */
function writeAhead(ctx: SimContext, visit: JudgeKind) {
  const notice = newNotice(ctx, visit);
  ctx.s.visitNotice = notice;
  emit(ctx, { type: 'announce', text: VISIT_NEWS[visit] });
  if (visit === 'inspector') {
    toast(
      ctx,
      `The health inspector will call in ${VISIT_NOTICE_DAYS} days. They will check up to ${INSPECTOR_ROOMS} rooms, chosen at random.`,
      'info',
      undefined,
      'bubble-inspecting',
    );
    inspectorComing(ctx);
  } else
    toast(
      ctx,
      `${notice.name}, ${notice.title}, is visiting in ${VISIT_NOTICE_DAYS} days, and cares most about ${ASPECT_NOTES[notice.cares ?? 'decor'].name}.`,
      'info',
      undefined,
      'ui-vip',
    );
  tipOnce(
    ctx,
    'visits',
    'A visitor tours a few rooms and judges what they find. A delighted VIP leaves a reward; the inspector fines dirt, broken equipment and a room with no Fire Extinguisher near its door, or sprinklers.',
  );
}

/** Days until the inspector calls again: sooner at a center where they call more often, or with more trouble set. */
export function inspectionGap(s: GameState): number {
  return Math.round(
    (irnd(s, INSPECTION_GAP_DAYS[0], INSPECTION_GAP_DAYS[1]) / (centerOf(s).inspections ?? 1)) * tuning(s, 'trouble'),
  );
}

/** Bring in the visitor who wrote ahead. False if they cannot get in yet. */
function arrive(ctx: SimContext, notice: VisitNotice): boolean {
  const [x, y] = streetTile(ctx.s, ctx.world.building, ctx.world.w);
  const v: Visitor = {
    // the name was a woman's or a man's, and the look that turns up follows it
    ...newChar(ctx, notice.name, randomLook(ctx.s, sexOfName(notice.name) ?? rollSex(ctx.s, WOMEN_VISIT)), x, y),
    kind: 'visitor',
    visit: notice.visit,
    title: notice.title,
    ...(notice.cares && { cares: notice.cares }),
    state: 'toRoom',
    tour: chooseTour(ctx, notice.visit),
    seen: [],
  };
  if (!v.tour.length) return false;
  ctx.s.visitors.push(v);
  if (!nextRoom(ctx, v)) {
    ctx.s.visitors = ctx.s.visitors.filter((o) => o !== v);
    return false;
  }
  const inspector = notice.visit === 'inspector';
  const who = inspector ? 'The health inspector' : notice.name;
  toast(
    ctx,
    `${who} has arrived, and is looking round.`,
    'info',
    { kind: 'visitor', id: v.id },
    inspector ? 'bubble-inspecting' : 'ui-vip',
  );
  return true;
}

/** Write ahead, or bring in whoever wrote, as the days come round. Run once a second. */
export function updateVisits(ctx: SimContext) {
  const s = ctx.s;
  // with no visits, there is no inspector to put the mushrooms away for
  if (!s.visitsOn && s.mushroomsStashed) inspectorGone(ctx);
  if (!s.visitsOn || !s.open || s.visitors.length) return;
  const notice = s.visitNotice;
  if (notice) {
    // nobody gets up the road while the center is snowed in, so they come once it is open again
    if (s.day >= notice.arrives && !cutOff(ctx)) {
      if (arrive(ctx, notice)) s.visitNotice = null;
      // nobody to show round, or no way to them, however long they are given: they cannot come, and the next visit is
      // put off, rather than the calendar waiting on them for good
      else if (s.day >= notice.arrives + STUCK_VISIT_DAYS) {
        s.visitNotice = null;
        if (notice.visit === 'inspector') {
          s.nextInspection = s.day + inspectionGap(s);
          // the mushrooms put away for them come back out
          inspectorGone(ctx);
        } else s.nextVip = s.day + irnd(s, VIP_GAP_DAYS[0], VIP_GAP_DAYS[1]);
      }
    }
    return;
  }
  if (s.day >= s.nextInspection) writeAhead(ctx, 'inspector');
  else if (s.stars >= 1 && s.day >= s.nextVip) writeAhead(ctx, 'vip');
}

/** Send a visitor to the next room on their tour that they can reach, or out if there is none. False if stuck. */
export function nextRoom(ctx: SimContext, v: Visitor): boolean {
  while (v.tour.length) {
    const room = ctx.world.room(v.tour[0] ?? 0);
    const spot = room?.done ? viewingTile(ctx, room) : null;
    if (spot && goTo(ctx, v, spot[0], spot[1])) {
      v.state = 'toRoom';
      return true;
    }
    // knocked down, or not to be got at: on to the next
    v.tour.shift();
  }
  v.state = 'leaving';
  const [x, y] = streetTile(ctx.s, ctx.world.building, ctx.world.w);
  if (goTo(ctx, v, x, y)) return true;
  finishVisit(ctx, v);
  return false;
}

/** Move one visitor forward in time: walking to a room, looking round it, or leaving; or for a firefighter, at the fire. */
export function updateVisitor(ctx: SimContext, v: Visitor, dt: number) {
  if (v.visit === 'firefighter') {
    updateFirefighter(ctx, v, dt);
    return;
  }
  if (v.bubbleT > 0) v.bubbleT -= dt;
  const arrived = moveAlong(v, dt, 2);
  switch (v.state) {
    case 'toRoom':
      if (arrived || !v.path) {
        v.state = 'looking';
        v.timer = LOOK_SECONDS;
        say(v, v.visit === 'inspector' ? 'bubble-inspecting' : 'bubble-looking', LOOK_SECONDS);
      }
      break;
    case 'looking': {
      v.timer -= dt;
      if (v.timer > 0) break;
      const room = ctx.world.room(v.tour.shift() ?? 0);
      if (room) {
        const seen = judgeRoom(ctx, v, room);
        v.seen.push(seen);
        say(
          v,
          seen.score >= VIP_DELIGHTED
            ? 'bubble-happy'
            : seen.score < VIP_DISAPPOINTED
              ? 'bubble-unhappy'
              : 'bubble-unsure',
          2,
        );
      }
      nextRoom(ctx, v);
      break;
    }
    case 'leaving':
      if (arrived || !v.path) finishVisit(ctx, v);
      break;
  }
}

/**
 * A visitor has gone: weigh up what they saw, pay out or fine, and write the report. The inspector glances at the Shop
 * Counter on the way out. A failed inspection waits to be settled: by the fine, or by making it go away. A visitor
 * who could reach no room on their tour has nothing to judge, and leaves no report.
 */
export function finishVisit(ctx: SimContext, v: Visitor) {
  const s = ctx.s;
  s.visitors = s.visitors.filter((o) => o !== v);
  // the fire brigade's crew judge nothing, and leave no report
  if (v.visit === 'firefighter') return;
  if (v.visit === 'inspector') s.nextInspection = s.day + inspectionGap(s);
  else s.nextVip = s.day + irnd(s, VIP_GAP_DAYS[0], VIP_GAP_DAYS[1]);
  if (!v.seen.length) {
    toast(ctx, `${v.name} left without seeing a single room: every one on the tour was out of reach.`, 'info');
    if (v.visit === 'inspector') inspectorGone(ctx);
    return;
  }
  // an earlier inspection still unsettled is settled by its fine before this one is written up
  settleInspection(ctx, false);
  if (v.visit === 'inspector') {
    const counter = counterVerdict(ctx);
    if (counter) v.seen.push(counter);
  }
  const result = verdict(v.visit, v.seen, s.stars);
  const failed = v.visit === 'inspector' && result.outcome === 'failed';
  if (!failed) {
    if (result.money > 0) {
      earn(ctx, result.money, 'bonus');
    }
    changeRep(ctx, result.rep);
  }
  if (v.visit === 'vip' && result.outcome === 'delighted') vipSetback(ctx);
  s.visitReport = { visit: v.visit, name: v.name, title: v.title, day: s.day, rooms: v.seen, ...result };
  if (failed) s.visitReport.bribe = bribeFor(-result.money);
  // the mushrooms come back out only once the inspector has been past the counter
  if (v.visit === 'inspector') inspectorGone(ctx);
  const good = result.outcome === 'delighted' || result.outcome === 'passed';
  emit(ctx, { type: 'sfx', name: good ? 'fanfare' : 'fail' });
  emit(ctx, { type: 'visit' });
  if (failed) toast(ctx, `The inspection failed: a ${money(-result.money)} fine, unless it goes away.`, 'bad');
}

/** What making a failed inspection go away costs: twice its fine, rounded to $500, and never less than the floor. */
export const bribeFor = (fine: number) => Math.max(BRIBE_MIN, Math.round((fine * BRIBE_TIMES) / 500) * 500);

/**
 * Settle a failed inspection: pay its fine and take the hit to reputation, or pay to make it go away, so it counts as
 * passed. Now and then word of that gets out, which costs reputation anyway and brings the inspector back sooner.
 * False if there is nothing to settle, or the bribe cannot be paid.
 */
export function settleInspection(ctx: SimContext, payOff: boolean): boolean {
  const s = ctx.s;
  const r = s.visitReport;
  if (r?.bribe === undefined) return false;
  if (!payOff) {
    spend(ctx, -r.money, 'fines');
    changeRep(ctx, r.rep);
    delete r.bribe;
    return true;
  }
  if (s.money < r.bribe) {
    toast(ctx, `Making it go away costs ${money(r.bribe)}. You can't afford it.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'error' });
    return false;
  }
  spend(ctx, r.bribe, 'fines');
  r.outcome = 'paid off';
  r.money = -r.bribe;
  r.rep = 0;
  delete r.bribe;
  emit(ctx, { type: 'sfx', name: 'cash' });
  if (random(s) < BRIBE_LEAK) {
    r.rep = -BRIBE_REP;
    changeRep(ctx, -BRIBE_REP);
    s.nextInspection = Math.min(s.nextInspection, s.day + BRIBE_RECHECK_DAYS);
    toast(
      ctx,
      'Word got out that the inspector was paid off. They will be back soon, and they will look harder.',
      'bad',
      undefined,
      'ui-news',
    );
  } else toast(ctx, 'The inspector’s report seems to have been lost. How unfortunate.', 'good', undefined, 'ui-bribe');
  return true;
}

/** A failed inspection nobody settled is settled by its fine the day after. */
export function lapseInspection(ctx: SimContext) {
  const r = ctx.s.visitReport;
  if (r?.bribe !== undefined && ctx.s.day - r.day >= 1) settleInspection(ctx, false);
}
