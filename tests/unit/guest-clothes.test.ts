// A member of staff is picked out of a crowd by their uniform, so no guest may wear anything near one: no top and no
// trousers within a clear distance, in OKLab, of any uniform's top or trousers, nor a symptom worn over the shirt.
import { describe, expect, it } from 'vitest';

import { ROLE_ORDER, ROLES } from '../../src/core/data';
import { BOTTOMS, CLEAR_OF_UNIFORMS, randomLook, settleClothes, TOPS } from '../../src/core/people';
import { stream } from '../../src/core/random';
import { BLANKET } from '../../src/render/models/character';
import { apart } from './oklab';

/** Every color a uniform is made of, top and trousers, by what it is. */
const UNIFORMS: [string, number][] = ROLE_ORDER.flatMap((role) => [
  [`the ${role}'s top`, ROLES[role].uniform] as [string, number],
  ...(ROLES[role].bottom === undefined ? [] : [[`the ${role}'s trousers`, ROLES[role].bottom] as [string, number]]),
]);

/** Each of these colors that comes too close to a uniform, and how close. */
function nearUniforms(colors: readonly number[]) {
  return colors.flatMap((c) =>
    UNIFORMS.filter(([, u]) => apart(c, u) < CLEAR_OF_UNIFORMS).map(
      ([name, u]) => `${c.toString(16)} near ${name}: ${apart(c, u).toFixed(1)}`,
    ),
  );
}

describe("guests' clothes", () => {
  it('keep every top clear of every uniform', () => {
    expect(nearUniforms(TOPS)).toEqual([]);
  });

  it('keep every pair of trousers clear of every uniform', () => {
    expect(nearUniforms(BOTTOMS)).toEqual([]);
  });

  it('keep the wet blanket worn over the shirt clear of every uniform', () => {
    expect(nearUniforms([BLANKET])).toEqual([]);
  });

  it('are only ever those colors', () => {
    const r = stream(3);
    for (let i = 0; i < 400; i++) {
      const look = randomLook(r, i % 2 ? 'male' : 'female');
      expect(TOPS).toContain(look.top);
      expect(BOTTOMS).toContain(look.bottom);
    }
  });

  it('put someone from an older save in colors clear of the uniforms, tops and trousers', () => {
    for (const [top, bottom] of [
      [0x2a9d8f, 0x5c4b3a],
      [0xe76f51, 0x6b705c],
      [0xc8417f, 0x7f5539],
      [0xb56576, 0x4a4e69],
      [0x6d597a, 0x8d99ae],
      [0x5fa8d3, 0x3d405b],
      [0x3a5fc8, 0x2f4858],
    ] as const) {
      const look = { top: top as number, bottom: bottom as number };
      settleClothes(look);
      expect(TOPS).toContain(look.top);
      expect(BOTTOMS).toContain(look.bottom);
    }
  });

  it('leave a uniform as it is', () => {
    for (const role of ROLE_ORDER) {
      const look = { top: ROLES[role].uniform, bottom: TOPS[0]! };
      settleClothes(look);
      expect(look.top).toBe(ROLES[role].uniform);
    }
  });
});
