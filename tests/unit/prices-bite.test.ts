// Prices that bite: a put-off curve gentle to 1.3 and steep past it, moved by reputation, and the Prices tab's text.
import { describe, expect, it } from 'vitest';

import { putOffChance } from '../../src/core/sim/economy';
import { balkShort, balkText } from '../../src/ui/lib/prices';

describe('the put-off curve', () => {
  it('puts off about 3% at 1.2, 10% at 1.4, 20% at 1.6 and half at 2, at 50% reputation', () => {
    expect(putOffChance(1, 50)).toBe(0);
    expect(putOffChance(1.2, 50)).toBeCloseTo(0.03, 3);
    expect(putOffChance(1.4, 50)).toBeCloseTo(0.1, 3);
    expect(putOffChance(1.6, 50)).toBeCloseTo(0.2, 3);
    expect(putOffChance(2, 50)).toBeCloseTo(0.5, 3);
  });

  it('is gentle to 1.3 and steep past it', () => {
    const below = putOffChance(1.3, 50) - putOffChance(1.1, 50);
    const above = putOffChance(1.5, 50) - putOffChance(1.3, 50);
    expect(below).toBeLessThan(0.05);
    expect(above).toBeGreaterThan(2 * below);
  });

  it('puts no one off at standard prices from 50% reputation, nor below 85% of standard at any', () => {
    expect(putOffChance(1, 50)).toBe(0);
    expect(putOffChance(1, 100)).toBe(0);
    expect(putOffChance(0.85, 0)).toBe(0);
    expect(putOffChance(1, 20)).toBeGreaterThan(0);
  });

  it('forgives a center with a good name 0.15 more, and one with a poor name 0.15 less', () => {
    expect(putOffChance(1.55, 90)).toBeCloseTo(putOffChance(1.4, 50), 3);
    expect(putOffChance(1.25, 20)).toBeCloseTo(putOffChance(1.4, 50), 3);
    expect(putOffChance(1.4, 90)).toBeLessThan(putOffChance(1.4, 50));
    expect(putOffChance(1.4, 20)).toBeGreaterThan(putOffChance(1.4, 50));
  });

  it('rises with the price and never passes certainty', () => {
    for (const rep of [0, 20, 50, 90, 100]) {
      let last = 0;
      for (let p = 0.5; p <= 2.001; p += 0.1) {
        const c = putOffChance(p, rep);
        expect(c).toBeGreaterThanOrEqual(last);
        expect(c).toBeLessThan(1);
        last = c;
      }
    }
  });
});

describe('the Prices tab', () => {
  it('says what share balks at this price, and two tenths dearer', () => {
    expect(balkText(1.4, 50)).toBe('About 10% of guests balk at this price; 20% at 160% of standard.');
    expect(balkText(1, 50)).toBe('No guest balks at this price; 3% at 120% of standard.');
    expect(balkText(0.8, 50)).toBe('No guest balks at this price; none at 100% of standard.');
  });

  it('reads lower for a center with a good name', () => {
    expect(balkText(1.4, 90)).toMatch(/^About [2-6]% of guests balk at this price; 1[0-4]% at 160%/);
  });

  it('looks no higher than the top price', () => {
    expect(balkText(2, 50)).toBe('About 50% of guests balk at this price.');
    expect(balkText(1.8, 50)).toBe('About 35% of guests balk at this price; 50% at 200% of standard.');
  });

  it('gives each treatment row a short share, and nothing where no one balks', () => {
    expect(balkShort(1.4, 50)).toBe('10% balk');
    expect(balkShort(1, 50)).toBe('');
  });
});
