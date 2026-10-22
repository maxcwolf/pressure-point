// The advisor: the next thing worth telling the player, and announcements over the speakers.

import type { Role } from '../data';
import {
  ANNOUNCEMENTS,
  conditionOf,
  DIRT_FILTHY,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  DISCOMFORT_NOTICE,
  IDEAL_TEMP,
  isWatered,
  ITEMS,
  MODALITIES,
  MODALITY_ORDER,
  modalityLabel,
  OVERDRAFT_RATE,
  ROLES,
  ROOMS,
  SEND_HOME_REP,
  STONE_USE,
  WORSE_REP,
} from '../data';
import { an, article, money } from '../format';
import { pickFresh, rnd } from '../random';
import { offeringOn, unlockedUpTo } from '../state/game';
import type { Item } from '../state/types';
import { BOTTLENECK, bottleneck } from './bottleneck';
import type { SimContext } from './context';
import {
  cashflow,
  countdownLever,
  cutFirst,
  daysUntilBankrupt,
  loanLimit,
  payrollOutlook,
  projectedCashflow,
} from './economy';
import { emit, type Subject } from './events';
import { hamperWithRoom, hasLinens, isHamper, staleLinens } from './linens';
import { roomForModality } from './machines';
import { mishapAdvice } from './mishaps';
import { allStars, hasItem, hasRoom, hasStaff } from './progress';
import { stationStaff } from './sessions';
import { fedUp, refreshmentFor, wants } from './staff-needs';
import { aboutToQuit } from './staffing';
import { enabled, unlocked } from './treatments';
import { hasMechanic } from './upgrades';
import { discomfort, warmthAt } from './warmth';
import { aboutToWorsen, conditionDays } from './worsening';

/** Make an announcement over the speakers every so often. */
export function announce(ctx: SimContext, dt: number) {
  const s = ctx.s;
  s.announceT -= dt;
  if (s.announceT > 0) return;
  s.announceT = rnd(s, 40, 70);
  if (s.open)
    emit(ctx, { type: 'announce', text: contextAnnouncement(ctx) ?? pickFresh(s, ANNOUNCEMENTS, ctx.announced) });
}

/** One of the advisor's nudges, and what it is about when it is about someone or something in particular. */
export interface Advice {
  text: string;
  about?: Subject;
}

/** The advisor's current nudge, with what it is about. */
export function advise(ctx: SimContext): Advice {
  const n = nudge(ctx);
  return typeof n === 'string' ? { text: n } : n;
}

/** The advisor's current nudge, as text. */
export function advice(ctx: SimContext): string {
  return advise(ctx).text;
}

/** Work out the advisor's nudge: plain text, or text about someone or something. */
function nudge(ctx: SimContext): string | Advice {
  const s = ctx.s;
  // while a mishap has things stopped, they are not missing, so say so rather than ask for them
  const mishap = mishapAdvice(s);
  if (mishap) return mishap;
  if (!hasItem(ctx, 'reception_desk'))
    return 'Welcome! Open the Items menu and place a Reception Desk somewhere near the entrance.';
  if (!hasStaff(ctx, 'receptionist')) return 'A desk needs a face behind it. Hire a Receptionist from the Hire menu.';
  if (!hasRoom(ctx, 'consult'))
    return 'Guests need diagnosing. Pick a Consultation Room from the Rooms menu, drag out the floor, add a door, then place the furniture.';
  if (!hasStaff(ctx, 'consultant')) return 'Hire a Wellness Consultant to run the Consultation Room.';
  if (!hasRoom(ctx, 'massage')) return 'Now the main event: build a Massage Suite.';
  if (!hasStaff(ctx, 'therapist')) return 'Hire a Massage Therapist and the knots will start untying themselves.';
  const quitting = s.staff.find(aboutToQuit);
  if (quitting)
    return {
      text: `${quitting.name} is about to quit! Select them and give them a raise, or build a Staff Room so they can rest.`,
      about: { kind: 'staff', id: quitting.id },
    };
  // a guest about to go home worse off costs more than anything below, and the way out is in the player's hands
  const [worst, ...others] = aboutToWorsen(s);
  if (worst) {
    const days = Math.max(1, Math.ceil(conditionDays(worst)));
    const more = others.length ? `, and ${others.length} more ${others.length === 1 ? 'is' : 'are'} close behind` : '';
    return {
      text: `${worst.name} goes home worse off in about ${days} day${days === 1 ? '' : 's'}${more}: −${WORSE_REP} reputation each. Move them up their line, or send them home for −${SEND_HOME_REP}.`,
      about: { kind: 'guest', id: worst.id },
    };
  }
  const tired = s.staff.some((x) => x.energy < 20);
  if (tired && !hasRoom(ctx, 'staffroom'))
    return 'Your staff members are worn out and working slowly. Build a Staff Room so they can take breaks.';
  if (s.guests.some((g) => g.bladder > 85) && !hasRoom(ctx, 'restroom'))
    return 'Guests are crossing their legs. A Restroom would be a kindness.';
  if (s.litter.length >= 3 && !hasStaff(ctx, 'caretaker'))
    return 'Litter is piling up. Hire a Caretaker to keep the place clean.';
  const wilting = s.items.find((i) => isWatered(i.type) && i.water < 20);
  if (wilting && !hasStaff(ctx, 'caretaker'))
    return { text: 'Your plants are wilting. A Caretaker will water them.', about: { kind: 'item', id: wilting.id } };
  const filthy = s.items.find((i) => i.dirt >= DIRT_FILTHY && !hasLinens(i));
  if (filthy && !hasStaff(ctx, 'caretaker'))
    return {
      text: 'The toilets are filthy and guests are noticing. Hire a Caretaker to clean them.',
      about: { kind: 'item', id: filthy.id },
    };
  const days = daysUntilBankrupt(s);
  if (days !== null) {
    const flow = cashflow(s);
    return `The bank calls the overdraft in in ${Math.ceil(days)} days: ${money(-s.money)} in the red, and losing ${money(-flow.net)} a month (${money(flow.income)} coming in against ${money(flow.wages)} in wages and ${money(flow.interest)} interest). Get the bank above zero, or the books into profit. ${countdownLever(s, Math.max(1, Math.ceil(days)))}`;
  }
  if (s.offer) return 'There is an emergency on offer at the top of the screen. Accept it only if you can cope.';
  // with a Caretaker on the payroll, a breakdown waits below the money, the lines and comfort: it is in hand
  const broken = s.items.find((i) => i.wear >= 100);
  if (broken && !hasStaff(ctx, 'caretaker'))
    return {
      text: `${an(ITEMS[broken.type].name, true)} has broken down. Hire a Caretaker to repair it.`,
      about: { kind: 'item', id: broken.id },
    };
  const waiting = s.items.find((i) => i.upgradePaid);
  if (waiting && !hasMechanic(s))
    return {
      text: `An upgrade for the ${ITEMS[waiting.type].name} is waiting. Send a Caretaker on the Mechanics course to install it.`,
      about: { kind: 'item', id: waiting.id },
    };
  if (offeringOn(s, 'qigong') && hasRoom(ctx, 'qigong') && !hasStaff(ctx, 'instructor'))
    return 'Your Qi Gong Studio is ready for its first class. Hire a Qi Gong Instructor to lead it.';
  const comfort = comfortAdvice(ctx);
  if (comfort) return comfort;
  // a raise request waits on a card of its own at the side of the screen, leaving the advisor for other things
  if (s.money < 0 && s.loan < loanLimit(s)) {
    const red = `You are ${money(-s.money)} in the red, which costs ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month and worries the staff`;
    // a loan while the books lose money only buys time, and spends the room the next payday needs
    return projectedCashflow(s) < 0
      ? `${red}, and you are losing about ${money(-projectedCashflow(s))} a month. ${cutFirst(s)} Then a loan from the Money menu is cheaper than the red for what is left, but it only buys time: once it is used up, the bank calls the overdraft in.`
      : `${red}. A loan from the Money menu is cheaper.`;
  }
  if (s.money < 0 && s.bankruptcyOn)
    return `You are ${money(-s.money)} in the red at ${(OVERDRAFT_RATE * 100).toFixed(0)}% a month, with the loan used up. You are making about ${money(projectedCashflow(s))} a month, so it will clear; a payday with the books losing money, and the bank calls the overdraft in.`;
  const payday = paydayAdvice(ctx);
  if (payday) return payday;
  const gap = modalityAdvice(ctx);
  if (gap) return gap;
  for (const it of s.items) {
    const st = ITEMS[it.type].station;
    if (!st || !ctx.world.usable(it)) continue;
    // with nobody in the role at all; one away on a break or a course is for the bottleneck to explain
    if (it.queue.length >= 2 && !stationStaff(ctx, it) && !hasStaff(ctx, st.staff))
      return {
        text: `Guests are lining up for a ${stationPlace(it)} with nobody staffing it. Hire a ${ROLES[st.staff].name}.`,
        about: { kind: 'item', id: it.id },
      };
  }
  const held = bottleneckAdvice(ctx);
  if (held) return held;
  const fix = repairAdvice(ctx);
  if (fix) return fix;
  if (s.guests.length > 4 && !s.items.some((i) => i.type === 'bench'))
    return 'Standing guests lose patience quickly. Put some Benches in the corridors.';
  if (s.guests.some((g) => g.thirst > 85) && !hasItem(ctx, 'tea_station'))
    return 'Guests are parched. A Herbal Tea Station would help, and it earns a little too.';
  if (allStars(ctx)) return 'Three stars! Every treatment is open to you. Keep the guests coming back.';
  return 'Looking good. Keep an eye on the objectives to earn your next star.';
}

/**
 * Whether the center is short of money for the payday ahead: the bank calling the overdraft in, or the wages not
 * covered at the pace by the bank alone. Growth waits while it is.
 */
export function moneyFirst(s: SimContext['s']): boolean {
  if (s.insolvency) return true;
  if (!s.bankruptcyOn) return false;
  const o = payrollOutlook(s);
  return o.wages > 0 && o.covered !== 'yes';
}

/** Nudge about a payday the bank and the pace will not cover: the money first, before any new staff or rooms. */
function paydayAdvice(ctx: SimContext): string {
  const s = ctx.s;
  if (s.insolvency || !moneyFirst(s)) return '';
  const o = payrollOutlook(s);
  const left = Math.max(1, Math.ceil(o.daysLeft));
  const when = `Payday in ${left} day${left === 1 ? '' : 's'}`;
  const head =
    o.covered === 'borrowing'
      ? `${when} is covered only by borrowing, ${money(o.short)} short at this pace.`
      : `${when} is ${money(o.short)} short, past what the bank will lend.`;
  // short past the loan with the books losing money, the cut that works, by name. Not in the first month, whose pace
  // is a few days' takings and says nothing yet about whether the books lose money
  if (o.covered === 'no' && o.net < 0 && s.months.length > 0)
    return `${head} No new staff or rooms until the takings cover the wages. The books are losing ${money(-o.net)} a month. ${cutFirst(s)}`;
  return `${head} No new staff or rooms until the takings cover the wages.`;
}

/** What one more of a role would be paid: the cheapest applicant for it, or the role's standard pay. */
export function newSalary(s: SimContext['s'], role: Role): number {
  const asks = s.candidates.filter((c) => c.role === role).map((c) => c.salary);
  return asks.length ? Math.min(...asks) : ROLES[role].baseSalary;
}

/**
 * Nudge about the stage of a visit holding guests up most, if one is: its line, and why it is slow, from how its
 * stations have done over the last few days. Short-staffed, it needs someone there more; flat out, more stations. Each
 * weighs the payroll first: a hire the books cannot carry at the pace, or that the bank cannot pay for, gives way to
 * the lever that can. Nothing while the money for payday comes first.
 */
export function bottleneckAdvice(ctx: SimContext): Advice | null {
  const s = ctx.s;
  if (moneyFirst(s)) return null;
  const stage = bottleneck(ctx);
  if (!stage) return null;
  const top = stage.stations.reduce((a, b) => (b.queue.length > a.queue.length ? b : a));
  const def = ITEMS[top.type].station;
  if (!def) return null;
  const role = ROLES[def.staff].name;
  const about: Subject = { kind: 'item', id: top.id };
  const n = stage.stations.length;
  const head = `Guests wait longest for the ${stationPlace(top)}: ${stage.waiting} waiting for ${n === 1 ? 'one' : n} ${ITEMS[top.type].name}${n === 1 ? '' : 's'}.`;
  /** A share as a percentage. */
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // what one more of the role would leave the books making, and what it and its place would take from the bank
  const salary = newSalary(s, def.staff);
  const after = cashflow(s).net - salary;
  const where = ITEMS[top.type].where;
  const place =
    ITEMS[top.type].cost + (where === 'corridor' || where === 'any' || where === 'outdoors' ? 0 : ROOMS[where].cost);
  const inRed = `Another ${role} would put the books ${money(-after)} a month in the red: raise prices, or wait for the pace to grow.`;
  /** Too dear to build now: what it would take, and what the bank has. */
  const saveUp = (cost: number) =>
    `${cost === salary ? `A month's wage for another ${role}` : `Another ${ITEMS[top.type].name} with a month's wage for a ${role}`} comes to ${money(cost)}, and the bank has ${money(s.money)}: save up for it first.`;
  if (stage.staffed < BOTTLENECK.staffed) {
    const crew = s.staff.filter((st) => st.role === def.staff && st.state !== 'leaving');
    const team = crew.length;
    const empty = `${head} It stood empty ${pct(1 - stage.staffed)} of the last few days.`;
    // enough on the books, but one still on the way or out for days: that ends of itself, and a hire would outlast it
    const coming = crew.filter((st) => st.state === 'arriving').length;
    const out = crew.filter((st) => st.training !== null || st.call !== null).length;
    if (team >= n && team - coming - out < n)
      return {
        text: `${empty} ${
          coming
            ? `A new ${role} is on the way, and will take it on when they arrive.`
            : `${out === 1 ? `A ${role} is` : `${out} ${role}s are`} away on a course or a house call, and it will be staffed again when they are back.`
        }`,
        about,
      };
    // enough on the books, but away on breaks: shorter breaks keep it going, and cost no wage
    if (team >= n)
      return {
        text: `${empty} ${team === 1 ? `Its ${role} keeps` : `Its ${role}s keep`} being called away to breaks or other work. ${
          hasRoom(ctx, 'staffroom')
            ? 'A Staff Room nearer by would keep it going.'
            : 'Build a Staff Room nearby, so their breaks are shorter.'
        }`,
        about,
      };
    const fewer = `${empty} There are more of them than ${role}s`;
    if (after < 0) return { text: `${fewer}. ${inRed}`, about };
    if (s.money < salary) return { text: `${fewer}. ${saveUp(salary)}`, about };
    return { text: `${fewer}: hire another.`, about };
  }
  const grow = after >= 0 && s.money >= place + salary;
  const short = after < 0 ? inRed : saveUp(place + salary);
  if (stage.busy >= BOTTLENECK.flatOut)
    return {
      text: `${head} It has been busy ${pct(stage.busy)} of the time. ${grow ? `Another ${ITEMS[top.type].name} and a ${role} to work it would move them along.` : short}`,
      about,
    };
  return {
    text: `${head} More skilled ${role}s work faster${grow ? `, or another ${ITEMS[top.type].name} would share the load` : ''}.`,
    about,
  };
}

/**
 * Nudge about something broken that no Caretaker has taken on yet, with Caretakers on the payroll: one they are on
 * the way to or repairing is in hand and goes unsaid.
 */
function repairAdvice(ctx: SimContext): Advice | null {
  const s = ctx.s;
  /** Whether a Caretaker is on the way to it or repairing it. */
  const handled = (it: Item) => s.staff.some((st) => st.id === it.claimedBy && st.job?.id === it.id);
  const broken = s.items.find((i) => i.wear >= 100 && !handled(i));
  if (!broken) return null;
  return {
    text: `${an(ITEMS[broken.type].name, true)} has broken down. Your Caretaker will get to it, if repairs are among their duties and it is somewhere they work.`,
    about: { kind: 'item', id: broken.id },
  };
}

/** Nudge about stale linens, a building too cold or too hot, and staff with nothing to drink. */
export function comfortAdvice(ctx: SimContext): string | Advice {
  const s = ctx.s;
  const stale = s.items.find(staleLinens);
  if (stale && !hamperWithRoom(ctx))
    return {
      text: s.items.some(isHamper)
        ? 'The Linen Hamper is full and the treatment tables need fresh linens. A Caretaker will launder it, and a second hamper helps.'
        : 'The linens on the treatment tables are stale. Place a Linen Hamper so a Caretaker can change them.',
      about: { kind: 'item', id: stale.id },
    };
  if (stale && !hasStaff(ctx, 'caretaker'))
    return {
      text: 'The linens on the treatment tables are stale. Hire a Caretaker to change them.',
      about: { kind: 'item', id: stale.id },
    };
  const waiting = s.guests.filter((g) => g.state === 'waiting');
  const uneasy = waiting.filter((g) => discomfort(warmthAt(ctx, g.tx, g.ty)) >= DISCOMFORT_NOTICE);
  if (uneasy.length >= 3) {
    const hot = uneasy.filter((g) => warmthAt(ctx, g.tx, g.ty) > IDEAL_TEMP).length * 2 > uneasy.length;
    return hot
      ? 'Guests are sweltering while they wait. Air Conditioners would cool things down; the Temperature overlay shows where.'
      : 'Guests are shivering while they wait. Radiators would warm the place up; the Temperature overlay shows where.';
  }
  const parched = s.staff.find((st) => wants(st) && !refreshmentFor(ctx, st, wants(st) ?? 'drink'));
  if (parched && fedUp(parched))
    return {
      text: `${parched.name} has nothing to drink or eat and is fed up. Staff use the Water Coolers, Tea Stations and Snack Machines too.`,
      about: { kind: 'staff', id: parched.id },
    };
  return '';
}

/** Nudge about modalities guests are waiting for that the center cannot deliver. */
function modalityAdvice(ctx: SimContext): string | Advice {
  const s = ctx.s;
  for (const m of MODALITY_ORDER) {
    const def = MODALITIES[m];
    if (!unlocked(ctx, m)) continue;
    const wanted = s.guests.some((g) => g.goal === 'treat' && conditionOf(g.condition).modality === m);
    if (!wanted) continue;
    const role = ROLES[DISCIPLINES[def.discipline].role];
    const room = ROOMS[roomForModality(m)];
    const staff = s.staff.filter((x) => x.role === role.role && x.state !== 'leaving');
    const an = article(role.name);
    if (!staff.length) return `Guests need ${modalityLabel(m)}. Hire ${an} ${role.name} for your ${room.name}.`;
    const studying = staff.some((x) => x.training?.course === m);
    if (!staff.some((x) => x.quals.includes(m)) && !studying) {
      return hasRoom(ctx, 'training')
        ? `Guests need ${modalityLabel(m)} and nobody is qualified. Select ${an} ${role.name} and send them on the course.`
        : `Guests need ${modalityLabel(m)} and nobody is qualified. Build a Training Room, then train ${an} ${role.name}.`;
    }
    if (def.equipment) {
      const eq = ITEMS[def.equipment];
      const have = s.items.filter((i) => i.type === def.equipment && ctx.world.usable(i));
      if (!have.length)
        return `${modalityLabel(m)} needs a ${eq.name} in the ${room.name}. You'll find it in the Items menu.`;
      const warmer = have[0];
      if (warmer && def.equipment === 'stone_warmer' && have.every((i) => i.water < STONE_USE))
        return {
          text: hasStaff(ctx, 'caretaker')
            ? 'The massage stones have gone cold. Your Caretaker is stretched thin.'
            : 'The massage stones have gone cold. Hire a Caretaker to keep the Stone Warmer hot.',
          about: { kind: 'item', id: warmer.id },
        };
    }
  }
  // a newly available discipline nobody has set up yet
  for (const d of DISCIPLINE_ORDER) {
    const def = DISCIPLINES[d];
    const room = ROOMS[def.room];
    if (!def.optional || !enabled(ctx, d) || unlockedUpTo(s) < (room.unlock ?? 0) || hasRoom(ctx, def.room)) continue;
    return `${def.name} is now available. Build ${article(room.name)} ${room.name} and hire ${article(ROLES[def.role].name)} ${ROLES[def.role].name} to bring in a new kind of guest.`;
  }
  return '';
}

/** What to call the place a station is in: its room, or the item itself in a corridor. */
export function stationPlace(it: Pick<Item, 'type'>): string {
  const where = ITEMS[it.type].where;
  return where === 'corridor' || where === 'any' || where === 'outdoors' ? ITEMS[it.type].name : ROOMS[where].name;
}

/** What the speakers say when a station has a line and nobody working it. */
export function staffWanted(it: Pick<Item, 'type'>): string {
  const st = ITEMS[it.type].station;
  return st ? `${ROLES[st.staff].name} needed at the ${stationPlace(it)}.` : '';
}

/** What the speakers say when litter piles up. */
export const CARETAKER_WANTED = 'Caretaker needed. The corridors are getting gross.';

/** An announcement about something that needs attention right now, if anything does. */
export function contextAnnouncement(ctx: SimContext): string | null {
  for (const it of ctx.s.items) {
    const st = ITEMS[it.type].station;
    if (st && ctx.world.usable(it) && it.queue.length >= 2 && !stationStaff(ctx, it)) return staffWanted(it);
  }
  if (ctx.s.litter.length >= 4) return CARETAKER_WANTED;
  return null;
}
