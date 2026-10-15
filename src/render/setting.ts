// What surrounds a center's building: the colors of the ground around it, a park's lawn, the seaside's sand, the
// mountains' snow or an orchard's grass.

import { centerOf } from '../core/data';
import type { GameState } from '../core/state/types';

/** The colors of a setting: the open ground in 3D, its two shades as drawn tile by tile, and the flecks on it. */
export interface Setting {
  ground: number;
  tiles: readonly [string, string];
  fleck: string;
}

/** The colors of each setting a center can have. */
export const SETTINGS = {
  park: { ground: 0x8cc98a, tiles: ['#8cc98a', '#86c384'], fleck: 'rgba(60,130,70,0.35)' },
  seaside: { ground: 0xead9ab, tiles: ['#ead9ab', '#e4d2a2'], fleck: 'rgba(160,130,80,0.3)' },
  mountain: { ground: 0xe8eef2, tiles: ['#e8eef2', '#e0e8ed'], fleck: 'rgba(130,155,180,0.35)' },
  orchard: { ground: 0x9ccf7e, tiles: ['#9ccf7e', '#95c877'], fleck: 'rgba(90,140,60,0.35)' },
} as const satisfies Record<string, Setting>;

/** Which setting a game's center has. */
export const settingName = (s: GameState) => centerOf(s).scenery ?? 'park';

/** The colors of a game's setting. */
export const settingOf = (s: GameState): Setting => SETTINGS[settingName(s)];
