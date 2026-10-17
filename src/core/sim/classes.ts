// Qi Gong classes: a studio's timetable sets the days it holds them, and class-goers book a place two days before,
// come straight to the studio and stand on a Practice Spot. On the day, the Instructor leads a class for everyone on
// a spot, and they pay and go.
// Each week's interest is shared among its classes, so many classes a week fill fewer places each.

import {
  BOOK_AHEAD,
  CLASS_CALL_GAP,
  CLASS_DAYS,
  CLASS_FEE,
  CLASS_INTEREST,
  CLASS_PATIENCE,
  CLASS_PLACES,
  CLASS_SECONDS,
  ITEMS,
  XP_PER_GUEST,
} from '../data';
import { rnd } from '../random';
import { offeringOn } from '../state/game';
import type { Guest, Item, Room, Staff } from '../state/types';
import { at, clamp } from '../util';
import { prestige } from './ambience';
import { gainXp, habitOf, hasGeneral } from './careers';
import { guestById, say } from './chars';
import type { SimContext } from './context';
import { changeRep, earn, priceFor } from './economy';
import { emit, tipOnce } from './events';
import { feel, writeReview } from './feelings';
import { decide, leave, spawnGuest } from './guests';
import { feelNoise, itemNoise } from './noise';
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

/**
 * As a day begins, book the classes the day after tomorrow: each studio with a class then and an Instructor on the
 * payroll fills what places it can, and its class-goers set off at times through today, since days are short and the
 * walk in is long. Its places are its Practice Spots, as many as the Instructor's rank lets them lead: spots past that
 * stand empty and draw nobody.
 */
export function bookClasses(ctx: SimContext) {
  const s = ctx.s;
  const instructor = bestInstructor(ctx);
  if (!offeringOn(s, 'qigong') || !instructor) return;
  const today = Math.floor(s.day);
  for (const room of studios(ctx)) {
    const day = today + BOOK_AHEAD;
    if (!classOn(room, day)) continue;
    const built = spotsIn(ctx, room).length;
    const spots = Math.min(built, classPlaces(instructor.skill));
    if (built > spots)
      tipOnce(
        ctx,
        'class-places',
        `${instructor.name} can lead a class of ${spots}, so some Practice Spots stand empty. Promote them to lead more.`,
        'info',
        { kind: 'staff', id: instructor.id },
      );
    const interest = weeklyInterest(spots, s.reputation, instructor.skill);
    const size = classSize(interest, classDays(room).length, spots, rnd(0.8, 1.2));
    room.booked = { day, ...size };
    for (let i = 0; i < size.count; i++) s.arrivals.push({ at: today + rnd(0.05, 0.6), day });
  }
}

/** Send in the class-goers whose time has come. Any due while the center is closed or cut off stay away. */
export function admitClassgoers(ctx: SimContext) {
  const s = ctx.s;
  if (!s.arrivals.length) return;
  const due = s.arrivals.filter((a) => a.at <= s.day);
  if (!due.length) return;
  s.arrivals = s.arrivals.filter((a) => a.at > s.day);
  if (!s.open || cutOff(ctx)) return;
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
  say(g, '🙏', 5);
  g.goal = wantsToShop(ctx, g) ? 'shop' : 'leave';
  decide(ctx, g);
}

/** A class-goer whose class never happened gives up and goes home, and says so. */
export function missClass(ctx: SimContext, g: Guest) {
  g.outcome = 'class';
  feel(g, 'no-class');
  writeReview(ctx, g, 'missed');
  changeRep(ctx, -1);
  say(g, '😞', 5);
  leave(ctx, g);
}

/** A class comes to its end: everyone on a spot has had it. */
function finishClass(ctx: SimContext, lead: Item, staff: Staff) {
  let held = false;
  for (const spot of matsOf(ctx, lead)) {
    const g = guestById(ctx, spot.serving);
    if (g?.state !== 'served' || !g.classDay) continue;
    completeClass(ctx, spot, g, staff);
    held = true;
  }
  if (held) ctx.s.stats.classes++;
}

/**
 * As a day begins, class-goers whose class day is long gone without a class give up and go home: no Instructor came,
 * or they never got to a spot. Anyone in a class going on now stays for the end of it.
 */
export function giveUp(ctx: SimContext) {
  const today = Math.floor(ctx.s.day);
  for (const g of [...ctx.s.guests]) {
    if (!g.classDay || g.goal !== 'class' || g.state === 'leaving' || today < g.classDay + CLASS_PATIENCE) continue;
    const spot = g.state === 'served' ? ctx.world.item(g.station) : undefined;
    if (spot && classPlaying(ctx, spot)) continue;
    missClass(ctx, g);
  }
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
 * enough ago.
 */
export function announceClasses(ctx: SimContext) {
  const today = Math.floor(ctx.s.day);
  if (!offeringOn(ctx.s, 'qigong') || !ctx.s.open) return;
  if (ctx.classCalled !== undefined && today - ctx.classCalled < CLASS_CALL_GAP) return;
  if (studios(ctx).some((r) => classOn(r, today) && r.booked?.day === today && r.booked.count > 0)) {
    emit(ctx, { type: 'announce', text: classLine(ctx.classCalls ?? 0) });
    ctx.classCalled = today;
    ctx.classCalls = (ctx.classCalls ?? 0) + 1;
  }
}
