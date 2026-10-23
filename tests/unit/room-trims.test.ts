// A room's trim is the first thing that tells it from the room beside it, so no two rooms that can stand in the same
// center share one, or share one with the building's teal, for players who see every color and for the commonest kinds
// of color blindness. Colors are compared in OKLab, after the Machado (2009) simulation of each kind at full strength.
import { describe, expect, it } from 'vitest';

import { CENTERS, ROOM_ORDER, roomHere, ROOMS } from '../../src/core/data';
import { SHELL_TRIM } from '../../src/render/shared';

/** How each kind of vision sees linear red, green and blue: Machado, Oliveira and Fernandes (2009), severity 1. */
const VISION = {
  typical: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

/** A color as one kind of vision sees it, in OKLab. */
function seen(hex: number, matrix: readonly (readonly number[])[]) {
  const linear = [hex >> 16, (hex >> 8) & 255, hex & 255].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = matrix.map((row) =>
    Math.min(
      1,
      Math.max(
        0,
        row.reduce((sum, k, i) => sum + k * (linear[i] ?? 0), 0),
      ),
    ),
  ) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** How far apart two colors look, in hundredths of OKLab: about 2 is a just-noticeable difference side by side. */
const apart = (a: number, b: number, matrix: readonly (readonly number[])[]) => {
  const [p, q] = [seen(a, matrix), seen(b, matrix)];
  return Math.hypot(...p.map((v, i) => v - (q[i] ?? 0))) * 100;
};

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
