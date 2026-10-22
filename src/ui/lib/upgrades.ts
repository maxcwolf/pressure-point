// What a machine's inspector says about its upgrades: its level, what that does, and how the next one is coming on.

import { UPGRADE_LEVELS, UPGRADE_SUCCESS, UPGRADE_WEAR } from '../../core/data';
import type { Item, Staff } from '../../core/state/types';
import type { IconLine } from './icon-line';

/** What a level does, in a few words: how much more slowly it wears, and how much more often treatments work. */
export function upgradeEffect(level: number): string {
  if (level <= 0) return 'Not upgraded yet';
  const wear = Math.round((1 - (UPGRADE_WEAR[level] ?? 1)) * 100);
  const success = Math.round(level * UPGRADE_SUCCESS * 100);
  return `Wears ${wear}% more slowly · treatments work ${success}% more often`;
}

/** The stars for a level: filled for each level installed, hollow for the rest. */
export function upgradeStars(level: number): string {
  return '★'.repeat(level) + '☆'.repeat(Math.max(0, UPGRADE_LEVELS - level));
}

/** Who staffs a station, or why nobody does: it is closed while a Mechanic installs an upgrade, or it needs someone. */
export function staffingStatus(it: Item, staff: Staff | undefined, role: string): IconLine {
  if (staff) return { text: `Staffed by ${staff.name}` };
  if (it.upgradePaid && it.claimedBy && !it.serving)
    return { icon: 'bubble-installing', text: 'Closed while an upgrade is installed' };
  return { icon: 'ui-warning', text: `Needs a ${role}` };
}

/** How an upgrade that has been paid for is coming on, or '' if none is: waiting, on the way, or being installed. */
export function installStatus(it: Item, staff: readonly Staff[]): string {
  if (!it.upgradePaid) return '';
  const mechanic = staff.find((st) => st.job?.kind === 'install' && st.job.id === it.id);
  if (!mechanic) return 'Waiting for a Mechanic to install the upgrade';
  if (mechanic.state !== 'doingJob') return `${mechanic.name} is on the way to install the upgrade`;
  return it.serving
    ? `${mechanic.name} will install the upgrade once this guest is done`
    : `${mechanic.name} is installing the upgrade`;
}
