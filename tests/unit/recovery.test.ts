// The Recovery Lounge: the harder treatments leave a guest needing a lie-down on a Recliner, or they work less often.
import { describe, expect, it } from 'vitest';

import { ITEMS, MODALITIES, NO_REST_PENALTY, ROOMS } from '../../src/core/data';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import { guestNoise } from '../../src/core/sim/noise';
import { needsRest, restPenalty } from '../../src/core/sim/recovery';
import type { Sim } from '../../src/core/sim/sim';
import type { Guest } from '../../src/core/state/types';
import { restNote } from '../../src/ui/lib/recovery';
import { addRecovery, inconsistencies, openCenter, runUntil, toasts } from './helpers';

/** The context inside a sim, for calling the systems directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A center that sends no guests of its own, with one guest on their way to have Deep Tissue for a knot. */
function knottedGuest(lounge: boolean) {
  const center = openCenter(2);
  const { sim, s, therapist } = center;
  s.stars = 1;
  s.open = false;
  for (const g of [...s.guests]) s.guests.splice(s.guests.indexOf(g), 1);
  therapist.quals.push('deep');
  if (lounge) addRecovery(sim);
  const g = spawnGuest(ctxOf(sim), 'knotted');
  if (!g) throw new Error('no guest');
  g.goal = 'treat';
  g.diagnosis = 1;
  g.patience = 100;
  return { ...center, g };
}

/** The Recliner in a sim. */
const reclinerOf = (sim: Sim) => {
  const it = sim.s.items.find((i) => i.type === 'recliner');
  if (!it) throw new Error('no recliner');
  return it;
};

describe('treatments that need a rest', () => {
  it('are the harder ones, one or two in each discipline', () => {
    const rest = Object.values(MODALITIES)
      .filter((m) => m.rest)
      .map((m) => m.id);
    expect(rest.sort()).toEqual(['ayahuasca', 'chakra', 'cranio', 'deep', 'electro', 'gong', 'moxa', 'mushroom']);
    for (const d of ['massage', 'acupuncture', 'reiki', 'sound', 'shaman'])
      expect(Object.values(MODALITIES).some((m) => m.rest && m.discipline === d)).toBe(true);
  });

  it('are told from the rest by the guest’s condition', () => {
    expect(needsRest({ condition: 'knotted' } as Guest)).toBe(true);
    expect(needsRest({ condition: 'slump' } as Guest)).toBe(false);
  });
});

describe('the Recovery Lounge', () => {
  it('opens at the first star with a Recliner, and has no staff', () => {
    expect(ROOMS.recovery).toMatchObject({ unlock: 1, required: ['recliner'] });
    expect(ROOMS.recovery.staff).toBeUndefined();
    expect(ITEMS.recliner).toMatchObject({ where: 'recovery', linens: true });
    expect(ITEMS.recliner.access.map((a) => a.role)).toEqual(['recover']);
  });

  it('spares a treatment the penalty while a Recliner is free', () => {
    const { sim, g } = knottedGuest(true);
    const ctx = ctxOf(sim);
    expect(restPenalty(ctx, g)).toBe(0);
    reclinerOf(sim).users[0] = 999;
    expect(restPenalty(ctx, g)).toBe(NO_REST_PENALTY);
  });

  it('costs a treatment its penalty with nowhere to rest, and only one that needs a rest', () => {
    const { sim, g } = knottedGuest(false);
    const ctx = ctxOf(sim);
    expect(restPenalty(ctx, g)).toBe(NO_REST_PENALTY);
    expect(restPenalty(ctx, { ...g, condition: 'slump' })).toBe(0);
  });
});

describe('a guest after a hard treatment', () => {
  it('lies back on a Recliner for a while, glad of it, then goes home', () => {
    const { sim, g } = knottedGuest(true);
    const recliner = reclinerOf(sim);
    runUntil(sim, () => g.state === 'toRest');
    expect(g.outcome).not.toBe('');
    expect(g.feelings).toContain('rested');
    expect(recliner.users[0]).toBe(g.id);
    expect(recliner.dirt).toBeGreaterThan(0);
    runUntil(sim, () => g.state === 'resting');
    expect(g.pose).toBe('lie');
    expect(guestNoise(g)).toBe(0);
    runUntil(sim, () => g.state === 'leaving');
    expect(recliner.users[0]).toBe(0);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('can be sent home from the Recliner without the visit counting twice or costing reputation', () => {
    const { sim, s, g } = knottedGuest(true);
    runUntil(sim, () => g.state === 'toRest');
    const outcome = g.outcome;
    const stats = { ...s.stats };
    const reviews = s.reviews.length;
    const rep = s.reputation;
    expect(sim.sendHome(g.id)).toBe(true);
    expect(g.state).toBe('leaving');
    expect(g.outcome, 'still the outcome they had').toBe(outcome);
    expect(s.stats.sent).toBe(stats.sent);
    expect(s.stats.healed).toBe(stats.healed);
    expect(s.stats.failed).toBe(stats.failed);
    expect(s.reviews).toHaveLength(reviews);
    expect(s.reputation).toBe(rep);
    expect(reclinerOf(sim).users[0]).toBe(0);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('goes home woozy with nowhere to rest, and the advisor suggests a lounge', () => {
    const { sim, g } = knottedGuest(false);
    sim.drain();
    runUntil(sim, () => g.outcome !== '');
    expect(g.feelings).toContain('woozy');
    expect(g.state).toBe('leaving');
    expect(toasts(sim.drain()).join(' ')).toContain('Without a Recovery Lounge they go home woozy');
  });

  it('goes home woozy when every Recliner is taken, and the advisor suggests more', () => {
    const { sim, g } = knottedGuest(true);
    reclinerOf(sim).users[0] = 999;
    sim.drain();
    runUntil(sim, () => g.outcome !== '');
    expect(g.feelings).toContain('woozy');
    expect(toasts(sim.drain()).join(' ')).toContain('Add more Recliners');
  });
});

describe('the Treatments menu', () => {
  it('says which treatments need a rest, and warns without a lounge', () => {
    expect(restNote(undefined, false)).toBeNull();
    expect(restNote(true, true)).toEqual({ ok: true, text: '🛌 Rest after, in the Recovery Lounge' });
    expect(restNote(true, false)).toEqual({ ok: false, text: '⚠️ Rest after: needs a Recovery Lounge' });
  });
});
