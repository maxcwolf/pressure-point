// Where people arrive and leave: a set walk along the pavement from the front door, however wide the lot, where they
// grow from nothing and shrink away rather than pop in and out of sight.
import { describe, expect, it } from 'vitest';

import { CENTERS, SIDEWALK_Y } from '../../src/core/data';
import { footprintOf } from '../../src/core/footprint';
import { lotWidth } from '../../src/core/land';
import { streetEnds } from '../../src/core/sim/chars';
import { streetFade } from '../../src/render/people';

describe('the ends of the street', () => {
  for (const center of Object.values(CENTERS)) {
    it(`are on the map at ${center.name}`, () => {
      for (const x of streetEnds(footprintOf(center.plot))) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(lotWidth(center));
      }
    });
  }
});

describe('someone arriving or leaving', () => {
  const ends = [2, 29];
  const y = SIDEWALK_Y + 0.5;

  it('is drawn at nothing on the spot they arrive at or leave from', () => {
    expect(streetFade(2.5, y, ends)).toBe(0);
    expect(streetFade(29.5, y, ends)).toBe(0);
  });

  it('is drawn full size a tile along the pavement, and anywhere off it', () => {
    expect(streetFade(3, y, ends)).toBeCloseTo(0.5);
    expect(streetFade(3.5, y, ends)).toBe(1);
    expect(streetFade(15, y, ends)).toBe(1);
    expect(streetFade(2.5, SIDEWALK_Y - 0.5, ends)).toBe(1);
  });
});
