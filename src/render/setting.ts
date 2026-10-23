// What surrounds a center's building: the colors of the ground around it, a park's lawn, the seaside's sand, the
// mountains' snow, an orchard's grass or a downtown plaza's paving, as each looks in the season.

import * as THREE from 'three';

import { centerOf } from '../core/data';
import { calendarDay } from '../core/format';
import { type Season, seasonOf } from '../core/sim/twists';
import type { GameState } from '../core/state/types';
import { type Ground, seasonGround } from './daylight';

/**
 * The light of a setting: the sky's color, the color thrown back up off the ground onto the sides and undersides of
 * things (grass green, warm sand, blue-white snow, gray stone), and the sun's.
 */
export interface SettingLight {
  sky: number;
  bounce: number;
  sun: number;
}

/**
 * The colors of a setting: the open ground in 3D, its two shades as drawn tile by tile, the flecks on it, and the
 * light it is seen in.
 */
export interface Setting {
  ground: number;
  tiles: readonly [string, string];
  fleck: string;
  light: SettingLight;
  /** What the ground is, so the seasons know how to change it. */
  kind: Ground;
  /**
   * The two shades of the land a center has yet to buy, where it would not otherwise stand out from the ground round
   * it, as a paved plaza's empty lots of gravel do; else the plots are the same ground as the rest.
   */
  plots?: readonly [string, string];
}

/** The colors of each setting a center can have. */
export const SETTINGS = {
  park: {
    kind: 'grass',
    ground: 0x8cc98a,
    tiles: ['#8cc98a', '#86c384'],
    fleck: 'rgba(60,130,70,0.35)',
    light: { sky: 0xe8f0ff, bounce: 0xb8c4a2, sun: 0xffeccc },
  },
  seaside: {
    kind: 'sand',
    ground: 0xead9ab,
    tiles: ['#ead9ab', '#e4d2a2'],
    fleck: 'rgba(160,130,80,0.3)',
    light: { sky: 0xe6f1ff, bounce: 0xd6c7a4, sun: 0xffeac4 },
  },
  mountain: {
    kind: 'snow',
    ground: 0xe8eef2,
    tiles: ['#e8eef2', '#e0e8ed'],
    fleck: 'rgba(130,155,180,0.35)',
    light: { sky: 0xe4eeff, bounce: 0xd0d9e4, sun: 0xfff3e0 },
  },
  orchard: {
    kind: 'grass',
    ground: 0x9ccf7e,
    tiles: ['#9ccf7e', '#95c877'],
    fleck: 'rgba(90,140,60,0.35)',
    light: { sky: 0xeaf1ff, bounce: 0xbcc69c, sun: 0xffe8c2 },
  },
  downtown: {
    kind: 'paving',
    ground: 0xc2c1bb,
    tiles: ['#c4c3bd', '#bdbcb5'],
    fleck: 'rgba(255,255,255,0.22)',
    plots: ['#cbb48d', '#c4ad86'],
    light: { sky: 0xe8eefc, bounce: 0xc9c5bc, sun: 0xffecd0 },
  },
} as const satisfies Record<string, Setting>;

/** Which setting a game's center has. */
export const settingName = (s: GameState) => centerOf(s).scenery ?? 'park';

/** A setting's colors as they look in each season, worked out once each. */
const seasoned = new Map<string, Setting>();

/** A setting's colors in a season: its ground and the tiles of open ground on the lot shifted with the year. */
export function inSeason(name: keyof typeof SETTINGS, season: Season): Setting {
  const key = `${name}|${season}`;
  const known = seasoned.get(key);
  if (known) return known;
  const base: Setting = SETTINGS[name];
  /** A tile's color, as drawn on the floor, in the season. */
  const tile = (css: string) =>
    `#${seasonGround(parseInt(css.slice(1), 16), base.kind, season)
      .toString(16)
      .padStart(6, '0')}`;
  const setting: Setting = {
    ...base,
    ground: seasonGround(base.ground, base.kind, season),
    tiles: [tile(base.tiles[0]), tile(base.tiles[1])],
    ...(base.plots && { plots: [tile(base.plots[0]), tile(base.plots[1])] }),
  };
  seasoned.set(key, setting);
  return setting;
}

/** The colors of a game's setting, as it looks in the season. */
export const settingOf = (s: GameState): Setting => inSeason(settingName(s), seasonOf(calendarDay(s)));

/**
 * The ground round the building, a lawn or whatever the setting has: one material the light can recolor with the season
 * without building it again.
 */
export const LAWN = new THREE.MeshStandardMaterial({ color: SETTINGS.park.ground, roughness: 1 });
