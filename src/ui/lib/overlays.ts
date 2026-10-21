// The overlays: how pleasant, quiet or warm the floor is, how worn the furniture, and how patient or needy the guests
// are and how fresh the staff. The floor's values run from 0 to 1 with ordinary at a half, drawn clear, so only what
// stands out shows: bad to good, or for temperature cold to hot. People are ringed by how they are doing, 0 to 1.

import { HAMPER_SIZE, isWatered, ITEMS, NOISE_PEACEFUL } from '../../core/data';
import { footprintTiles } from '../../core/footprint';
import { calmness } from '../../core/sim/noise';
import type { PlacePreview } from '../../core/sim/preview';
import type { Sim } from '../../core/sim/sim';
import { tempScale } from '../../core/sim/warmth';
import type { Guest, Staff } from '../../core/state/types';
import { footprint } from '../../core/world';
import type { HeatTile, Palette } from '../../render/heatmap';

/** What the floor can be colored by. */
export type OverlayMode = 'decor' | 'calm' | 'temperature' | 'patience' | 'needs' | 'energy' | 'upkeep';

/**
 * How an overlay's key is drawn: `diverging` worse through clear to better, `temperature` cold through clear to hot,
 * `harm` worse fading to clear, and `condition` worse through amber to fine, for the rings round people.
 */
export type OverlayKey = 'diverging' | 'temperature' | 'harm' | 'condition';

/** An overlay as the picker lists it, with what its colors mean. */
export interface OverlayDef {
  id: OverlayMode;
  icon: string;
  name: string;
  desc: string;
  palette?: Palette;
  key: OverlayKey;
  /** What the two ends of its key say. */
  ends: readonly [low: string, high: string];
}

/** Each overlay, as the picker lists it, with what its colors mean. */
export const OVERLAYS: readonly OverlayDef[] = [
  {
    id: 'decor',
    icon: '🌿',
    name: 'Surroundings',
    desc: 'How pleasant each spot is to wait in: green nicer, red grimmer, clear a bare floor.',
    key: 'diverging',
    ends: ['Grim', 'Pleasant'],
  },
  {
    id: 'calm',
    icon: '🤫',
    name: 'Calm',
    desc: 'Where it is noisy: amber to red. Noise near a table spoils treatments.',
    key: 'harm',
    ends: ['Loud', 'Quiet'],
  },
  {
    id: 'temperature',
    icon: '🌡️',
    name: 'Temperature',
    desc: 'Where it is too cold (blue) or too hot (red). Clear is comfortable.',
    palette: 'temperature',
    key: 'temperature',
    ends: ['Cold', 'Hot'],
  },
  {
    id: 'patience',
    icon: '⏳',
    name: 'Patience',
    desc: 'A ring round each guest, green while patient, red near leaving.',
    key: 'condition',
    ends: ['Leaving', 'Patient'],
  },
  {
    id: 'needs',
    icon: '🍵',
    name: 'Needs',
    desc: 'A ring round each guest, red when thirsty, hungry or desperate.',
    key: 'condition',
    ends: ['Desperate', 'Fine'],
  },
  {
    id: 'energy',
    icon: '⚡',
    name: 'Staff energy',
    desc: 'A ring round each member of staff, green fresh, red worn out.',
    key: 'condition',
    ends: ['Worn out', 'Fresh'],
  },
  {
    id: 'upkeep',
    icon: '🔧',
    name: 'Upkeep',
    desc: 'Furniture that is worn, dirty or dry: amber to red. Clear is well kept.',
    key: 'harm',
    ends: ['Neglected', 'Kept'],
  },
];

/** The overlays that ring people rather than color the floor. */
export const ringsPeople = (mode: OverlayMode | null): mode is 'patience' | 'needs' | 'energy' =>
  mode === 'patience' || mode === 'needs' || mode === 'energy';

/** How an overlay's values are colored. */
export const overlayPalette = (mode: OverlayMode | null): Palette | undefined =>
  OVERLAYS.find((o) => o.id === mode)?.palette;

/** A value kept between 0 and 1. */
const unit = (v: number) => Math.max(0, Math.min(1, v));

/**
 * How a tile's calm shows on the floor: ordinary (a half, drawn clear) down to the peaceful mark, where a guest on the
 * table stops calling it peaceful, then toward 0 as it gets loud. A building with nothing noisy in it shows nothing.
 */
export const quietness = (noise: number) => 0.5 * unit(calmness(noise) / calmness(NOISE_PEACEFUL));

/** How a piece of furniture's upkeep shows on the floor: well kept is ordinary (a half, drawn clear), neglected 0. */
export const upkeepShown = (kept: number) => 0.5 * unit(kept);

/** How someone is doing on a people overlay, from 0 to 1, or null to leave them unringed. */
export function personValue(mode: OverlayMode, c: Guest | Staff): number | null {
  if (c.state === 'leaving') return null;
  if (c.kind === 'guest') {
    if (mode === 'patience') return unit(c.patience / 100);
    if (mode === 'needs') return unit(1 - Math.max(c.thirst, c.hunger, c.bladder) / 100);
    return null;
  }
  return mode === 'energy' ? unit(c.energy / 100) : null;
}

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

/** The tiles to color for an overlay, and how things stand on each, with an item in hand counted as if it were down. */
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
      // the tiles under furniture too, so the field runs on beneath it rather than leaving a hole
      for (const [x, y] of footprintTiles(w.building)) {
        const i = w.idx(x, y);
        out.push([x, y, pleasantness(sim.drainFactor(x, y, extra(preview?.decor, i)))]);
      }
      break;
    case 'calm':
    case 'temperature':
      // items placed while the game is paused count at once
      sim.refreshAmbience();
      for (const [x, y] of footprintTiles(w.building)) {
        const i = w.idx(x, y);
        out.push([
          x,
          y,
          mode === 'calm'
            ? quietness(sim.noiseAt(x, y, extra(preview?.noise, i)))
            : tempScale(sim.warmthAt(x, y, extra(preview?.heat, i))),
        ]);
      }
      break;
    case 'patience':
    case 'needs':
    case 'energy':
      // these ring the people themselves, not the floor
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
        const v = upkeepShown(Math.min(...parts));
        for (const [x, y] of footprint(it)) out.push([x, y, v]);
      }
      break;
  }
  return out;
}
