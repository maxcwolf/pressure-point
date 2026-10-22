// Guests' feelings, the reviews they write, the parts of the center's reputation, and the casebook.
import { describe, expect, it } from 'vitest';

import { type FeelingId, FEELINGS, REVIEWS_KEPT } from '../../src/core/data';
import { createContext } from '../../src/core/sim/context';
import { feel, reputationParts, reviewStars, reviewText, writeReview } from '../../src/core/sim/feelings';
import type { Review } from '../../src/core/state/types';
import { heatTiles, personValue } from '../../src/ui/lib/overlays';
import { openCenter, run, runUntil } from './helpers';

/** A review with these feelings and stars. */
const review = (stars: number, feelings: FeelingId[]): Review => ({
  name: 'A Guest',
  stars,
  text: '',
  day: 0,
  feelings,
});

/** A center with a guest in the building. */
function withGuest(seed = 1) {
  const c = openCenter(seed);
  runUntil(c.sim, () => c.s.guests.some((g) => g.state !== 'leaving'), 120);
  const g = c.s.guests.find((x) => x.state !== 'leaving')!;
  return { ...c, g, ctx: createContext(c.s) };
}

describe('a review', () => {
  it('starts from how the visit ended, half a star up or down for each feeling along the way', () => {
    expect(reviewStars('healed', [])).toBe(4);
    expect(reviewStars('healed', ['healed', 'pleasant', 'quick'])).toBe(5);
    expect(reviewStars('healed', ['long-wait', 'thirsty', 'pricey'])).toBe(3);
    expect(reviewStars('stormed', ['long-wait', 'litter'])).toBe(1);
    expect(reviewStars('failed', ['kind', 'comfy'])).toBe(3);
  });

  it('is about the feeling that told them most, the same each time', () => {
    const { g } = withGuest();
    g.feelings = ['pleasant', 'long-wait', 'healed'];
    // a good visit: the good thing along the way, not just that it worked
    expect(FEELINGS.pleasant.lines).toContain(reviewText(g, 4));
    // a bad one: the bad thing
    expect(FEELINGS['long-wait'].lines).toContain(reviewText(g, 2));
    expect(reviewText(g, 2)).toBe(reviewText(g, 2));
    g.feelings = [];
    expect(reviewText(g, 4)).toBe('No complaints.');
  });

  it('is filed as they go, keeping only the latest', () => {
    const { s, g, ctx } = withGuest();
    s.reviews = [];
    g.feelings = ['comfy'];
    writeReview(ctx, g, 'healed');
    expect(s.reviews).toHaveLength(1);
    expect(s.reviews[0]).toMatchObject({ name: g.name, stars: 5, feelings: ['comfy', 'healed'] });
    for (let i = 0; i < REVIEWS_KEPT + 5; i++) writeReview(ctx, g, 'failed');
    expect(s.reviews).toHaveLength(REVIEWS_KEPT);
  });
});

describe('the parts of the reputation', () => {
  it('are the share of good feelings about each, and word of mouth is the stars', () => {
    const parts = reputationParts([
      review(5, ['healed', 'pleasant']),
      review(1, ['not-healed', 'long-wait', 'pricey']),
      review(3, ['healed', 'comfy']),
    ]);
    expect(parts).toEqual({ results: 67, experience: 67, value: 0, staff: null, word: 50 });
    expect(reputationParts([])).toEqual({ results: null, experience: null, value: null, staff: null, word: null });
  });
});

describe('feelings', () => {
  it('are noted once each', () => {
    const { g } = withGuest();
    g.feelings = [];
    feel(g, 'comfy');
    feel(g, 'comfy');
    expect(g.feelings).toEqual(['comfy']);
  });

  it('come from waiting: too long, thirsty, and where they wait', () => {
    const { sim, s, g } = withGuest();
    g.feelings = [];
    g.state = 'waiting';
    g.timer = 99;
    g.patience = 30;
    g.thirst = 100;
    sim.tick(0.1);
    expect(g.feelings).toEqual(expect.arrayContaining<FeelingId>(['long-wait', 'thirsty']));
    s.litter.push({ id: 99001, x: g.tx, y: g.ty, claimedBy: 0 });
    g.timer = 0;
    sim.tick(0.1);
    expect(g.feelings).toContain('litter');
  });

  it('come from treatment: who gave it and with what', () => {
    const { sim, s, therapist } = openCenter(3);
    therapist.quals = [];
    runUntil(sim, () => s.reviews.some((r) => r.feelings.includes('unqualified')), 600);
  });

  it('end in a review for every guest who leaves, however they leave', () => {
    const { sim, s, g } = withGuest();
    s.reviews = [];
    sim.sendHome(g.id);
    expect(s.reviews.at(-1)).toMatchObject({ name: g.name, feelings: expect.arrayContaining(['sent-home']) });
    run(sim, 300);
    expect(s.reviews.length).toBeGreaterThan(1);
    expect(s.reviews.every((r) => r.stars >= 1 && r.stars <= 5 && r.text.length > 0)).toBe(true);
  });
});

describe('the casebook', () => {
  it('counts how visits ended, condition by condition', () => {
    const { sim, s } = openCenter(1);
    run(sim, 400);
    const total = Object.values(s.casebook).reduce(
      (sum, c) => sum + c.healed + c.failed + c.stormed + c.sent + c.priced,
      0,
    );
    expect(total).toBe(s.stats.healed + s.stats.failed + s.stats.stormed + s.stats.sent + s.stats.priced);
    expect(total).toBeGreaterThan(0);
  });

  it('enters a guest under their own condition', () => {
    const { sim, s, g } = withGuest();
    g.condition = 'band';
    sim.sendHome(g.id);
    expect(s.casebook.band?.sent).toBe(1);
  });
});

describe('the overlays', () => {
  it('rate every spot inside the building and every piece of kept furniture, and ring every guest and member of staff', () => {
    const { sim, s, g } = withGuest();
    const decor = heatTiles(sim, 'decor');
    expect(decor.length).toBeGreaterThan(50);
    expect(decor.every(([x, y, v]) => sim.world.inside(x, y) && v >= 0 && v <= 1)).toBe(true);
    // under the furniture too, so the field runs on beneath it
    expect(decor.some(([x, y]) => sim.world.blocked[sim.world.idx(x, y)])).toBe(true);
    // the people overlays ring the people, and leave the floor alone
    expect(heatTiles(sim, 'patience')).toEqual([]);
    g.patience = 25;
    expect(personValue('patience', g)).toBe(0.25);
    g.thirst = 80;
    g.hunger = 10;
    g.bladder = 10;
    expect(personValue('needs', g)).toBeCloseTo(0.2);
    expect(personValue('energy', g)).toBeNull();
    const st = s.staff[0]!;
    st.energy = 40;
    expect(personValue('energy', st)).toBe(0.4);
    expect(personValue('patience', st)).toBeNull();
    g.state = 'leaving';
    expect(personValue('patience', g)).toBeNull();
    // well kept furniture is ordinary, drawn clear, and worn furniture falls below it
    const table = s.items.find((i) => i.type === 'massage_table')!;
    table.wear = 70;
    expect(heatTiles(sim, 'upkeep')).toContainEqual([table.x, table.y, expect.closeTo(0.15)]);
  });
});
