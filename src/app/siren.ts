// How loud the fire truck's siren sounds, from where the camera is looking.

import { BRIGADE_CALL_SECONDS, DAY_SECONDS, ROAD_Y } from '../core/data';
import type { GameState } from '../core/state/types';
import { clamp } from '../core/util';

/** How far from the truck, in tiles, its siren can be heard at all. */
export const SIREN_REACH = 20;

/** How many seconds before it turns into the street the siren is first heard, coming nearer. */
export const SIREN_AHEAD = 10;

/**
 * How loud the fire truck's siren sounds, from 0 to 1: heard faintly in the last seconds before it turns into the
 * street and louder as it comes, the nearer the camera looks to it, and silent once it has parked (its lamps go on
 * flashing) and as it leaves.
 */
export function sirenLevel(s: GameState, x: number, y: number): number {
  const b = s.brigade;
  if (b?.state !== 'coming') return 0;
  const since = (s.day - b.called) * DAY_SECONDS;
  const coming = clamp((since - (BRIGADE_CALL_SECONDS - SIREN_AHEAD)) / SIREN_AHEAD, 0, 1);
  return coming * clamp(1 - Math.hypot(b.x - x, ROAD_Y[0] + 0.5 - y) / SIREN_REACH, 0, 1);
}
