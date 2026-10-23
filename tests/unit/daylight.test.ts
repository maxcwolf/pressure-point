import { describe, expect, it } from 'vitest';

import type { Season } from '../../src/core/sim/twists';
import {
  brightness,
  type Daylight,
  daylightAt,
  mixHex,
  NOON,
  NOON_AT,
  SEASON_LIGHT,
  seasonGround,
  stormy,
} from '../../src/render/daylight';
import { inSeason, SETTINGS } from '../../src/render/setting';

/** How much warmer than blue a tint is: above 1 for warm light. */
const warmth = (d: Daylight) => d.sun[0] / d.sun[2];

/** The red, green and blue of a color as picked. */
const rgb = (hex: number) => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff] as const;

const SEASONS: readonly Season[] = ['winter', 'spring', 'summer', 'autumn'];

describe('the light through a game day', () => {
  it('is plain at noon, whatever the day', () => {
    expect(daylightAt(NOON_AT)).toEqual(NOON);
    expect(daylightAt(41 + NOON_AT)).toEqual(NOON);
  });

  it('is warm and low at opening, and warmer, amber, at closing', () => {
    const morning = daylightAt(0);
    const evening = daylightAt(0.88);
    expect(warmth(morning)).toBeGreaterThan(1.15);
    expect(warmth(evening)).toBeGreaterThan(warmth(morning));
    expect(morning.sunLevel).toBeLessThan(1);
    expect(evening.sunLevel).toBeLessThan(1);
  });

  it('never dims far, so the cream floors never go gray', () => {
    for (let t = 0; t < 1; t += 0.01) {
      const d = daylightAt(t);
      expect(d.sunLevel * brightness(d.sun)).toBeGreaterThan(0.68);
      expect(d.skyLevel * brightness(d.sky)).toBeGreaterThan(0.88);
    }
  });

  it('changes smoothly, through the night into the next morning too', () => {
    for (let t = 0; t < 2; t += 0.005) {
      const a = daylightAt(t);
      const b = daylightAt(t + 0.005);
      expect(Math.abs(a.sunLevel - b.sunLevel)).toBeLessThan(0.02);
      expect(Math.abs(a.sun[2] - b.sun[2])).toBeLessThan(0.03);
    }
  });

  it('strays less from noon at a lesser depth, and not at all at none', () => {
    expect(daylightAt(0.88, 0)).toEqual(NOON);
    expect(warmth(daylightAt(0.88, 0.5))).toBeLessThan(warmth(daylightAt(0.88)));
    expect(warmth(daylightAt(0.88, 0.5))).toBeGreaterThan(1);
  });

  it('grays under storm clouds on top of the hour, keeping a little of its warmth', () => {
    const evening = daylightAt(0.88);
    const storm = stormy(evening, 1);
    expect(warmth(storm)).toBeLessThan(warmth(evening));
    expect(warmth(storm)).toBeGreaterThan(warmth(stormy(NOON, 1)));
    expect(stormy(evening, 0)).toEqual(evening);
  });
});

describe('the seasons', () => {
  it('tint the sky warmer in summer and autumn and cooler in winter', () => {
    /** How much bluer than red a season's sky is. */
    const blueness = (s: Season) => SEASON_LIGHT[s].sky[2] / SEASON_LIGHT[s].sky[0];
    expect(blueness('winter')).toBeGreaterThan(blueness('spring'));
    expect(blueness('spring')).toBeGreaterThan(blueness('summer'));
    expect(blueness('summer')).toBeGreaterThan(blueness('autumn'));
  });

  it('turn a lawn fresher in spring, gold in autumn and pale in winter', () => {
    const lawn = SETTINGS.park.ground;
    const [, springGreen] = rgb(seasonGround(lawn, 'grass', 'spring'));
    const [autumnRed] = rgb(seasonGround(lawn, 'grass', 'autumn'));
    const winter = rgb(seasonGround(lawn, 'grass', 'winter'));
    expect(springGreen).toBeGreaterThanOrEqual(rgb(lawn)[1]);
    expect(autumnRed).toBeGreaterThan(rgb(lawn)[0] + 15);
    // paler: the channels closer together
    expect(Math.max(...winter) - Math.min(...winter)).toBeLessThan(Math.max(...rgb(lawn)) - Math.min(...rgb(lawn)));
  });

  it('keep paving gray, a little darker and wetter in autumn and winter', () => {
    const paving = SETTINGS.downtown.ground;
    /** How far a color strays from gray: the spread between its channels. */
    const spread = (hex: number) => Math.max(...rgb(hex)) - Math.min(...rgb(hex));
    /** How light a color is: its channels together. */
    const light = (hex: number) => rgb(hex).reduce((a, b) => a + b, 0);
    for (const s of SEASONS) expect(spread(seasonGround(paving, 'paving', s)), s).toBeLessThan(16);
    expect(light(seasonGround(paving, 'paving', 'autumn'))).toBeLessThan(light(paving) - 20);
    expect(light(seasonGround(paving, 'paving', 'winter'))).toBeLessThan(light(paving) - 20);
    expect(seasonGround(paving, 'paving', 'spring')).toBe(paving);
  });

  it('leave snow as it is', () => {
    for (const s of SEASONS) expect(seasonGround(SETTINGS.mountain.ground, 'snow', s)).toBe(SETTINGS.mountain.ground);
  });

  it('shift the lot tiles the same way as the lawn round them', () => {
    for (const s of SEASONS) {
      const setting = inSeason('orchard', s);
      expect(setting.tiles[0]).toBe(`#${setting.ground.toString(16).padStart(6, '0')}`);
      expect(inSeason('orchard', s)).toBe(setting);
    }
  });

  it('mix colors channel by channel', () => {
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixHex(0x123456, 0xabcdef, 0)).toBe(0x123456);
  });
});
