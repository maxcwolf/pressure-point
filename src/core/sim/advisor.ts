// The advisor: the next thing worth telling the player, and announcements over the speakers.

import {
  ANNOUNCEMENTS,
  conditionOf,
  DIRT_FILTHY,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  DISCOMFORT_NOTICE,
  IDEAL_TEMP,
  ITEMS,
  LOAN_MAX,
  MODALITIES,
  MODALITY_ORDER,
  modalityLabel,
  ROLES,
  ROOMS,
  STONE_USE,
} from '../data';
import { pickFresh, rnd } from '../random';
import { unlockedUpTo } from '../state/game';
import type { Item } from '../state/types';
import type { SimContext } from './context';
import { emit, type Subject } from './events';
import { hamperWithRoom, hasLinens, isHamper, staleLinens } from './linens';
import { allStars, hasItem, hasRoom, hasStaff } from './progress';
import { fedUp, refreshmentFor, wants } from './staff-needs';
import { aboutToQuit } from './staffing';
import { enabled, unlocked } from './treatments';
import { discomfort, warmthAt } from './warmth';

/** Make an announcement over the speakers every so often. */
export function announce(ctx: SimContext, dt: number) {
  const s = ctx.s;
  s.announceT -= dt;
  if (s.announceT > 0) return;
  s.announceT = rnd(40, 70);
  if (s.open)
    emit(ctx, { type: 'announce', text: contextAnnouncement(ctx) ?? pickFresh(ANNOUNCEMENTS, ctx.announced) });
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
  const tired = s.staff.some((x) => x.energy < 20);
  if (tired && !hasRoom(ctx, 'staffroom'))
    return 'Your staff members are worn out and working slowly. Build a Staff Room so they can take breaks.';
  if (s.guests.some((g) => g.bladder > 85) && !hasRoom(ctx, 'restroom'))
    return 'Guests are crossing their legs. A Restroom would be a kindness.';
  if (s.litter.length >= 3 && !hasStaff(ctx, 'caretaker'))
    return 'Litter is piling up. Hire a Caretaker to keep the place clean.';
  const wilting = s.items.find((i) => i.type === 'plant' && i.water < 20);
  if (wilting && !hasStaff(ctx, 'caretaker'))
    return { text: 'Your plants are wilting. A Caretaker will water them.', about: { kind: 'item', id: wilting.id } };
  const filthy = s.items.find((i) => i.dirt >= DIRT_FILTHY && !hasLinens(i));
  if (filthy && !hasStaff(ctx, 'caretaker'))
    return {
      text: 'The toilets are filthy and guests are noticing. Hire a Caretaker to clean them.',
      about: { kind: 'item', id: filthy.id },
    };
  if (s.offer) return 'There is an emergency on offer at the top of the screen. Accept it only if you can cope.';
  const broken = s.items.find((i) => i.wear >= 100);
  if (broken)
    return {
      text: hasStaff(ctx, 'caretaker')
        ? `A ${ITEMS[broken.type].name} has broken down. Your Caretaker will get to it.`
        : `A ${ITEMS[broken.type].name} has broken down. Hire a Caretaker to repair it.`,
      about: { kind: 'item', id: broken.id },
    };
  const comfort = comfortAdvice(ctx);
  if (comfort) return comfort;
  // a raise request waits on a card of its own at the side of the screen, leaving the advisor for other things
  if (s.money < 0 && s.loan < LOAN_MAX) return 'You are in the red. A loan from the Money menu would tide you over.';
  const gap = modalityAdvice(ctx);
  if (gap) return gap;
  for (const it of s.items) {
    const st = ITEMS[it.type].station;
    if (!st || !ctx.world.usable(it)) continue;
    const about: Subject = { kind: 'item', id: it.id };
    if (it.queue.length >= 2 && !it.staffId)
      return {
        text: `Guests are lining up for a ${stationPlace(it)} with nobody staffing it. Hire another ${ROLES[st.staff].name}.`,
        about,
      };
    if (it.queue.length >= 6)
      return { text: `The line for the ${stationPlace(it)} is getting long. Build another and staff it.`, about };
  }
  if (s.guests.length > 4 && !s.items.some((i) => i.type === 'bench'))
    return 'Standing guests lose patience quickly. Put some Benches in the corridors.';
  if (s.guests.some((g) => g.thirst > 85) && !hasItem(ctx, 'tea_station'))
    return 'Guests are parched. A Herbal Tea Station would help, and it earns a little too.';
  if (allStars(ctx)) return 'Three stars! Every treatment is open to you. Keep the guests coming back.';
  return 'Looking good. Keep an eye on the objectives to earn your next star.';
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
    const room = ROOMS[DISCIPLINES[def.discipline].room];
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

/** "a" or "an", to go before a name. */
export const article = (name: string) => (/^[AEIOU]/.test(name) ? 'an' : 'a');

/** What to call the place a station is in: its room, or the item itself in a corridor. */
export function stationPlace(it: Pick<Item, 'type'>): string {
  const where = ITEMS[it.type].where;
  return where === 'corridor' || where === 'any' ? ITEMS[it.type].name : ROOMS[where].name;
}

/** What the speakers say when a station has a line and nobody working it. */
export function staffWanted(it: Pick<Item, 'type'>): string {
  const st = ITEMS[it.type].station;
  return st ? `${ROLES[st.staff].name} needed at the ${stationPlace(it)}.` : '';
}

/** An announcement about something that needs attention right now, if anything does. */
export function contextAnnouncement(ctx: SimContext): string | null {
  for (const it of ctx.s.items) {
    const st = ITEMS[it.type].station;
    if (st && ctx.world.usable(it) && it.queue.length >= 2 && !it.staffId) return staffWanted(it);
  }
  if (ctx.s.litter.length >= 4) return 'Caretaker needed. The corridors are getting crunchy.';
  return null;
}
