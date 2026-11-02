// A room's trim is the first thing that tells it from the room beside it, so no two rooms that can stand in the same
// center share one, or share one with the building's teal, for players who see every color and for the commonest kinds
// of color blindness. Colors are compared in OKLab, after the Machado (2009) simulation of each kind at full strength.
import { describe, expect, it } from 'vitest';

import { CENTERS, ROOM_ORDER, roomHere, ROOMS } from '../../src/core/data';
import { SHELL_TRIM } from '../../src/render/shared';
import { apart, VISION } from './oklab';

describe('room trims', () => {
  for (const [vision, matrix] of Object.entries(VISION)) {
    // at a glance across a busy center a trim is a stripe a few pixels wide, so it needs more than a bare difference
    const least = vision === 'typical' ? 8 : 4;
    it(`tell every two rooms of a center apart, and from the building, with ${vision}`, () => {
      const close: string[] = [];
      for (const center of Object.keys(CENTERS) as (keyof typeof CENTERS)[]) {
        const trims: [string, number][] = [
          ['the building', SHELL_TRIM],
          ...ROOM_ORDER.filter((r) => roomHere(ROOMS[r], center)).map((r) => [r, ROOMS[r].trim] as [string, number]),
        ];
        for (const [i, [a, ta]] of trims.entries())
          for (const [b, tb] of trims.slice(i + 1)) {
            const d = apart(ta, tb, matrix);
            if (d < least) close.push(`${a} and ${b} at ${center}: ${d.toFixed(1)}`);
          }
      }
      expect([...new Set(close)]).toEqual([]);
    });
  }
});
