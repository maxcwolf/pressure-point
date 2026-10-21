// What items show of themselves before they are bought, and what one in hand would change where it is about to go.
import { beforeEach, describe, expect, it } from 'vitest';

import { DAYS_PER_MONTH, IDEAL_TEMP, ITEMS } from '../../src/core/data';
import { thermostatShare } from '../../src/core/sim/warmth';
import { defaultDisplay, forgetDisplay, loadDisplay, readDisplay, saveDisplay } from '../../src/storage/display';
import { DECOR_MOST, itemStats, placeEffects, statsText } from '../../src/ui/lib/item-stats';
import { heatTiles, previewMode } from '../../src/ui/lib/overlays';
import { openCenter } from './helpers';

/** The middle of a month of the first year, counting from 0. */
const midMonth = (month: number) => month * DAYS_PER_MONTH + DAYS_PER_MONTH / 2;

// a stand-in for the browser's storage
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    /** Read a stored value, or null if there is none. */
    getItem: (k: string) => store.get(k) ?? null,
    /** Store a value. */
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
  forgetDisplay();
});

describe('the display settings', () => {
  it('start with stats in the tooltip and the preview while placing on', () => {
    expect(loadDisplay()).toEqual({ itemView: 'tooltip', placePreview: true });
  });

  it('keep a choice, and ignore what they cannot use', () => {
    saveDisplay({ itemView: 'chips', placePreview: false });
    forgetDisplay();
    expect(loadDisplay()).toEqual({ itemView: 'chips', placePreview: false });
    expect(readDisplay({ itemView: 'sideways', placePreview: 'yes' })).toEqual(defaultDisplay());
    expect(readDisplay(null)).toEqual(defaultDisplay());
  });
});

describe('an item’s stats', () => {
  /** What an item's card chips say. */
  const ids = (type: Parameters<typeof itemStats>[0]) => itemStats(type).map((s) => s.short);

  it('say how nice, how quiet and how big it is', () => {
    expect(ids('koi_pond')).toEqual(['Decor +8', 'Soothes 3', '2×2']);
    expect(DECOR_MOST).toBe(8);
  });

  it('say what it earns, how loud it is, and when it breaks', () => {
    expect(ids('arcade_machine')).toEqual(expect.arrayContaining(['Noise 6', '$10 a use', 'Breaks in ~33']));
    expect(ids('tea_station')).toEqual(expect.arrayContaining(['$15 a use', 'Breaks in ~67']));
  });

  it('say how it warms or cools, how patient a seat keeps guests, and what treatment it is for', () => {
    expect(ids('radiator')).toContain('Warms 12°');
    expect(ids('air_conditioner')).toContain('Cools 12°');
    expect(ids('massage_chair')).toContain('Patience ×10');
    expect(ids('bench')).toContain('Patience ×1.7');
    expect(ids('stone_warmer')).toContain('Hot Stone');
  });

  it('read as words for a screen reader, or as nothing for an item with nothing to tell', () => {
    expect(statsText('fountain')).toBe(
      'Zen Fountain: Decor +4: makes everywhere within 6 tiles nicer. Soothes the noise around it by 2.',
    );
    expect(statsText('wall_clock')).toBe('');
  });
});

describe('an item in hand', () => {
  it('previews exactly the noise it makes once it is down, and the tables it makes noisier', () => {
    const { sim } = openCenter(1);
    const p = sim.previewItem({ type: 'arcade_machine', x: 13, y: 10, rot: 0 });
    const before = [11, 12, 13, 14].map((x) => sim.noiseAt(x, 9));
    expect(p.noise).not.toBeNull();
    expect(p.noisier).toBe(1);
    expect(previewMode(p, null)).toBe('calm');
    const expected = [11, 12, 13, 14].map((x, i) => (before[i] ?? 0) + (p.noise?.[sim.world.idx(x, 9)] ?? 0));
    expect(sim.placeItem('arcade_machine', 13, 10, 0)).toBeTruthy();
    sim.refreshAmbience();
    [11, 12, 13, 14].forEach((x, i) => {
      expect(sim.noiseAt(x, 9)).toBeCloseTo(expected[i] ?? 0, 4);
    });
  });

  it('previews the decor and prestige it brings to a room', () => {
    const { sim, massage } = openCenter(1);
    const p = sim.previewItem({ type: 'statue', x: 11, y: 5, rot: 0 });
    expect(p.room).toEqual({ id: massage.id, before: sim.prestige(massage), after: sim.prestige(massage, 4) });
    expect(previewMode(p, null)).toBe('decor');
    const drain = sim.drainFactor(11, 6, p.decor?.[sim.world.idx(11, 6)] ?? 0);
    expect(sim.placeItem('statue', 11, 5, 0)).toBeTruthy();
    sim.refreshAmbience();
    expect(sim.drainFactor(11, 6)).toBeCloseTo(drain, 5);
    expect(sim.prestige(massage)).toBe(p.room?.after);
  });

  it('says what it would change, for better or worse', () => {
    const { sim } = openCenter(1);
    const arcade = placeEffects(sim, sim.previewItem({ type: 'arcade_machine', x: 13, y: 10, rot: 0 }));
    expect(arcade.map((e) => e.text)).toContain('Noisier at 1 treatment table');
    expect(arcade.find((e) => e.text.startsWith('Calm here'))?.tone).toBe('bad');
    const fountain = placeEffects(sim, sim.previewItem({ type: 'fountain', x: 13, y: 10, rot: 0 }));
    expect(fountain.find((e) => e.icon === 'overlay-decor')?.tone).toBe('good');
  });

  it('keeps the overlay showing, if it is one an item changes, and colors it as if the item were down', () => {
    const { sim } = openCenter(1);
    const p = sim.previewItem({ type: 'radiator', x: 13, y: 10, rot: 0 });
    expect(previewMode(p, 'decor')).toBe('decor');
    expect(previewMode(p, 'patience')).toBe(sim.s.weatherOn ? 'temperature' : null);
    const now = heatTiles(sim, 'calm');
    const fountain = sim.previewItem({ type: 'fountain', x: 13, y: 10, rot: 0 });
    const then = heatTiles(sim, 'calm', fountain);
    // the fountain soothes, so somewhere gets calmer and nowhere gets noisier
    expect(then.some(([, , v], i) => v > (now[i]?.[2] ?? 0))).toBe(true);
    expect(then.every(([, , v], i) => v >= (now[i]?.[2] ?? 0))).toBe(true);
  });

  it('lists nothing for an item that changes none of it', () => {
    const { sim } = openCenter(1);
    const p = sim.previewItem({ type: 'bin', x: 13, y: 10, rot: 0 });
    expect(ITEMS.bin.decor).toBeUndefined();
    expect(previewMode(p, null)).toBeNull();
    expect(placeEffects(sim, p)).toEqual([]);
  });
});

describe('how far an item reaches', () => {
  /** How much pleasantness an item alone gives a tile so many tiles east of it, on an open floor. */
  const decorAt = (type: 'plant' | 'statue' | 'koi_pond', dx: number) => {
    const { sim } = openCenter(1);
    const p = sim.previewItem({ type, x: 13, y: 11, rot: 0 });
    return p.decor?.[sim.world.idx(p.x + dx, p.y)] ?? 0;
  };

  it('is a few tiles for something small, and a whole stretch for a centerpiece', () => {
    expect(decorAt('plant', 2)).toBeGreaterThan(0);
    expect(decorAt('plant', 3)).toBe(0);
    expect(decorAt('statue', 4)).toBeGreaterThan(0);
    expect(decorAt('statue', 5)).toBe(0);
    expect(decorAt('koi_pond', 6)).toBeGreaterThan(0);
  });

  it('counts good decor for a little more than it says, fading gently toward the edge', () => {
    expect(decorAt('statue', 0)).toBeCloseTo(4 * 1.2);
    // a third of the way down at the edge of its reach, not a fifth as litter fades
    expect(decorAt('statue', 4) / decorAt('statue', 0)).toBeCloseTo(1 / 3);
  });

  it('carries a radiator’s warmth further, holding up over the first few tiles', () => {
    const { sim } = openCenter(1);
    sim.s.weatherOn = true;
    const p = sim.previewItem({ type: 'radiator', x: 13, y: 11, rot: 0 });
    /** The radiator's warmth so many tiles east of it. */
    const at = (dx: number) => p.heat?.[sim.world.idx(p.x + dx, p.y)] ?? 0;
    // on Auto it gives what a mild winter calls for, so what matters is how it fades
    expect(at(0)).toBeGreaterThan(0);
    // evenly fading out to 4 tiles would leave four fifths at one tile and three fifths at two
    expect(at(1) / at(0)).toBeGreaterThan(0.9);
    expect(at(2) / at(0)).toBeGreaterThan(0.75);
    expect(at(5)).toBeGreaterThan(0);
    expect(at(6)).toBe(0);
  });
});

describe('a heater in hand', () => {
  /** What the hint says of a new radiator's warmth on a day of the year. */
  const radiatorOn = (day: number) => {
    const { sim } = openCenter(1);
    sim.s.weatherOn = true;
    sim.s.day = day;
    return placeEffects(sim, sim.previewItem({ type: 'radiator', x: 13, y: 11, rot: 0 }));
  };

  it('warms its spot to just right in the cold, and says it would be off while the weather is nice', () => {
    const winter = radiatorOn(midMonth(0)).find((e) => e.icon === 'overlay-temperature');
    expect(winter?.text).toMatch(/→ 71°F here, just right$/);
    expect(winter?.tone).toBe('good');
    expect(radiatorOn(midMonth(6)).map((e) => e.text)).toEqual(['Off for now: the weather is nice']);
  });
});

describe('a thermostat', () => {
  it('on Auto works as hard as the weather calls for, and at a set power otherwise', () => {
    // 6 degrees short of just right is half a radiator's 12
    expect(thermostatShare('radiator', undefined, IDEAL_TEMP - 6)).toBeCloseTo(0.5);
    expect(thermostatShare('radiator', 'auto', IDEAL_TEMP + 2)).toBe(0);
    expect(thermostatShare('air_conditioner', 'auto', IDEAL_TEMP + 24)).toBe(1);
    expect(thermostatShare('air_conditioner', 'auto', IDEAL_TEMP - 5)).toBe(0);
    expect(thermostatShare('radiator', 'low', IDEAL_TEMP + 10)).toBeCloseTo(1 / 3);
    expect(thermostatShare('radiator', 'off', IDEAL_TEMP - 20)).toBe(0);
    // a sweat lodge has no thermostat, and works flat out
    expect(thermostatShare('sweat_lodge', 'off', IDEAL_TEMP + 20)).toBe(1);
  });

  it('is set on the one clicked, or on every one of its kind', () => {
    const { sim } = openCenter(1);
    const a = sim.placeItem('radiator', 13, 10, 0)!;
    const b = sim.placeItem('radiator', 16, 10, 0)!;
    const ac = sim.placeItem('air_conditioner', 10, 10, 0)!;
    sim.setThermostat(a.id, 'high');
    expect([a.thermostat, b.thermostat]).toEqual(['high', undefined]);
    sim.setThermostat(b.id, 'low', true);
    expect([a.thermostat, b.thermostat, ac.thermostat]).toEqual(['low', 'low', undefined]);
    sim.setThermostat(a.id, 'auto', true);
    expect('thermostat' in a || 'thermostat' in b).toBe(false);
    // only something with a thermostat has one to set
    const plant = sim.placeItem('plant', 18, 10, 0)!;
    sim.setThermostat(plant.id, 'high');
    expect(plant.thermostat).toBeUndefined();
  });
});
