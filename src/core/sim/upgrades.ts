// Upgrading treatment equipment: paid for from its inspector, then installed by a Caretaker with the Mechanics course.
// Each level makes it wear out more slowly and treatments there work more often.

import { ITEMS, type ItemType, UPGRADE_LEVELS, UPGRADE_PRICE, UPGRADE_SUCCESS, UPGRADE_WEAR } from '../data';
import { money } from '../format';
import { starsEarned } from '../state/game';
import type { GameState, Item } from '../state/types';
import { hasGeneral } from './careers';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, toast } from './events';

/** What upgrading a piece of equipment to a level costs: a share of its upgrade price, to the nearest $50. */
export function upgradeCost(type: ItemType, level: number): number {
  const share = UPGRADE_PRICE[level - 1] ?? 0;
  return Math.round(((ITEMS[type].upgrade ?? 0) * share) / 50) * 50;
}

/** Everything paid to upgrade a piece of equipment: the levels installed, and one paid for and waiting, if any. */
export function upgradeSpent(it: Pick<Item, 'type' | 'level' | 'upgradePaid'>): number {
  let total = 0;
  const top = it.level + (it.upgradePaid ? 1 : 0);
  for (let level = 1; level <= top; level++) total += upgradeCost(it.type, level);
  return total;
}

/** How fast equipment at a level wears, against how fast it would without upgrades. */
export const upgradeWear = (level: number) => UPGRADE_WEAR[level] ?? 1;

/** What a level adds to the chance of a treatment working on the equipment. */
export const upgradeSuccess = (level: number) => level * UPGRADE_SUCCESS;

/**
 * Why a piece of equipment cannot be upgraded right now, or '' if it can: it is not the kind that can, it is at the
 * top level, an upgrade is already waiting, the next level is not unlocked yet, or it cannot be afforded.
 */
export function cannotUpgrade(s: GameState, it: Item): string {
  if (ITEMS[it.type].upgrade === undefined) return 'It cannot be upgraded';
  if (it.level >= UPGRADE_LEVELS) return 'Fully upgraded';
  if (it.upgradePaid) return 'An upgrade is waiting to be installed';
  const next = it.level + 1;
  if (next > starsEarned(s)) return `Level ${next} unlocks at star ${next}`;
  if (s.money < upgradeCost(it.type, next)) return 'Not enough money';
  return '';
}

/** Whether there is a Caretaker on the payroll who can install upgrades. */
export function hasMechanic(s: GameState): boolean {
  return s.staff.some((st) => st.role === 'caretaker' && st.state !== 'leaving' && hasGeneral(st, 'mechanics'));
}

/** Pay for the next upgrade to a piece of equipment, for a Mechanic to install. False if it cannot be upgraded now. */
export function orderUpgrade(ctx: SimContext, id: number): boolean {
  const it = ctx.world.item(id);
  if (!it || cannotUpgrade(ctx.s, it)) return false;
  const cost = upgradeCost(it.type, it.level + 1);
  spend(ctx, cost, 'building');
  it.upgradePaid = true;
  const name = ITEMS[it.type].name;
  toast(
    ctx,
    hasMechanic(ctx.s)
      ? `Upgrade for the ${name} bought for ${money(cost)}. A Mechanic will install it.`
      : `Upgrade for the ${name} bought for ${money(cost)}. It needs a Caretaker with the Mechanics course to install it.`,
    'good',
    { kind: 'item', id: it.id },
  );
  emit(ctx, { type: 'sfx', name: 'cash' });
  return true;
}

/** Finish installing the upgrade waiting on a piece of equipment: it goes up a level, freshly serviced. */
export function installUpgrade(ctx: SimContext, it: Item) {
  if (!it.upgradePaid) return;
  it.upgradePaid = false;
  it.level = Math.min(UPGRADE_LEVELS, it.level + 1);
  it.wear = 0;
  ctx.world.version++;
  toast(ctx, `The ${ITEMS[it.type].name} is upgraded to level ${it.level}.`, 'good', { kind: 'item', id: it.id });
  emit(ctx, { type: 'sfx', name: 'build' });
}
