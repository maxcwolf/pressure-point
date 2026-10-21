// The squares beside a piece of furniture that people use it from, and who each is for.

import { type AccessRole, ITEMS, type ItemType, ROLES } from '../../core/data';
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

/** Who works an item: the role that staffs it if it is a station, or any member of staff, with an icon for each. */
export function workedBy(type: ItemType): { icon: string; name: string } {
  const role = ITEMS[type].station?.staff;
  return role ? { icon: ROLES[role].icon, name: ROLES[role].name } : { icon: STAFF_ICON, name: 'staff' };
}

/** A square someone uses an item from, and the icon for who. */
export interface UseSquare {
  x: number;
  y: number;
  staff: boolean;
  icon: string;
}

/** The squares an item would be used from if it were put down at a tile. */
export function useSquares(item: HeldItem & { x: number; y: number }): UseSquare[] {
  return ITEMS[item.type].access.map((a, i) => {
    const [x, y] = accessTile(item, i);
    const staff = isStaffRole(a.role);
    return { x, y, staff, icon: staff ? workedBy(item.type).icon : GUEST_ICON };
  });
}

/** A line for the hint saying what the colored squares mean, when the item has any. */
export function legend(type: ItemType): string {
  const staffed = ITEMS[type].access.map((a) => isStaffRole(a.role));
  const parts = [];
  if (staffed.includes(true)) parts.push(`purple square: ${workedBy(type).name}`);
  if (staffed.includes(false)) parts.push('orange square: guests');
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}
