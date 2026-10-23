// The office blocks round the Exchange stand back from the lot, so from whichever side the camera is turned to they
// hide none of the center, its plots or the rival's storefront, and none stands on a street or on another block.
import { describe, expect, it } from 'vitest';

import { CENTERS, H, ROAD_Y } from '../../src/core/data';
import { lotWidth } from '../../src/core/land';
import { blockHeight } from '../../src/render/models/downtown';
import { officeBlocks } from '../../src/render/scenery';

/** How far back a thing this tall hides the ground behind it, along each way, from the camera's height. */
const hides = (h: number) => (h * Math.SQRT2) / 1.2 / Math.SQRT2 + 0.2;

/** The ground no block may hide: the lot, the road and the far pavement, and the storefront across it. */
const kept = (width: number) => ({ x0: 0, x1: width, z0: 0, z1: ROAD_Y[1] + 1 + 0.8 + 6 });

/** A block's footprint on the ground. */
const footprint = (b: { x: number; z: number; w: number; d: number }) => ({
  x0: b.x - b.w / 2,
  x1: b.x + b.w / 2,
  z0: b.z - b.d / 2,
  z1: b.z + b.d / 2,
});

describe('the office blocks round the Exchange', () => {
  const width = lotWidth(CENTERS.exchange);
  const blocks = officeBlocks(width);

  it('surround the lot on every side', () => {
    expect(blocks.some((b) => b.z < 0)).toBe(true);
    expect(blocks.some((b) => b.z > H)).toBe(true);
    expect(blocks.some((b) => b.x < 0)).toBe(true);
    expect(blocks.some((b) => b.x > width)).toBe(true);
  });

  it('stand far enough back to hide none of the lot from any side', () => {
    const k = kept(width);
    for (const b of blocks) {
      const f = footprint(b);
      // how far clear of the kept ground the block stands, along x and along z
      const dx = Math.max(k.x0 - f.x1, f.x0 - k.x1, 0);
      const dz = Math.max(k.z0 - f.z1, f.z0 - k.z1, 0);
      expect(Math.max(dx, dz), `block ${b.seed}`).toBeGreaterThan(hides(blockHeight(b)));
    }
  });

  it('keep off the streets and off one another', () => {
    const rects = blocks.map(footprint);
    /** Whether two rectangles overlap. */
    const overlap = (a: (typeof rects)[number], b: (typeof rects)[number]) =>
      a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1)) expect(overlap(a, b)).toBe(false);
      expect(overlap(a, { x0: -1e3, x1: 1e3, z0: ROAD_Y[0], z1: ROAD_Y[1] + 1 })).toBe(false);
      expect(overlap(a, { x0: -1e3, x1: 1e3, z0: -6, z1: -3 })).toBe(false);
      expect(overlap(a, { x0: -6, x1: -3, z0: -1e3, z1: 1e3 })).toBe(false);
      expect(overlap(a, { x0: width + 3, x1: width + 6, z0: -1e3, z1: 1e3 })).toBe(false);
    });
  });
});
