// What the interface says about visitors: the report after a visit, and a visitor's progress round the center, or a
// firefighter's to the fire.

import { ASPECT_NOTES, VIP_DELIGHTED, VIP_DISAPPOINTED } from '../../core/data';
import { money } from '../../core/format';
import type { RoomVerdict, Visitor, VisitReport } from '../../core/state/types';
import type { IconLine } from './icon-line';

/** The heading of a visit's report. */
export function reportHeading(r: VisitReport): IconLine {
  return r.visit === 'inspector'
    ? { icon: 'bubble-inspecting', text: 'The inspection' }
    : { icon: 'ui-vip', text: `${r.name}'s visit` };
}

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
      return r.score
        ? `Passed, with ${r.score === 1 ? 'one thing' : `${r.score} things`} to put right.`
        : `Passed, with nothing to put right.${rep}`;
    case 'failed':
      return r.bribe === undefined
        ? `Failed, with ${r.score} things wrong: a ${money(-r.money)} fine.${rep}`
        : `Failed, with ${r.score} things wrong: a ${money(-r.money)} fine and ${r.rep}% reputation, unless it goes away.`;
    case 'paid off':
      return `Failed, but it went away for ${money(-r.money)}.${rep ? `${rep} Word got out.` : ''}`;
  }
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
