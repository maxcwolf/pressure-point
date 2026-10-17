// How pleasant, noisy and warm each tile is, worked out once a second and kept in the game's state as it was last
// worked out, so a loaded game goes by the same figures until the next check as it would have had it never been saved.

import { IDEAL_TEMP } from '../data';
import type { PackedGrid } from '../state/types';
import { updateAmbience } from './ambience';
import type { SimContext } from './context';
import { updateNoise } from './noise';
import { updateWarmth } from './warmth';

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALUES = new Map(Array.from({ length: DIGITS.length }, (_, i) => [DIGITS.charAt(i), i]));

/**
 * A grid as the bytes of its floats, in base64: exactly the figures it holds, in a fraction of the room of JSON. The
 * bytes are in the machine's own order, which is the same on every machine the game runs on.
 */
export function packGrid(grid: Float32Array): PackedGrid {
  const bytes = new Uint8Array(grid.buffer, grid.byteOffset, grid.byteLength);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += DIGITS[n >> 18] ?? '';
    out += DIGITS[(n >> 12) & 63] ?? '';
    out += i + 1 < bytes.length ? (DIGITS[(n >> 6) & 63] ?? '') : '=';
    out += i + 2 < bytes.length ? (DIGITS[n & 63] ?? '') : '=';
  }
  return out;
}

/** Read a packed grid back into one of the same size. False, and the grid left alone, if it is not one. */
export function unpackGrid(packed: unknown, into: Float32Array): boolean {
  if (typeof packed !== 'string' || packed.length !== Math.ceil(into.byteLength / 3) * 4) return false;
  const bytes = new Uint8Array(into.byteLength);
  for (let i = 0, b = 0; i < packed.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const c = packed[i + j] ?? '';
      const v = c === '=' ? 0 : VALUES.get(c);
      if (v === undefined) return false;
      n = (n << 6) | v;
    }
    for (const shift of [16, 8, 0]) if (b < bytes.length) bytes[b++] = (n >> shift) & 255;
  }
  new Uint8Array(into.buffer, into.byteOffset, into.byteLength).set(bytes);
  return true;
}

/** Work out again how pleasant, noisy and warm each tile is, and keep the figures in the game's state. */
export function checkSurroundings(ctx: SimContext) {
  updateAmbience(ctx);
  updateNoise(ctx);
  updateWarmth(ctx);
  ctx.s.surroundings = { attract: packGrid(ctx.attract), noise: packGrid(ctx.noise), warmth: packGrid(ctx.warmth) };
}

/**
 * Take up the surroundings as the game last worked them out, as it is loaded. A game that has not been checked yet,
 * or was saved before they were kept, has only how pleasant each tile is worked out, as when it was new.
 */
export function restoreSurroundings(ctx: SimContext) {
  const saved = ctx.s.surroundings;
  const restored =
    saved &&
    unpackGrid(saved.attract, ctx.attract) &&
    unpackGrid(saved.noise, ctx.noise) &&
    unpackGrid(saved.warmth, ctx.warmth);
  if (restored) return;
  ctx.attract.fill(0);
  ctx.noise.fill(0);
  ctx.warmth.fill(IDEAL_TEMP);
  updateAmbience(ctx);
}
