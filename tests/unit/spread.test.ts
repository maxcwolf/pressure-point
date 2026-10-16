// Spreading noise or warmth: the quick way, with each tile's walls worked out once, gives just what the plain way does.
import { describe, expect, it } from 'vitest';

import type { SimContext } from '../../src/core/sim/context';
import { noiseLeak } from '../../src/core/sim/noise';
import { type Leak, spreader } from '../../src/core/sim/spread';
import { addRestroom, addStaffRoom, openCenter } from './helpers';

/** Spread an amount around a spot the plain way, looking up the rooms on either side of the walls for every tile. */
function plainSpread(
  ctx: SimContext,
  grid: Float32Array,
  cx: number,
  cy: number,
  amount: number,
  radius: number,
  leak: Leak,
) {
  const { world } = ctx;
  if (!world.onMap(cx, cy)) return;
  const from = ctx.world.zoneAt(cx, cy);
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!world.onMap(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const to = ctx.world.zoneAt(x, y);
      const a = ctx.world.room(from);
      const b = ctx.world.room(to);
      const carry = from === to ? 1 : (a ? leak(a) : 1) * (b ? leak(b) : 1);
      const i = world.idx(x, y);
      grid[i] = grid[i]! + amount * (1 - d / (radius + 1)) * carry;
    }
}

describe('spreading something through the building', () => {
  it('gives just what spreading it the plain way does, through walls, windows and doors', () => {
    const { sim } = openCenter(1);
    addStaffRoom(sim);
    addRestroom(sim);
    for (const r of sim.s.rooms.slice(0, 2)) r.windows.push({ x: r.x + 1, y: r.y, dx: 0, dy: -1 });
    const ctx = (sim as unknown as { ctx: SimContext }).ctx;
    const { w: W, h: H } = ctx.world;
    const quick = new Float32Array(W * H);
    const plain = new Float32Array(W * H);
    const spread = spreader(ctx, noiseLeak);
    // sources everywhere, in rooms, in the corridor, at the edges and off the map
    for (let i = 0; i < 400; i++) {
      const x = ((i * 7) % (W + 4)) - 2;
      const y = ((i * 11) % (H + 4)) - 2;
      spread(quick, x, y, 1 + (i % 5), 3 + (i % 4));
      plainSpread(ctx, plain, x, y, 1 + (i % 5), 3 + (i % 4), noiseLeak);
    }
    expect(quick).toEqual(plain);
    expect(quick.some((v) => v > 0)).toBe(true);
  });
});
