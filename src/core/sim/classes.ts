// Qi Gong classes: a studio's timetable sets the days it holds them, and class-goers book a place two days before,
// come straight to the studio and stand on a Practice Spot. On the day, the Instructor leads a class for everyone on
// a spot, and they pay and go.
// Each week's interest is shared among its classes, so many classes a week fill fewer places each.

import {
  BOOK_AHEAD,
  BREAK_EXHAUSTED,
  CLASS_CALL_GAP,
  CLASS_DAYS,
  CLASS_FEE,
  CLASS_INTEREST,
  CLASS_PATIENCE,
  CLASS_PLACES,
  CLASS_SECONDS,
  DAY_SECONDS,
  ITEMS,
  REST_AHEAD,
  REST_GAP,
  REST_RETURN,
  WEEKDAYS,
  XP_PER_GUEST,
} from '../data';
import { rnd } from '../random';
import { offeringOn } from '../state/game';
import type { ClassMiss, Guest, Item, Room, Staff } from '../state/types';
import { at, clamp } from '../util';
import { prestige } from './ambience';
import { gainXp, habitOf, hasGeneral } from './careers';
import { guestById, say } from './chars';
import type { SimContext } from './context';
import { changeRep, earn, priceFor } from './economy';
import { emit, tipOnce, toast } from './events';
import { feel, writeReview } from './feelings';
import { decide, leave, spawnGuest } from './guests';
import { feelNoise, itemNoise } from './noise';
import { breakDue } from './policy';
import { isGroupStation, isLeadStation, matsOf, stationStaff } from './sessions';
import { expectedPrestige } from './standing';
import { serviceSeconds, wantsToShop } from './stations';
import { cutOff } from './twists';
import { feelTemperature, warmthAt } from './warmth';

/** The day of the week a game day falls on, from Monday as 0. */
export const weekday = (day: number) => Math.floor(day) % 7;

/** The days of the week a studio holds classes. */
export const classDays = (room: Pick<Room, 'classDays'>): readonly number[] => room.classDays ?? CLASS_DAYS;

/** Whether a studio holds a class on a game day. */
export const classOn = (room: Pick<Room, 'classDays'>, day: number) => classDays(room).includes(weekday(day));

/** A timetable with a day of the week switched on or off, sorted. */
export function toggledDays(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/**
 * How many class-goers a studio draws in a week: more for each Practice Spot, for a better reputation and for a more
 * skilled Instructor.
 */
export function weeklyInterest(spots: number, reputation: number, skill: number): number {
  return spots * CLASS_INTEREST * (0.4 + reputation / 83) * (0.85 + skill * 0.05);
}

/**
 * How one class fills: the week's interest shared among its classes, give or take a little (`roll`), as many as there
 * are places, and the rest turned away.
 */
export function classSize(interest: number, perWeek: number, spots: number, roll: number) {
  const want = Math.max(0, Math.round((interest / Math.max(1, perWeek)) * roll));
  return { count: Math.min(spots, want), turned: Math.max(0, want - spots) };
}

/** How many Practice Spots an Instructor of a rank can lead a class on: a more senior one leads a bigger class. */
export const classPlaces = (skill: number) => at(CLASS_PLACES, clamp(Math.round(skill), 1, CLASS_PLACES.length) - 1);

/** Whether an item is a Qi Gong Instructor's Mat, which leads a class rather than a sound bath. */
export const isClassLead = (it: Item) => isLeadStation(it) && ITEMS[it.type].station?.staff === 'instructor';

/** Whether an item is a Practice Spot, a place in a class. */
export const isClassSpot = (it: Item) => isGroupStation(it) && ITEMS[it.type].station?.goal === 'class';

/** The Practice Spots in a studio that can be used. */
function spotsIn(ctx: SimContext, room: Room): Item[] {
  return ctx.s.items.filter((it) => isClassSpot(it) && ctx.world.roomOfItem(it) === room && ctx.world.usable(it));
}

/** The Instructor's Mat in a studio, if it has one. */
const leadIn = (ctx: SimContext, room: Room) =>
  ctx.s.items.find((it) => isClassLead(it) && ctx.world.roomOfItem(it) === room);

/** The finished Qi Gong Studios. */
export const studios = (ctx: SimContext) => ctx.s.rooms.filter((r) => r.done && r.type === 'qigong');

/** The most skilled Qi Gong Instructor on the payroll, if any. */
export function bestInstructor(ctx: SimContext): Staff | undefined {
  return ctx.s.staff
    .filter((st) => st.role === 'instructor' && st.state !== 'leaving')
    .sort((a, b) => b.skill - a.skill)[0];
}

/** How long before the last moment to set off a resting Instructor may get up for their class, in days. */
const REST_LAST = 0.25;

/** Whether a studio has today's class still to hold: one under way, or a class day that has not had its class yet. */
const classToCome = (ctx: SimContext, room: Room, today: number) =>
  !!leadIn(ctx, room)?.progress || (classOn(room, today) && room.lastClass !== today);

/** Days from today to the next class still to hold in any studio: 0 if today's is still to come, Infinity if none. */
export function daysToClass(ctx: SimContext): number {
  if (!offeringOn(ctx.s, 'qigong')) return Infinity;
  const today = Math.floor(ctx.s.day);
  let next = Infinity;
  for (const room of studios(ctx)) {
    if (classToCome(ctx, room, today)) return 0;
    for (let d = 1; d <= 7 && d < next; d++) if (classOn(room, today + d)) next = d;
  }
  return next;
}

/**
 * Whether a member of staff should go for a break now, as the policy says, but for an Instructor. A break, with the
 * walk to the Staff Room and back, can take longer than the days between classes, so an Instructor rests straight
 * after a class with the days to spare, a little early, rather than run down just before the next one. Until then
 * they hold off, unless they are worn right out.
 */
export function restDue(ctx: SimContext, st: Staff): boolean {
  if (st.role !== 'instructor') return breakDue(ctx, st);
  const ahead = daysToClass(ctx);
  const { breakAt } = ctx.s.policy;
  if (ahead === Infinity) return breakDue(ctx, st);
  if (ahead >= REST_GAP) return breakDue(ctx, st, breakAt + REST_AHEAD);
  return breakDue(ctx, st, Math.min(breakAt, BREAK_EXHAUSTED));
}

/**
 * Whether an Instructor on a break should get up now to be back for the next class: rested as far as they would rest
 * early, and this the last moment to walk back in time, taking the walk back to be as long as the walk there was. If
 * it is already too late, they rest in full.
 */
export function backForClass(ctx: SimContext, st: Staff, walk: number): boolean {
  const ahead = daysToClass(ctx);
  if (ahead === Infinity || st.energy < ctx.s.policy.breakAt + REST_AHEAD) return false;
  const left = Math.floor(ctx.s.day) + ahead + 1 - ctx.s.day - REST_RETURN - walk / DAY_SECONDS;
  return left >= 0 && left < REST_LAST;
}

/** What takes an Instructor away from the studio for a while: a break, a course or a call, and the walk there. */
const AWAY: readonly Staff['state'][] = ['toBreak', 'onBreak', 'toTrain', 'training', 'toCall', 'away'];

/** Whether an Instructor is away from the studio for a while, as on a break. */
export const instructorAway = (st: Staff) => AWAY.includes(st.state);

/**
 * As a day begins, book the classes the day after tomorrow: each studio with a class then and an Instructor on the
 * payroll fills what places it can, and its class-goers set off at times through today, since days are short and the
 * walk in is long. Its places are its Practice Spots, as many as the Instructor's rank lets them lead: spots past that
 * stand empty and draw nobody. Places are booked only while the Instructor is at their mat: from a studio far from
 * the Staff Room, a break can keep them away for days, and class-goers left waiting for them go home disappointed.
 * Nor are more booked than the classes still to come have places for, after the class-goers already waiting or on
 * their way: anyone whose class never happened takes a place in the next one.
 */
export function bookClasses(ctx: SimContext) {
  const s = ctx.s;
  const instructor = bestInstructor(ctx);
  if (!offeringOn(s, 'qigong') || !instructor) return;
  const today = Math.floor(s.day);
  const day = today + BOOK_AHEAD;
  const places = new Map(
    studios(ctx).map((room) => [room, Math.min(spotsIn(ctx, room).length, classPlaces(instructor.skill))]),
  );
  let free = [...places].reduce((sum, [room, spots]) => sum + spots * classesThrough(ctx, room, today, day), 0);
  free -= s.arrivals.length + s.guests.filter((g) => g.classDay && g.goal === 'class' && g.state !== 'leaving').length;
  for (const [room, spots] of places) {
    if (!classOn(room, day)) continue;
    if (instructor.state !== 'atPost') {
      room.booked = { day, count: 0, turned: 0, away: true };
      tipOnce(
        ctx,
        'class-away',
        `Nobody was booked for ${WEEKDAYS[weekday(day)] ?? ''}’s Qi Gong class, as ${instructor.name} was away from their mat. A Staff Room nearer the studio gets them back from a break sooner.`,
        'info',
        { kind: 'room', id: room.id },
      );
      continue;
    }
    if (spotsIn(ctx, room).length > spots)
      tipOnce(
        ctx,
        'class-places',
        `${instructor.name} can lead a class of ${spots}, so some Practice Spots stand empty. Promote them to lead more.`,
        'info',
        { kind: 'staff', id: instructor.id },
      );
    const interest = weeklyInterest(spots, s.reputation, instructor.skill);
    const size = classSize(interest, classDays(room).length, Math.max(0, Math.min(spots, free)), rnd(s, 0.8, 1.2));
    free -= size.count;
    if (size.turned > 0 && classDays(room).length < 7)
      tipOnce(
        ctx,
        'class-full',
        `${WEEKDAYS[weekday(day)] ?? ''}’s Qi Gong class is full, with ${size.turned} more turned away. Each week's class-goers are shared among its classes: switch on another class day in the studio to fit more in.`,
        'info',
        { kind: 'room', id: room.id },
      );
    room.booked = { day, ...size };
    for (let i = 0; i < size.count; i++) s.arrivals.push({ at: today + rnd(s, 0.05, 0.6), day });
  }
}

/** How many classes a studio has still to hold from today to a day, both included. */
function classesThrough(ctx: SimContext, room: Room, today: number, day: number): number {
  let n = classToCome(ctx, room, today) ? 1 : 0;
  for (let d = today + 1; d <= day; d++) if (classOn(room, d)) n++;
  return n;
}

/**
 * Send in the class-goers whose time has come. Any due while the center is closed or cut off stay away, and so do any
 * due while the Instructor is away, as on a break, since the studio tells them the class is off.
 */
export function admitClassgoers(ctx: SimContext) {
  const s = ctx.s;
  if (!s.arrivals.length) return;
  const due = s.arrivals.filter((a) => a.at <= s.day);
  if (!due.length) return;
  s.arrivals = s.arrivals.filter((a) => a.at > s.day);
  if (!s.open || cutOff(ctx)) return;
  const instructor = bestInstructor(ctx);
  if (instructor && instructorAway(instructor)) return;
  for (const a of due) spawnGuest(ctx, undefined, false, a.day);
}

/**
 * Run an Instructor's Mat for a step. On a class day, once the Instructor is at the mat and someone is on a spot, a
 * class starts, keeping the Instructor busy, and runs its length, anyone reaching a spot meanwhile joining in. It ends
 * for everyone on a spot together. Its progress is how far through the class it is, and 0 between classes.
 */
export function updateClass(ctx: SimContext, lead: Item, staff: Staff | undefined, dt: number) {
  const room = ctx.world.roomOfItem(lead);
  const today = Math.floor(ctx.s.day);
  const standing = matsOf(ctx, lead).some((m) => guestById(ctx, m.serving)?.state === 'served');
  if (!room || !staff) return;
  if (!lead.progress && standing && classOn(room, today) && room.lastClass !== today) {
    lead.progress = 1e-6;
    room.lastClass = today;
  }
  staff.busy = lead.progress > 0;
  staff.strain = 1.2;
  if (!lead.progress) return;
  lead.progress += dt / serviceSeconds(CLASS_SECONDS, staff);
  if (lead.progress < 1) return;
  lead.progress = 0;
  finishClass(ctx, lead, staff);
}

/**
 * Whether a class-goer may be called to a Practice Spot now: their class is the studio's next one, or an earlier one,
 * or nobody come for one of those is in line at the studio. Anyone in early for a later class waits, so as not to take
 * the spot of someone come for the class before, but has a free spot rather than stand in line for a class with
 * nobody else coming.
 */
export function dueForSpot(ctx: SimContext, spot: Item, g: Guest): boolean {
  const room = ctx.world.roomOfItem(spot);
  const next = room && nextClassDay(room, Math.floor(ctx.s.day));
  if (!room || !g.classDay || next === undefined || g.classDay <= next) return true;
  return !spotsIn(ctx, room).some((it) =>
    it.queue.some((id) => {
      const q = guestById(ctx, id);
      return q?.goal === 'class' && !!q.classDay && q.classDay <= next;
    }),
  );
}

/** Whether a class is going on at a Practice Spot's studio now. */
export function classPlaying(ctx: SimContext, spot: Item): boolean {
  const room = ctx.world.roomOfItem(spot);
  const lead = room && leadIn(ctx, room);
  return !!lead && lead.progress > 0 && !!stationStaff(ctx, lead);
}

/** How a class-goer found the class: the room, its noise and warmth, and the Instructor's manner. */
function feelClass(ctx: SimContext, g: Guest, spot: Item, staff: Staff) {
  const room = ctx.world.roomOfItem(spot);
  const stars = room ? prestige(ctx, room) : 0;
  if (stars >= 4) feel(g, 'fine-room');
  else if (room && stars < expectedPrestige(ctx.s)) feel(g, 'underwhelmed');
  feelNoise(g, itemNoise(ctx, spot));
  feelTemperature(g, warmthAt(ctx, g.tx, g.ty));
  if (habitOf(staff, 'grump')) feel(g, 'grump');
  if (hasGeneral(staff, 'bedside')) feel(g, 'kind');
}

/** A class-goer finishes their class: they pay for their place, review it, and head for the shop or home. */
export function completeClass(ctx: SimContext, spot: Item, g: Guest, staff: Staff) {
  spot.serving = 0;
  spot.progress = 0;
  staff.served++;
  staff.yearServed++;
  gainXp(ctx, staff, XP_PER_GUEST);
  feelClass(ctx, g, spot, staff);
  const fee = Math.round(CLASS_FEE * priceFor(ctx.s, 'qigong'));
  earn(ctx, fee, 'classes', g.x, g.y);
  g.spent += fee;
  g.outcome = 'class';
  ctx.s.stats.classgoers++;
  ctx.s.tally.classgoers++;
  writeReview(ctx, g, 'class');
  changeRep(ctx, 0.5);
  say(g, 'bubble-thanks', 5);
  delete g.missed;
  g.goal = wantsToShop(ctx, g) ? 'shop' : 'leave';
  decide(ctx, g);
}

/** A class-goer whose class never happened gives up and goes home, and says so, and why. */
export function missClass(ctx: SimContext, g: Guest, why: ClassMiss) {
  g.outcome = 'class';
  g.missed = why;
  feel(g, 'no-class');
  writeReview(ctx, g, 'missed');
  changeRep(ctx, -1);
  say(g, 'bubble-disappointed', 5);
  leave(ctx, g);
}

/**
 * A class comes to its end: everyone on a spot has had it. Class-goers booked for it, or an earlier one, who are still
 * on their way in or in line for a spot are put down for the studio's next class, as the walk in can take longer than
 * they set off ahead.
 */
function finishClass(ctx: SimContext, lead: Item, staff: Staff) {
  const spots = matsOf(ctx, lead);
  let held = 0;
  for (const spot of spots) {
    const g = guestById(ctx, spot.serving);
    if (g?.state !== 'served' || !g.classDay) continue;
    completeClass(ctx, spot, g, staff);
    held++;
  }
  if (held) ctx.s.stats.classes++;
  const today = Math.floor(ctx.s.day);
  const room = ctx.world.roomOfItem(lead);
  const next = room && nextClassDay(room, today);
  if (next)
    for (const spot of spots)
      for (const id of [spot.serving, ...spot.queue]) {
        const g = guestById(ctx, id);
        if (g?.goal === 'class' && g.classDay && g.classDay <= today && ON_THE_WAY.includes(g.state)) g.classDay = next;
      }
}

/** What a class-goer not yet on a spot is doing: coming in, walking to a spot or its line, or waiting in it. */
const ON_THE_WAY: readonly Guest['state'][] = ['enter', 'toWait', 'waiting', 'called'];

/** A studio's next class day from today, today included if its class is still to hold; undefined if it holds none. */
function nextClassDay(room: Room, today: number): number | undefined {
  if (classOn(room, today) && room.lastClass !== today) return today;
  for (let d = today + 1; d <= today + 7; d++) if (classOn(room, d)) return d;
  return undefined;
}

/** How many missed class days a studio keeps, to tell the class-goers who waited for them why. */
const MISSED_KEPT = 4;

/**
 * As a day begins, note any studio whose class day has just passed without a class, and why: the class before it
 * still going, the Instructor resting or otherwise away from the mat, or nobody there in time to start one.
 */
export function noteMissedClasses(ctx: SimContext) {
  const day = Math.floor(ctx.s.day) - 1;
  if (!offeringOn(ctx.s, 'qigong')) return;
  for (const room of studios(ctx)) {
    if (!classOn(room, day) || room.lastClass === day) continue;
    const lead = leadIn(ctx, room);
    const staff = lead && stationStaff(ctx, lead);
    const instructor = bestInstructor(ctx);
    let why: ClassMiss = 'late';
    if (lead?.progress) why = 'overran';
    else if (!instructor) why = 'no-instructor';
    else if (instructor.state === 'toBreak' || instructor.state === 'onBreak') why = 'break';
    else if (staff?.state !== 'atPost') why = 'no-lead';
    room.missed = [...(room.missed ?? []), { day, why }].slice(-MISSED_KEPT);
  }
}

/** Why a class-goer's class never happened for them, from what became of their studio's class day. */
function missReason(ctx: SimContext, g: Guest, room: Room | undefined): ClassMiss {
  if (!bestInstructor(ctx)) return 'no-instructor';
  if (!room) return 'no-spot';
  if (!classOn(room, g.classDay)) return 'off';
  return room.missed?.find((m) => m.day === g.classDay)?.why ?? (g.missed === 'full' ? 'full' : 'late');
}

/** Why a class-goer went home without a class, in a few words. */
export function missNote(why: ClassMiss): string {
  switch (why) {
    case 'no-instructor':
      return 'there was no Instructor to lead the class';
    case 'break':
      return 'the Instructor was on a break';
    case 'no-lead':
      return 'the Instructor never came to the mat';
    case 'overran':
      return 'the class before was still going';
    case 'late':
      return 'they got there after the class';
    case 'off':
      return 'the class was taken off the timetable';
    case 'no-spot':
      return 'there was no Practice Spot to use';
    case 'full':
      return 'every Practice Spot was taken';
  }
}

/** What the player is told when class-goers booked for a day's class go home without one. */
export function missToast(count: number, day: number, why: ClassMiss): string {
  const who = count === 1 ? 'A class-goer' : `${count} class-goers`;
  const when = `${WEEKDAYS[weekday(day)] ?? ''}’s class`;
  const because = {
    'no-instructor': `there is no Qi Gong Instructor to lead ${when}. Hire one.`,
    break: `${when} never started, as the Instructor was worn out and on a break. A Staff Room nearer the studio gets them back sooner.`,
    'no-lead': `${when} never started, as the Instructor was not at their mat.`,
    overran: `${when} never started, as the class before it was still going.`,
    late: `they got to the studio after ${when} had finished.`,
    off: `${when} was taken off the timetable after they booked.`,
    'no-spot': `there was no Practice Spot to use for ${when}.`,
    full: `every Practice Spot was taken by the time they got to ${when}. Another class day, or more spots, would fit them in.`,
  }[why];
  return `${who} went home disappointed: ${because}`;
}

/**
 * As a day begins, class-goers whose class day is long gone without a class give up and go home: no Instructor came,
 * or they never got to a spot. Anyone in a class going on now stays for the end of it. The player is told why, once
 * for each class and reason.
 */
export function giveUp(ctx: SimContext) {
  const today = Math.floor(ctx.s.day);
  const groups = new Map<string, { room: Room | undefined; day: number; why: ClassMiss; count: number }>();
  for (const g of [...ctx.s.guests]) {
    if (!g.classDay || g.goal !== 'class' || g.state === 'leaving' || today < g.classDay + CLASS_PATIENCE) continue;
    const spot = ctx.world.item(g.station);
    if (spot && g.state === 'served' && classPlaying(ctx, spot)) continue;
    const room = (spot && ctx.world.roomOfItem(spot)) ?? studios(ctx)[0];
    const why = missReason(ctx, g, room);
    missClass(ctx, g, why);
    const key = `${room?.id ?? 0}:${g.classDay}:${why}`;
    const group = groups.get(key) ?? { room, day: g.classDay, why, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  for (const { room, day, why, count } of groups.values())
    toast(ctx, missToast(count, day, why), 'bad', room && { kind: 'room', id: room.id });
}

/** Switch a day of the week on or off in a studio's timetable. False if there is no such studio. */
export function toggleClassDay(ctx: SimContext, roomId: number, day: number): boolean {
  const room = ctx.world.room(roomId);
  if (room?.type !== 'qigong' || day < 0 || day > 6) return false;
  room.classDays = toggledDays(classDays(room), day);
  return true;
}

/** Switch the Qi Gong classes on or off. Off, nobody more books a place, and anyone booked stays away. */
export function setClasses(ctx: SimContext, on: boolean) {
  ctx.s.options.qigong = on;
  if (!on) ctx.s.arrivals = [];
}

/** What the speakers say as a day with a class begins, one line and then the next. */
export const CLASS_LINES: readonly string[] = [
  'Qi Gong is starting in the studio. Come cultivate your inner energy, because your outer energy is frankly exhausting.',
  'Qi Gong is now starting. If you cannot feel the invisible ball of energy between your hands, please simulate one for the comfort of others.',
];

/** The class line for the nth call since the game was loaded. */
export const classLine = (n: number) => CLASS_LINES[n % CLASS_LINES.length] ?? '';

/**
 * As a day begins, announce its class if a studio has one with anybody booked for it, and the last call was long
 * enough ago. The gap is counted in days at normal speed, so the call is heard as often at every game speed: at
 * fastest a day goes by in a third of the time, and counts a third of a day.
 */
export function announceClasses(ctx: SimContext) {
  const today = Math.floor(ctx.s.day);
  ctx.classCallWait = Math.max(0, (ctx.classCallWait ?? 0) - 1 / Math.max(1, ctx.s.speed));
  if (!offeringOn(ctx.s, 'qigong') || !ctx.s.open) return;
  if (ctx.classCallWait > 1e-9) return;
  if (studios(ctx).some((r) => classOn(r, today) && r.booked?.day === today && r.booked.count > 0)) {
    emit(ctx, { type: 'announce', text: classLine(ctx.classCalls ?? 0) });
    ctx.classCallWait = CLASS_CALL_GAP;
    ctx.classCalls = (ctx.classCalls ?? 0) + 1;
  }
}
