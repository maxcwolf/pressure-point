// The words and countdowns on a mishap's notice, and how a mishap looks: dimmed lights and rain.
import { describe, expect, it } from 'vitest';

import { MISHAP_NOTICE_DAYS, MISHAPS } from '../../src/core/data';
import { newMishap } from '../../src/core/sim/mishaps';
import { lightLevel, POWER_CUT_LIGHT, STORM_LIGHT } from '../../src/render/lighting';
import { dropLine, RAIN_FALL } from '../../src/render/rain';
import { flakeHeight, flakeSpot } from '../../src/render/snowfall';
import { kitNote, mishapLine, noticeShare, preparedNote, startsIn, stoppedLabel } from '../../src/ui/lib/mishaps';

describe('a mishap notice', () => {
  it('counts down to the start in whole days, or less than a day', () => {
    expect(startsIn(3)).toBe('Starts in 3 days');
    expect(startsIn(1.2)).toBe('Starts in 2 days');
    expect(startsIn(1)).toBe('Starts in 1 day');
    expect(startsIn(0.4)).toBe('Starts in less than a day');
  });

  it('shows how much of the notice is left', () => {
    expect(noticeShare(MISHAP_NOTICE_DAYS)).toBe(1);
    expect(noticeShare(MISHAP_NOTICE_DAYS / 2)).toBe(0.5);
    expect(noticeShare(-1)).toBe(0);
  });

  it('says in a line whether it is prepared for, and how long until it starts or ends', () => {
    const m = newMishap(10, 'power');
    expect(mishapLine(MISHAPS.power, m, 2)).toBe('Power cut: starts in 2 days · not prepared');
    m.prepared = true;
    expect(mishapLine(MISHAPS.power, m, 2)).toBe('Power cut: starts in 2 days · prepared');
    m.started = true;
    expect(mishapLine(MISHAPS.power, m, 0.5)).toBe('Power cut: less than a day left · prepared');
    m.prepared = false;
    expect(mishapLine(MISHAPS.storm, { ...m, kind: 'storm' }, 2)).toBe('Storm: 2 days left');
  });

  it('says what preparing would do', () => {
    expect(preparedNote(MISHAPS.power)).toBe('Prepared, a generator keeps everything running.');
  });

  it("says whether a treatment's equipment is installed, stopped by a mishap, or missing", () => {
    expect(kitNote('Stone Warmer', true, undefined)).toEqual({ ok: true, text: '✔ Stone Warmer installed' });
    expect(kitNote('Stone Warmer', false, MISHAPS.power)).toEqual({
      ok: false,
      icon: 'mishap-power',
      text: 'Stone Warmer out of action: power cut',
    });
    expect(kitNote('Stone Warmer', false, undefined)).toEqual({
      ok: false,
      icon: 'ui-warning',
      text: 'Needs a Stone Warmer in the room',
    });
  });

  it('names the mishap on an item it has taken out of action', () => {
    expect(stoppedLabel(MISHAPS.freeze)).toBe('Out of action: big freeze');
  });
});

describe('how a mishap looks', () => {
  it('dims the lights in a power cut with no generator, and grays them in a storm', () => {
    const power = { ...newMishap(0, 'power'), started: true };
    expect(lightLevel(null)).toBe(1);
    expect(lightLevel({ ...power, started: false })).toBe(1);
    expect(lightLevel(power)).toBe(POWER_CUT_LIGHT);
    expect(lightLevel({ ...power, prepared: true })).toBe(1);
    expect(lightLevel({ ...newMishap(0, 'storm'), started: true })).toBe(STORM_LIGHT);
    expect(lightLevel({ ...newMishap(0, 'wasps'), started: true })).toBe(1);
  });

  it('draws the rain as streaks slanting in the wind, falling faster than snow', () => {
    const [x0, y0, z0, x1, y1, z1] = dropLine(5, 0);
    expect(y1).toBeGreaterThan(y0);
    expect(x1).toBeLessThan(x0);
    expect(z1).toBe(z0);
    expect(y0).toBe(flakeHeight(flakeSpot(5).start, 0, RAIN_FALL));
    const rainFell = flakeHeight(0.5, 0, RAIN_FALL) - flakeHeight(0.5, 0.05, RAIN_FALL);
    const snowFell = flakeHeight(0.5, 0) - flakeHeight(0.5, 0.05);
    expect(rainFell).toBeCloseTo(0.05 * RAIN_FALL);
    expect(rainFell).toBeGreaterThan(snowFell * 5);
  });
});
