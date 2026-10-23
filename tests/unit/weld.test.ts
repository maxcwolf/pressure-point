// The welded outline behind the Treatments button: a circle with a plate round the word, joined with fillets.
import { describe, expect, it } from 'vitest';

import { PLATE_ROOM, weldPath, weldShape } from '../../src/ui/lib/weld';

/** The numbers in a path, in order. */
const numbers = (d: string) => d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

describe('the welded outline', () => {
  it('is the plain circle when the plate stays inside it', () => {
    const { d, yMax } = weldPath(66, { cy: 10, hx: 20, hy: 8 });
    expect(d).toBe('M 0 -31.5 A 31.5 31.5 0 1 1 0 31.5 A 31.5 31.5 0 1 1 0 -31.5 Z');
    expect(yMax).toBe(31.5);
  });

  it('steps out round a plate wider than the circle at its height, meeting it above and below with fillets', () => {
    // the 66 px button with its 11 px label: the word's box is 57 by 13 at 41 px down
    const { d, yMax } = weldPath(66, { cy: 15, hx: 35.5, hy: 9.5 }, 3, 3.5);
    // one closed path that starts at the top of the circle and ends there
    expect(d.startsWith('M 0 -31.5 A 31.5 31.5 0 0 1 ')).toBe(true);
    expect(d.endsWith('A 31.5 31.5 0 0 1 0 -31.5 Z')).toBe(true);
    // four fillets, two end caps, and the circle in four arcs
    expect(d.match(/A 3\.5 3\.5 /g)).toHaveLength(4);
    expect(d.match(/A 8 8 /g)).toHaveLength(2);
    expect(d.match(/A 31\.5 31\.5 /g)).toHaveLength(4);
    // it reaches no lower than the circle, and out past it on both sides by the same amount
    expect(yMax).toBe(31.5);
    const farthest = Math.max(...numbers(d));
    expect(farthest).toBeGreaterThan(31.5);
    expect(d).toContain(` ${farthest} `);
    expect(d).toContain(` -${farthest} `);
  });

  it('hangs the plate below the circle when its bottom edge is at or below it', () => {
    const { d, yMax } = weldPath(66, { cy: 25, hx: 40, hy: 11 }, 3, 5);
    expect(yMax).toBe(34.5);
    expect(d).toContain('L -');
    // no fillet on the way back up: just the two from the top of the plate
    expect(d.match(/A 5 5 /g)).toHaveLength(2);
  });

  it('is drawn where the word is, with room round it, in a viewBox that is the button itself', () => {
    const shape = weldShape(66, { top: 41, width: 57, height: 13 });
    // the plate's bottom edge runs to its left end cap: the word's half width plus its room, less the stroke and the cap
    const cap = 13 / 2 + PLATE_ROOM.y - 1.5;
    const end = 57 / 2 + PLATE_ROOM.x - 1.5 - cap;
    const bottom = 41 + 13 / 2 - 33 + cap;
    expect(shape.d).toContain(`L -${end} ${bottom}`);
    expect(shape.viewBox).toBe('-33 -33 66 66');
    expect(shape.d).toContain('A 3.5 3.5');
  });
});
