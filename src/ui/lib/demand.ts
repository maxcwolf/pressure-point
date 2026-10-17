// What the game says about which discipline guests come for, and why: in a room's inspector and the Stats menu.

import { DISCIPLINES, modalityLabel, ROLES, ROOMS } from '../../core/data';
import type { Discipline } from '../../core/data/types';
import type { DisciplineDemand } from '../../core/sim/demand';

/** A multiplier as it reads, to two places at most: "×1.4", "×0.75", "×1". */
export const times = (n: number) => `×${Number(n.toFixed(2))}`;

/** What guests come for in a discipline, as a phrase: "massage therapy", "sound healing". */
const what = (d: Discipline) => DISCIPLINES[d].name.toLowerCase();

/** A line on how strongly a finished treatment room draws guests to its discipline. */
export function pullNote(pull: number, d: Discipline): string {
  const icon = DISCIPLINES[d].icon;
  const mats = d === 'sound';
  if (pull < 1.05)
    return `${icon} A prestigious, peaceful room${mats ? ' with mats to spare' : ''} draws more guests who want ${what(d)}.`;
  const why = mats ? 'its prestige, its peace and its mats' : 'its prestige and its peace';
  return `${icon} Draws ${pull.toFixed(1)}× the usual guests for ${what(d)}, for ${why}.`;
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

/** How many guests arrive for what the center offers: more for each discipline staffed past the first. */
export function offeringNote(staffed: number, arrivals: number): string {
  if (staffed <= 1)
    return 'Each discipline you add, with its room and a practitioner on the payroll, brings more guests in all.';
  return `${staffed} disciplines with a room and a practitioner bring guests ${times(arrivals)} as often as one would.`;
}

/** How many guests long lines keep away, for the top of the panel, or nothing if they keep nobody away. */
export function lineNote(arrivals: number): string | null {
  const away = Math.round((1 - arrivals) * 100);
  return away >= 1 ? `Long lines for treatment are keeping ${away}% of new guests away.` : null;
}

/** How the shares are made, for the top of the panel. */
export const DEMAND_INTRO =
  'Each new guest picks a discipline by its pull, then a condition within it. Its pull is how popular it is, times its following, its finest room, how much of it your staff are trained for, and how long its line is. A following grows with every guest healed, shrinks with every one let down, and fades slowly while nobody is treated. A discipline new to the center starts with a little; one that heals more guests than it fails grows.';
