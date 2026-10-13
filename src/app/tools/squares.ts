// The squares beside a piece of furniture that people use it from, and who each is for.

import { type AccessRole, ITEMS, type ItemType } from '../../core/data';
import { accessTile } from '../../core/world';
import type { HeldItem } from './types';

export const STAFF_ICON = '🧑‍⚕️';
export const GUEST_ICON = '🧍';

/** The ways of using an item that belong to staff. Every other way belongs to guests. */
const STAFF_ROLES: readonly AccessRole[] = ['staff', 'rest', 'study'];

/** Whether a way of using an item belongs to staff rather than guests. */
export function isStaffRole(role: AccessRole): boolean {
  return STAFF_ROLES.includes(role);
}

/** A square someone uses an item from. */
export interface UseSquare {
  x: number;
  y: number;
  staff: boolean;
}

/** The squares an item would be used from if it were put down at a tile. */
export function useSquares(item: HeldItem & { x: number; y: number }): UseSquare[] {
  return ITEMS[item.type].access.map((a, i) => {
    const [x, y] = accessTile(item, i);
    return { x, y, staff: isStaffRole(a.role) };
  });
}

/** A line for the hint saying what the colored squares mean, when the item has any. */
export function legend(type: ItemType): string {
  const staffed = ITEMS[type].access.map((a) => isStaffRole(a.role));
  const parts = [];
  if (staffed.includes(true)) parts.push(`${STAFF_ICON} purple square: staff`);
  if (staffed.includes(false)) parts.push(`${GUEST_ICON} orange square: guests`);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}
