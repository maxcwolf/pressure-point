// The words and countdowns for a mishap's notice, and for items it has taken out of action.

import type { MishapDef } from '../../core/data';
import { MISHAP_NOTICE_DAYS } from '../../core/data';
import { daysInWords } from '../../core/sim/mishaps';
import type { Mishap } from '../../core/state/types';
import { clamp } from '../../core/util';
import { timeLeftLabel } from './emergency';
import type { IconLine } from './icon-line';

/** When a mishap coming starts, in words. */
export const startsIn = (days: number) => `Starts in ${daysInWords(days)}`;

/** How much of the notice is left before a mishap starts, as a share. */
export const noticeShare = (days: number) => clamp(days / MISHAP_NOTICE_DAYS, 0, 1);

/**
 * How ready the center is for a mishap coming: prepared, kept at bay by something of its own (`holder`, by name),
 * warded by a Shaman or about to be, or not at all.
 */
export function readiness(m: Pick<Mishap, 'prepared' | 'ward'>, holder?: string): string {
  if (m.prepared) return 'prepared';
  if (holder) return `the ${holder} is ready`;
  if (m.ward === 'done') return 'warded';
  return m.ward ? 'a Shaman will ward it off' : 'not prepared';
}

/**
 * The one line shown for a mishap once it is prepared for, kept at bay by something of the center's own (`holder`, by
 * name), warded, put aside, or under way.
 */
export function mishapLine(def: MishapDef, m: Mishap, daysLeft: number, holder?: string): string {
  if (m.started)
    return `${def.name}: ${timeLeftLabel(daysLeft)}${m.prepared ? ' · prepared' : holder ? ` · the ${holder} is on` : ''}`;
  return `${def.name}: ${startsIn(daysLeft).toLowerCase()} · ${readiness(m, holder)}`;
}

/** What preparing for a mishap would do, for its notice. */
export const preparedNote = (def: MishapDef) =>
  `Prepared, ${def.prepare.effect.charAt(0).toLowerCase()}${def.prepare.effect.slice(1)}`;

/** What an item taken out of action by a mishap says about it. */
export const stoppedLabel = (def: MishapDef) => `Out of action: ${def.name.toLowerCase()}`;

/** How a treatment's equipment stands, for the Treatments menu: working, stopped by a mishap, or missing. */
export function kitNote(name: string, working: boolean, stoppedBy: MishapDef | undefined): IconLine & { ok: boolean } {
  if (working) return { ok: true, text: `✔ ${name} installed` };
  if (stoppedBy)
    return { ok: false, icon: stoppedBy.icon, text: `${name} out of action: ${stoppedBy.name.toLowerCase()}` };
  return { ok: false, icon: 'ui-warning', text: `Needs a ${name} in the room` };
}
