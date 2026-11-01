// What the interface says about visitors: the report after a visit, and a visitor's progress round the center, or a
// firefighter's to the fire.

import {
  ASPECT_NOTES,
  BRIBE_OFFERS,
  BRIBE_RECHECK_DAYS,
  BRIBE_REP,
  EXTINGUISHER_REACH,
  INSPECTION_ALLOWED,
  INSPECTION_FINE,
  INSPECTION_REP,
  INSPECTOR_ROOMS,
  MUSHROOM_FINE,
  VIP_DELIGHTED,
  VIP_DISAPPOINTED,
} from '../../core/data';
import { money } from '../../core/format';
import type { Subject } from '../../core/sim/events';
import { MUSHROOMS_FOUND } from '../../core/sim/mushrooms';
import { refusedFine } from '../../core/sim/visits';
import type { GameState, RoomVerdict, Visitor, VisitReport } from '../../core/state/types';
import type { IconLine } from './icon-line';

/** The heading of a visit's report. */
export function reportHeading(r: VisitReport): IconLine {
  if (r.visit === 'vip') return { icon: 'ui-vip', text: `${r.name}'s visit` };
  return { icon: 'bubble-inspecting', text: r.outcome === 'warned' ? 'The inspection: a warning' : 'The inspection' };
}

/** So many things, in words: "one thing", "3 things". */
const things = (n: number) => (n === 1 ? 'one thing' : `${n} things`);

/** What a visit came to, in a sentence: the verdict, and what it brought in or cost. */
export function reportSummary(r: VisitReport): string {
  const rep = r.rep ? ` ${r.rep > 0 ? '+' : ''}${r.rep}% reputation.` : '';
  switch (r.outcome) {
    case 'delighted':
      return `${r.name} loved it, scoring the center ${r.score} out of 100, and left ${money(r.money)}.${rep}`;
    case 'satisfied':
      return `${r.name} thought it was fine: ${r.score} out of 100.${rep}`;
    case 'disappointed':
      return `${r.name} was disappointed: ${r.score} out of 100.${rep}`;
    case 'passed':
      return r.score ? `Passed, with ${things(r.score)} to put right.` : `Passed, with nothing to put right.${rep}`;
    case 'warned':
      return `Failed, with ${things(r.score)} wrong. This time it is only a warning: no fine, and no hit to reputation.`;
    case 'failed':
      if (r.bribes)
        return `Failed, with ${things(r.score)} wrong: a ${money(-r.money)} fine and ${r.rep}% reputation, unless it goes away.`;
      if (r.refused !== undefined)
        return `Failed, with ${things(r.score)} wrong, and the ${money(r.refused)} offered was turned down: a ${money(-r.money)} fine.${rep}`;
      return `Failed, with ${things(r.score)} wrong: a ${money(-r.money)} fine.${rep}`;
    case 'paid off':
      return `Failed, but it went away for ${money(-r.money)}.${rep}`;
  }
}

/** How the inspector decides, in a sentence. */
export const inspectionRule = () =>
  `The inspector checks up to ${INSPECTOR_ROOMS} rooms, chosen at random, and lets ${things(INSPECTION_ALLOWED)} go: any more fails the inspection.`;

/**
 * What a warning means for the next inspection: what to do before it, and what failing it will cost, with what this one
 * would have.
 */
export function warningNote(r: VisitReport): string {
  const mushrooms = r.rooms.some((v) => v.problems.includes(MUSHROOMS_FOUND))
    ? `, ${money(MUSHROOM_FINE)} more for magic mushrooms,`
    : '';
  return `Put right what is listed before the inspector calls again. The next inspection failed will be fined ${money(INSPECTION_FINE)} for each thing wrong${mushrooms} and cost ${INSPECTION_REP}% reputation: this one would have been ${money(r.waived ?? 0)}.`;
}

/** What an offer to make a failed inspection go away reads as on its button: how much, and the chance it is taken. */
export function offerLabel(price: number, i: number): string {
  return `Offer ${money(price)} (${Math.round((BRIBE_OFFERS[i]?.odds ?? 0) * 100)}% chance)`;
}

/** What an offer turned down costs, for a failed inspection still to be settled. */
export function refusalNote(r: VisitReport): string {
  return `An offer turned down costs you nothing itself, but the fine goes up to ${money(refusedFine(-r.money))}, word gets out (another ${BRIBE_REP}% reputation), and the inspector is back within ${BRIBE_RECHECK_DAYS} days.`;
}

/** What each thing the inspector can find wrong reads as, and what to do about it before they call again. */
const PROBLEMS: Readonly<Record<string, { what: string; fix: string }>> = {
  dirty: {
    what: 'Dirty: litter on the floor, or something filthy',
    fix: 'Hire enough Caretakers to keep up with the cleaning, and make sure they can get in.',
  },
  'broken equipment': {
    what: 'Broken equipment',
    fix: 'Caretakers repair equipment as it wears: hire another, so nothing is left to break.',
  },
  'no Fire Extinguisher nearby': {
    what: 'No Fire Extinguisher near the door',
    fix: `Place a Fire Extinguisher within ${EXTINGUISHER_REACH} tiles of the door, or fit the room with sprinklers.`,
  },
  [MUSHROOMS_FOUND]: {
    what: 'Magic mushrooms under the Shop Counter',
    fix: 'Stop selling them, or turn on Hide from inspector in the Policy menu.',
  },
};

/** One thing the inspector found wrong, in plain words, and what to do about it. */
export function problemNote(problem: string): { what: string; fix: string } {
  return PROBLEMS[problem] ?? { what: `${problem.charAt(0).toUpperCase()}${problem.slice(1)}`, fix: '' };
}

/** Where to show the player a room the inspector found wrong: the room, or the Shop Counter, while it stands. */
export function problemSpot(s: GameState, v: RoomVerdict): Subject | null {
  if (!v.problems.length) return null;
  if (v.problems.includes(MUSHROOMS_FOUND)) {
    const counter = s.items.find((it) => it.type === 'shop_counter');
    return counter ? { kind: 'item', id: counter.id } : null;
  }
  return s.rooms.some((r) => r.id === v.room) ? { kind: 'room', id: v.room } : null;
}

/** What the last inspection found wrong in a room that still is, of what the inspector would find there now. */
export function stillWrong(r: VisitReport | null, room: number, now: readonly string[]): string[] {
  if (r?.visit !== 'inspector') return [];
  return r.rooms.find((v) => v.room === room)?.problems.filter((p) => now.includes(p)) ?? [];
}

/** Whether a room went down well, badly or neither, to color its line in a report. */
export function verdictTone(v: RoomVerdict): 'good' | 'bad' | '' {
  if (v.problems.length) return 'bad';
  if (v.score >= VIP_DELIGHTED) return 'good';
  return v.score < VIP_DISAPPOINTED ? 'bad' : '';
}

/** Who a visitor is and what they look for, for their inspector. */
export function visitorLine(v: Visitor): string {
  if (v.visit === 'firefighter') return 'A firefighter, here for the fire.';
  if (v.visit === 'inspector')
    return 'The health inspector, checking every room for dirt, broken equipment and a Fire Extinguisher near its door, or sprinklers.';
  return `${v.title.charAt(0).toUpperCase()}${v.title.slice(1)}, who cares most about ${ASPECT_NOTES[v.cares ?? 'decor'].name}.`;
}

/** What a visitor is doing, in a few words, given the name of the room they are seeing or heading for. */
export function visitorStatus(v: Visitor, roomName: string | undefined): string {
  if (v.visit === 'firefighter')
    return v.state === 'hosing'
      ? 'Hosing out the fire'
      : v.state === 'toTruck'
        ? 'Heading back to the truck'
        : 'Running to the fire';
  if (v.state === 'leaving') return 'On the way out, to write it all up';
  if (!roomName) return 'Deciding where to look next';
  return v.state === 'looking' ? `Looking round the ${roomName}` : `On the way to the ${roomName}`;
}
