// What the game says about which discipline guests come for, and why: in a room's inspector and the Stats menu.

import {
  CAPACITY_ARRIVALS,
  type CenterDef,
  CONSULT_FEEDS,
  DISCIPLINES,
  GUEST_CAP,
  ITEMS,
  MACHINE_DRAW,
  modalityLabel,
  ROLES,
  ROOMS,
} from '../../core/data';
import type { Discipline, ItemType } from '../../core/data/types';
import type { Capacity, DisciplineDemand, MachineDemand } from '../../core/sim/demand';
import { type ArrivalPace, staffedMachines } from '../../core/sim/guests';
import type { IconLine } from './icon-line';

/** A multiplier as it reads, to two places at most: "×1.4", "×0.75", "×1". */
export const times = (n: number) => `×${Number(n.toFixed(2))}`;

/** What guests come for in a discipline, as a phrase: "massage therapy", "sound healing". */
const what = (d: Discipline) => DISCIPLINES[d].name.toLowerCase();

/** A line on how strongly a finished treatment room draws guests to its discipline. */
export function pullNote(pull: number, d: Discipline): IconLine {
  const icon = DISCIPLINES[d].icon;
  const mats = d === 'sound';
  if (pull < 1.05)
    return {
      icon,
      text: `A prestigious, peaceful room${mats ? ' with mats to spare' : ''} draws more guests who want ${what(d)}.`,
    };
  const why = mats ? 'its prestige, its peace and its mats' : 'its prestige and its peace';
  return { icon, text: `Draws ${pull.toFixed(1)}× the usual guests for ${what(d)}, for ${why}.` };
}

/** A line on how strongly a signature machine's finished room draws guests for the machine's own ailments. */
export function machinePullNote(pull: number, machine: ItemType): IconLine {
  const { name, icon } = ITEMS[machine];
  if (pull < 1.05)
    return { icon, text: `A prestigious, peaceful room draws more guests for the ${name}’s own ailments.` };
  return { icon, text: `Draws ${pull.toFixed(1)}× the usual guests for the ${name}, for its prestige and its peace.` };
}

/** How widely a discipline is wanted before anything the player does, in a word. */
export function popularityWord(popularity: number): string {
  if (popularity >= 1) return 'Everyday';
  if (popularity >= 0.8) return 'Popular';
  if (popularity >= 0.7) return 'Fairly niche';
  return 'Niche';
}

/** How well known a discipline is, from its following, in a few words. */
export function followingWord(following: number): string {
  if (following < 10) return 'Barely known';
  if (following < 30) return 'Getting known';
  if (following < 60) return 'Well known';
  return 'Talked about everywhere';
}

/** What its finest room does for a discipline. */
export function roomWord(row: DisciplineDemand): string {
  const room = row.room.room;
  return room ? ROOMS[room.type].name : 'No room';
}

/** How much of what guests want the staff are trained for. */
export function trainingWord(row: DisciplineDemand): string {
  return `${row.trained} of ${row.conditions} conditions`;
}

/** What the guests waiting for a discipline wait for: its practitioners, or a Sound Healer's mats. */
function places(row: DisciplineDemand): string {
  const n = row.line.places;
  if (row.discipline === 'sound') return `${n} ${n === 1 ? 'mat' : 'mats'}`;
  const role = ROLES[DISCIPLINES[row.discipline].role].name;
  return `${n} ${n === 1 ? role : `${role}s`}`;
}

/** A discipline's line for treatment, in a few words. */
export function lineWord(row: DisciplineDemand): string {
  return row.line.places ? `${row.line.waiting} waiting for ${places(row)}` : `${row.line.waiting} waiting`;
}

/**
 * The one thing that would draw the most more guests to a discipline, as advice: a shorter line, training, word of
 * mouth or the room. Nothing when it is doing well on all four.
 */
export function demandAdvice(row: DisciplineDemand): string | null {
  const name = DISCIPLINES[row.discipline].name;
  if (row.line.factor < 0.99)
    return `The line for ${name.toLowerCase()} is putting new guests off: ${lineWord(row)}. Nobody minds until more than three wait for each, and those put off do not come at all. Another room and practitioner, or quicker treatment, would bring them back.`;
  if (row.untrained.length) {
    const list = row.untrained.slice(0, 3).map(modalityLabel).join(', ');
    return `Guests needing ${list} mostly stay away while nobody is trained in it. Courses in a Training Room bring them back.`;
  }
  if (row.following < 30)
    return `Few have heard of ${name.toLowerCase()} here yet. Every guest healed spreads the word, and every failure sets it back.`;
  if (row.room.pull < 1.5)
    return `A finer, quieter ${ROOMS[DISCIPLINES[row.discipline].room].name} would draw more: decor, windows, room to spare and less noise.`;
  return null;
}

/** A count of things as it reads: "1 station", "6 stations". */
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the center can treat at once, as a phrase: "6 staffed treatment stations". */
const stationsWord = (n: number) => count(n, 'staffed treatment station');

/** The staffed stations that draw guests, as a phrase: "6 staffed treatment stations", or "4 of 7 …" when the consultations cannot keep them all in guests. */
const fedWord = (c: Capacity) =>
  c.fed < c.stations ? `${c.fed} of ${stationsWord(c.stations)}` : stationsWord(c.stations);

/**
 * How often guests arrive, factor by factor, with the counts behind each: "About 28 new guests a month: 9 at 50%
 * reputation, ×1.6 for 6 staffed treatment stations, ×1.9 for the season, ×1.1 for its grade, less 8% kept away by
 * long lines."
 */
export function paceNote(p: ArrivalPace, reputation: number, center: CenterDef): string {
  const parts = [`${Math.round(p.base)} at ${Math.round(reputation)}% reputation`];
  const c = p.capacity;
  const more = `each one more brings ${Math.round(CAPACITY_ARRIVALS.each * 100)}% more`;
  if (c.fed > 1) {
    const fed =
      c.fed < c.stations
        ? ` (${count(c.consults, 'Consultation Room keeps', 'Consultation Rooms keep')} only ${c.fed} in guests)`
        : '';
    parts.push(`${times(p.staffed)} for ${fedWord(c)}${fed}`);
  } else parts.push(`${fedWord(c)} (${more})`);
  /** A factor, if it moves the pace at all. */
  const by = (f: number, why: string) => {
    if (Math.abs(f - 1) > 0.005) parts.push(`${times(f)} ${why}`);
  };
  by(p.parts.center, 'for this center');
  by(p.parts.time, center.rush ? 'for the rush hour, or the lull between' : 'for the season');
  by(p.parts.grade, 'for its grade');
  by(p.parts.rival, 'with the rival across the street');
  by(p.parts.mishap, 'while the mishap lasts');
  by(p.difficulty, 'for the difficulty');
  const away = Math.round((1 - p.lines) * 100);
  if (away >= 1) parts.push(`less ${away}% kept away by long lines`);
  const drawing = p.machines.filter((m) => m.perMonth > 0);
  if (!drawing.length) return `About ${Math.round(p.perMonth)} new guests a month: ${parts.join(', ')}.`;
  const tables = `${Math.round(p.tables)} come for the treatment stations: ${parts.join(', ')}.`;
  const machines = drawing.map((m) => machineNote(m.demand, m.perMonth));
  return [`About ${Math.round(p.perMonth)} new guests a month.`, tables, ...machines].join(' ');
}

/** Who runs a machine, as a phrase: "a Massage Therapist". */
const operator = (m: MachineDemand) => {
  const d = ITEMS[m.machine].station?.discipline ?? 'massage';
  return ROLES[DISCIPLINES[d].role].name;
};

/**
 * How many come for a signature machine's own ailments, and why: "6 come for the Kneadmaster 9000’s own ailments:
 * 45% of the center’s pace for the one with a Massage Therapist of its own to run it, ×1.4 for the Kneadmaster Suite."
 */
export function machineNote(m: MachineDemand, perMonth: number): string {
  const name = ITEMS[m.machine].name;
  const share = `${Math.round(MACHINE_DRAW * 100)}% of the center’s pace`;
  const each = m.staffed === 1 ? 'the one' : `each of the ${m.staffed}`;
  const parts = [`${share} for ${each} with a ${operator(m)} of its own to run it`];
  /** A factor, if it moves the draw at all. */
  const by = (f: number, why: string) => {
    if (Math.abs(f - 1) > 0.005) parts.push(`${times(f)} ${why}`);
  };
  by(m.room.pull, m.room.room ? `for the ${ROOMS[m.room.room.type].name}` : 'for its room');
  by(m.training, 'while nobody is trained to run it');
  by(m.flavour, 'for the local favourites');
  const away = Math.round((1 - m.line.factor) * 100);
  if (away >= 1) parts.push(`less ${away}% kept away by its line`);
  return `${Math.round(perMonth)} come for the ${name}’s own ailments: ${parts.join(', ')}.`;
}

/**
 * The treatment stations that draw nobody now, and why: more than the consultations can keep in guests, nobody on the
 * payroll to work them, or a practitioner away on a course or a house call. Nothing if every station draws.
 */
export function capacityNote(c: Capacity): string | null {
  const parts: string[] = [];
  const unfed = c.stations - c.fed;
  if (unfed)
    parts.push(
      `${count(unfed, 'staffed treatment station draws', 'staffed treatment stations draw')} nobody more: every guest is seen in a Consultation Room first, and each keeps only ${CONSULT_FEEDS} stations in guests. Another would let ${unfed === 1 ? 'it' : 'them'} draw, and let more in at once`,
    );
  if (c.idle)
    parts.push(
      `${count(c.idle, 'treatment station has', 'treatment stations have')} nobody on the payroll to work ${c.idle === 1 ? 'it' : 'them'}: a practitioner for each would bring guests more often and let more in at once`,
    );
  if (c.away)
    parts.push(
      `${count(c.away, 'treatment station stands', 'treatment stations stand')} idle while ${c.away === 1 ? 'its practitioner is' : 'their practitioners are'} away on a course or a house call, and draw${c.away === 1 ? 's' : ''} nobody until they are back`,
    );
  for (const m of c.machines) {
    const name = ITEMS[m.machine].name;
    const role = ROLES[DISCIPLINES[ITEMS[m.machine].station?.discipline ?? 'massage'].role].name;
    if (m.paid < m.standing)
      parts.push(
        `The ${name} draws nobody for its own ailments: it needs a ${role} of its own, past those its discipline’s tables keep busy. One more on the payroll would bring its guests, and let more in at once`,
      );
    else if (m.staffed < m.standing)
      parts.push(`The ${name} draws nobody while its ${role} is away on a course or a house call`);
  }
  return parts.length ? `${parts.join('. ')}.` : null;
}

/** The building's limit on guests at once, what it is made of, and what it has cost this month. */
export interface Limit {
  /** What the building lets in, the player's own limit if any, and how many are in now. */
  building: number;
  own: number | null;
  inside: number;
  /** Guests who found the center full this month. */
  away: number;
}

/** What would let more guests in at once, and how many: another staffed station, or a Consultation Room for those it cannot keep in guests. */
function moreRoom(c: Capacity): string {
  const unfed = c.stations - c.fed;
  if (!unfed) return `another staffed treatment station lets in ${GUEST_CAP.station} more`;
  const more = GUEST_CAP.consult + GUEST_CAP.station * Math.min(CONSULT_FEEDS, unfed);
  return `another staffed Consultation Room lets in ${more} more`;
}

/**
 * The limit on guests at once in words: "The building lets in 24 guests at once: 4, and 2 for each of 6 staffed
 * treatment stations and 4 for each of 2 staffed Consultation Rooms. 21 in now. 5 guests found it full this month and
 * went elsewhere, with their fees: another staffed treatment station lets in 2 more."
 */
export function limitNote(l: Limit, c: Capacity): string {
  const rooms =
    c.consults === 1
      ? `${GUEST_CAP.consult} for the staffed Consultation Room`
      : `${GUEST_CAP.consult} for each of ${count(c.consults, 'staffed Consultation Room')}`;
  const machines = staffedMachines(c);
  const run = machines ? `, ${count(machines, 'signature machine')} with someone to run it` : '';
  const made = `${GUEST_CAP.base}, and ${GUEST_CAP.station} for each of ${fedWord(c)}${run} and ${rooms}`;
  const own = l.own !== null && l.own < l.building ? ` Your own limit is ${l.own}.` : '';
  const away = l.away
    ? ` ${count(l.away, 'guest')} found it full this month and went elsewhere, with their fees: ${moreRoom(c)}${own ? ', or raise your own limit' : ''}.`
    : ' Nobody has found it full this month.';
  return `The building lets in ${count(l.building, 'guest')} at once: ${made}. ${l.inside} in now.${own}${away}`;
}

/** How the shares are made, for the top of the panel. */
export const DEMAND_INTRO =
  'Each new guest picks a discipline by its pull, then a condition within it. Its pull is how popular it is, times its following, its finest room, how much of it your staff are trained for, and how long its line is. A following grows with every guest healed, shrinks with every one let down, and fades slowly while nobody is treated. A discipline new to the center starts with a little; one that heals more guests than it fails grows.';
