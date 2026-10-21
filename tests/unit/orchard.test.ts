// The Orchard Estate: the fifth center, a country resort with picky guests, every treatment open from the start, and a
// health inspector who calls twice as often.
import { describe, expect, it } from 'vitest';

import { nextCenter } from '../../src/core/campaign';
import { CENTERS, conditionHere, CONDITIONS, INSPECTION_GAP_DAYS, ITEMS, MODALITIES } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { createContext } from '../../src/core/sim/context';
import { objectives } from '../../src/core/sim/progress';
import { expectedPrestige } from '../../src/core/sim/standing';
import { treatmentFee } from '../../src/core/sim/stations';
import { unlocked } from '../../src/core/sim/treatments';
import { inspectionGap } from '../../src/core/sim/visits';
import { disciplineOn, newGame, unlockedUpTo } from '../../src/core/state/game';
import { orchardRows } from '../../src/render/models/orchard';

describe('The Orchard Estate', () => {
  it('comes after High Pines, last of the campaign, with every discipline', () => {
    expect(nextCenter('highpines')).toBe('orchard');
    expect(nextCenter('orchard')).toBeUndefined();
    const s = newGame('orchard');
    expect(disciplineOn(s, 'acupuncture')).toBe(true);
    expect(disciplineOn(s, 'reiki')).toBe(true);
  });

  it('opens what the first two stars bring from the start, but not the third', () => {
    const s = newGame('orchard');
    const ctx = createContext(s);
    expect(unlockedUpTo(s)).toBe(2);
    expect(unlocked(ctx, 'needling')).toBe(true);
    expect(unlocked(ctx, 'cranio')).toBe(true);
    expect(unlocked(ctx, 'sound'), 'sound healing opens at the first star').toBe(true);
    expect(unlocked(ctx, 'distance')).toBe(false);
    s.stars = 3;
    expect(unlocked(ctx, 'distance')).toBe(true);
    expect(unlockedUpTo(newGame('willow')), 'elsewhere').toBe(0);
  });

  it('has picky guests, who pay half as much again and expect finer rooms', () => {
    const s = newGame('orchard');
    expect(treatmentFee(s, 1000, 1)).toBe(1500);
    expect(treatmentFee(s, 1000, 1.2)).toBe(1800);
    expect(treatmentFee(newGame('willow'), 1000, 1.2)).toBe(1200);
    expect(expectedPrestige(s)).toBe(2);
    s.grade = 4;
    expect(expectedPrestige(s)).toBe(5);
    expect(expectedPrestige(newGame('willow'))).toBe(0);
  });

  it('has the inspector call twice as often', () => {
    setSeed(3);
    const here = newGame('orchard');
    const there = newGame('willow');
    for (let i = 0; i < 50; i++) {
      const gap = inspectionGap(here);
      expect(gap).toBeGreaterThanOrEqual(INSPECTION_GAP_DAYS[0] / 2);
      expect(gap).toBeLessThanOrEqual(INSPECTION_GAP_DAYS[1] / 2);
      const usual = inspectionGap(there);
      expect(usual).toBeGreaterThanOrEqual(INSPECTION_GAP_DAYS[0]);
      expect(usual).toBeLessThanOrEqual(INSPECTION_GAP_DAYS[1]);
    }
  });

  it('has three ailments found only there, and two more for the Cider Press of Rebirth once it is built', () => {
    const local = CONDITIONS.filter((c) => c.only?.includes('orchard') && !MODALITIES[c.modality].machine).map(
      (c) => c.id,
    );
    expect(local).toEqual(['windfall', 'croquet', 'blossom']);
    const pressed = CONDITIONS.filter((c) => c.only?.includes('orchard') && MODALITIES[c.modality].machine);
    expect(pressed.map((c) => c.id)).toEqual(['sourgrapes', 'badapple']);
    for (const c of CONDITIONS.filter((c) => local.includes(c.id))) {
      expect(conditionHere(c, 'orchard')).toBe(true);
      expect(conditionHere(c, 'highpines')).toBe(false);
      expect(CENTERS.orchard.conditions?.[c.id], c.id).toBeGreaterThan(1);
    }
  });

  it('asks for a grade of standing for each star', () => {
    for (const goal of CENTERS.orchard.goals) expect(goal.some((g) => g.kind === 'grade')).toBe(true);
    const s = newGame('orchard');
    const ctx = createContext(s);
    const first = objectives(ctx).find((o) => o.label.startsWith('Rise to'));
    expect(first).toMatchObject({ label: 'Rise to Wellness Studio', done: false });
    s.grade = 1;
    expect(objectives(ctx).find((o) => o.label.startsWith('Rise to'))).toMatchObject({ done: true, progress: 1 });
  });

  it('sells a karma-only Topiary, for the karma its stars add', () => {
    expect(ITEMS.topiary).toMatchObject({ karma: 6, decor: 6, inMenu: true });
    expect(ITEMS.topiary.unlock, 'only ever with karma').toBeUndefined();
  });
});

describe('orchard rows', () => {
  it('plant a tree every few tiles, each row offset by half a gap', () => {
    const rows = orchardRows(0, 6, 0, 3);
    expect(rows).toEqual([
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 6, z: 0 },
      { x: 1.5, z: 3 },
      { x: 4.5, z: 3 },
    ]);
  });
});
