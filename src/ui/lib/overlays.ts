// The overlays that color the floor by how something stands: how pleasant, quiet or warm it is, how patient or needy
// the guests are, how fresh the staff, how well kept the furniture. Each tile gets a value from 0 (bad) to 1 (good),
// except temperature, which runs from cold through just right to hot.

import { HAMPER_SIZE, type IconId, isWatered, ITEMS } from '../../core/data';
import { footprintTiles } from '../../core/footprint';
import { calmness } from '../../core/sim/noise';
import type { PlacePreview } from '../../core/sim/preview';
import type { Sim } from '../../core/sim/sim';
import { tempScale } from '../../core/sim/warmth';
import { footprint } from '../../core/world';
import type { HeatTile, Palette } from '../../render/heatmap';

/** What the floor can be colored by. */
export type OverlayMode = 'decor' | 'calm' | 'temperature' | 'patience' | 'needs' | 'energy' | 'upkeep';

/** An overlay as the picker lists it, with what its colors mean when it is not simply poor to good. */
export interface OverlayDef {
  id: OverlayMode;
  icon: IconId;
  name: string;
  desc: string;
  palette?: Palette;
  /** What the two ends of its key say, and the middle, if not poor and good. */
  ends?: readonly [low: string, high: string];
}

/** Each overlay, as the picker lists it, with what its colors mean. */
export const OVERLAYS: readonly OverlayDef[] = [
  { id: 'decor', icon: 'overlay-decor', name: 'Surroundings', desc: 'How pleasant each spot is to wait in.' },
  {
    id: 'calm',
    icon: 'overlay-calm',
    name: 'Calm',
    desc: 'How quiet each spot is. Noise near a table spoils treatments.',
  },
  {
    id: 'temperature',
    icon: 'overlay-temperature',
    name: 'Temperature',
    desc: 'How warm each spot is: blue too cold, green just right, red too hot.',
    palette: 'temperature',
    ends: ['Cold', 'Hot'],
  },
  { id: 'patience', icon: 'overlay-patience', name: 'Patience', desc: 'How patient each guest is.' },
  { id: 'needs', icon: 'overlay-needs', name: 'Needs', desc: 'How thirsty, hungry or desperate each guest is.' },
  { id: 'energy', icon: 'overlay-energy', name: 'Staff energy', desc: 'How fresh each member of staff is.' },
  { id: 'upkeep', icon: 'overlay-upkeep', name: 'Upkeep', desc: 'How worn, dirty or dry each piece of furniture is.' },
];

/** How an overlay's values are colored. */
export const overlayPalette = (mode: OverlayMode | null): Palette | undefined =>
  OVERLAYS.find((o) => o.id === mode)?.palette;

/** A value kept between 0 and 1. */
const unit = (v: number) => Math.max(0, Math.min(1, v));

/**
 * How pleasant a tile is, from its patience drain: a bare floor (1.12) is middling, a quarter less drain from decor
 * nearby is the best, and a quarter more from litter or grime is the worst.
 */
export const pleasantness = (drain: number) => unit(0.5 + (1.12 - drain) * 2);

/**
 * The overlay to show while an item is in hand: the one showing, if it is one an item changes, or else the one for
 * what this item changes most, or none if it changes none of them.
 */
export function previewMode(p: PlacePreview, showing: OverlayMode | null): OverlayMode | null {
  if (showing === 'decor' || showing === 'calm' || showing === 'temperature') return showing;
  if (p.decor) return 'decor';
  // a treatment table minds the noise where it goes, though it makes none
  if (p.noise || ITEMS[p.placed.type].station?.goal === 'treat') return 'calm';
  if (p.heat) return 'temperature';
  return null;
}

/** The tiles to color for an overlay, and how good things are on each, with an item in hand counted as if it were down. */
export function heatTiles(sim: Sim, mode: OverlayMode, preview: PlacePreview | null = null): HeatTile[] {
  const s = sim.s;
  const w = sim.world;
  const out: HeatTile[] = [];
  /** What the item in hand would add to a tile, from one of its grids. */
  const extra = (grid: Float32Array | null | undefined, i: number) => (grid ? (grid[i] ?? 0) : 0);
  switch (mode) {
    case 'decor':
      // decor placed while the game is paused counts at once
      sim.refreshAmbience();
      for (const [x, y] of footprintTiles(w.building)) {
        const i = w.idx(x, y);
        if (!w.blocked[i]) out.push([x, y, pleasantness(sim.drainFactor(x, y, extra(preview?.decor, i)))]);
      }
      break;
    case 'calm':
    case 'temperature':
      // items placed while the game is paused count at once
      sim.refreshAmbience();
      for (const [x, y] of footprintTiles(w.building)) {
        const i = w.idx(x, y);
        if (!w.blocked[i])
          out.push([
            x,
            y,
            mode === 'calm'
              ? calmness(sim.noiseAt(x, y, extra(preview?.noise, i)))
              : tempScale(sim.warmthAt(x, y, extra(preview?.heat, i))),
          ]);
      }
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
        if (isWatered(it.type) || it.type === 'stone_warmer') parts.push(it.water / 100);
        if (it.type === 'linen_hamper') parts.push(1 - it.water / HAMPER_SIZE);
        if (!parts.length) continue;
        const v = unit(Math.min(...parts));
        for (const [x, y] of footprint(it)) out.push([x, y, v]);
      }
      break;
  }
  return out;
}
