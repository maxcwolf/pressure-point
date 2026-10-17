// What the game says about which discipline guests come for, and why: in a room's inspector and the Stats menu.

import { DISCIPLINES, modalityLabel, ROOMS } from '../../core/data';
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

/**
 * The one thing that would draw the most more guests to a discipline, as advice: training, word of mouth or the room.
 * Nothing when it is doing well on all three.
 */
export function demandAdvice(row: DisciplineDemand): string | null {
  const name = DISCIPLINES[row.discipline].name;
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

/** How the shares are made, for the top of the panel. */
export const DEMAND_INTRO =
  'Each new guest picks a discipline by its pull, then a condition within it. Its pull is how popular it is, times its following, its finest room and how much of it your staff are trained for. A following grows with every guest healed, shrinks with every one let down, and fades slowly when nobody comes.';
