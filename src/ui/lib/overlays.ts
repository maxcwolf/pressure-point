// The overlays that color the floor by how something stands: how pleasant it is, how patient or needy the guests
// are, how fresh the staff, how well kept the furniture. Each tile gets a value from 0 (bad) to 1 (good).

import { ITEMS } from '../../core/data';
import type { Sim } from '../../core/sim/sim';
import { footprint, tileIdx } from '../../core/world';
import type { HeatTile } from '../../render/heatmap';

/** What the floor can be colored by. */
export type OverlayMode = 'decor' | 'patience' | 'needs' | 'energy' | 'upkeep';

/** Each overlay, as the picker lists it, with what its colors mean. */
export const OVERLAYS: readonly { id: OverlayMode; icon: string; name: string; desc: string }[] = [
  { id: 'decor', icon: '🌿', name: 'Surroundings', desc: 'How pleasant each spot is to wait in.' },
  { id: 'patience', icon: '⏳', name: 'Patience', desc: 'How patient each guest is.' },
  { id: 'needs', icon: '🍵', name: 'Needs', desc: 'How thirsty, hungry or desperate each guest is.' },
  { id: 'energy', icon: '⚡', name: 'Staff energy', desc: 'How fresh each member of staff is.' },
  { id: 'upkeep', icon: '🔧', name: 'Upkeep', desc: 'How worn, dirty or dry each piece of furniture is.' },
];

/** A value kept between 0 and 1. */
const unit = (v: number) => Math.max(0, Math.min(1, v));

/**
 * How pleasant a tile is, from its patience drain: a bare floor (1.12) is middling, a quarter less drain from decor
 * nearby is the best, and a quarter more from litter or grime is the worst.
 */
export const pleasantness = (drain: number) => unit(0.5 + (1.12 - drain) * 2);

/** The tiles to color for an overlay, and how good things are on each. */
export function heatTiles(sim: Sim, mode: OverlayMode): HeatTile[] {
  const s = sim.s;
  const w = sim.world;
  const out: HeatTile[] = [];
  switch (mode) {
    case 'decor':
      // decor placed while the game is paused counts at once
      sim.refreshAmbience();
      for (let y = w.plot.y0; y <= w.plot.y1; y++)
        for (let x = w.plot.x0; x <= w.plot.x1; x++)
          if (w.inside(x, y) && !w.blocked[tileIdx(x, y)]) out.push([x, y, pleasantness(sim.drainFactor(x, y))]);
      break;
    case 'patience':
      for (const g of s.guests) if (g.state !== 'leaving') out.push([g.tx, g.ty, unit(g.patience / 100)]);
      break;
    case 'needs':
      for (const g of s.guests)
        if (g.state !== 'leaving') out.push([g.tx, g.ty, unit(1 - Math.max(g.thirst, g.hunger, g.bladder) / 100)]);
      break;
    case 'energy':
      for (const st of s.staff) if (st.state !== 'leaving') out.push([st.tx, st.ty, unit(st.energy / 100)]);
      break;
    case 'upkeep':
      for (const it of s.items) {
        const def = ITEMS[it.type];
        const parts: number[] = [];
        if (def.wear) parts.push(1 - it.wear / 100);
        if (def.dirt) parts.push(1 - it.dirt / 100);
        if (it.type === 'plant' || it.type === 'stone_warmer') parts.push(it.water / 100);
        if (!parts.length) continue;
        const v = unit(Math.min(...parts));
        for (const [x, y] of footprint(it)) out.push([x, y, v]);
      }
      break;
  }
  return out;
}
