// Working out what a blueprint still needs.

import type { ItemType } from '../../core/data';

/** Which required items are already placed: one answer per requirement, in the order they are asked for. */
export function placedFlags(required: readonly ItemType[], missing: readonly ItemType[]): boolean[] {
  const left = [...missing];
  return required.map((type) => {
    const at = left.indexOf(type);
    if (at < 0) return true;
    left.splice(at, 1);
    return false;
  });
}
