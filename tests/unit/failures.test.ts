// Why a treatment failed: the reasons are the terms the roll was made of, each with its size, the failure is said where
// it is noticed and kept for the casebook.
import { describe, expect, it } from 'vitest';

import {
  BASE_CHANCE,
  BOTCH_FACTOR,
  GUESS_PENALTY,
  MAX_CHANCE,
  MIN_CHANCE,
  ROLES,
  SKILL_SUCCESS,
  TIRED_PENALTY,
  UPGRADE_LEVELS,
  UPGRADE_SUCCESS,
} from '../../src/core/data';
import type { SimContext } from '../../src/core/sim/context';
import {
  failRate,
  failureCause,
  failureOf,
  failureReasons,
  FAILURES_KEPT,
  failureText,
  recordFailure,
} from '../../src/core/sim/failures';
import type { Sim } from '../../src/core/sim/sim';
import { type Chance, settledChance, successChance } from '../../src/core/sim/stations';
import type { FailedTreatment } from '../../src/core/state/types';
import { causeText, failureBreakdown, failureHead, failureLines } from '../../src/ui/lib/failures';
import { hire, openCenter, runUntil } from './helpers';

/** The chance a member of staff with Healing Hands has to save a treatment that failed. */
const HANDS = 1 / 3;

/** The simulation's own context, for the functions that take it. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/**
 * A center with a guest at the massage table, set so nothing is wrong: an Experienced therapist trained in it and
 * rested, a certain diagnosis, a guest in good shape and a calm, clean room.
 */
function atTable(seed = 1) {
  const c = openCenter(seed);
  runUntil(c.sim, () => c.s.guests.length > 0, 300);
  const g = c.s.guests[0]!;
  const table = c.s.items.find((i) => i.type === 'massage_table')!;
  Object.assign(c.therapist, { energy: 100, skill: 3 });
  Object.assign(g, { health: 100, diagnosis: 1, condition: 'slump' });
  c.therapist.quals = ['swedish'];
  c.massage.vibes = 0;
  table.dirt = 0;
  const ctx = ctxOf(c.sim);
  /** The chance now, and the reasons it would fail for. */
  const odds = () => {
    const chance = successChance(ctx, table, c.therapist, g);
    return { ...chance, reasons: failureReasons(ctx, table, c.therapist, g, chance) };
  };
  return { ...c, g, table, ctx, odds };
}

/** A guest with Stiff Shoulders at a massage table in a room with a Stretch Rack, and a therapist not trained in it. */
function withRack() {
  const c = atTable();
  c.s.stars = 3;
  expect(c.sim.placeItem('stretch_rack', 14, 7, 0)).not.toBeNull();
  c.g.condition = 'stiff';
  c.therapist.quals = ['swedish'];
  return c;
}

/** One term of a chance, by what it is. */
const term = (c: Chance, cause: string) => c.factors.find((f) => f.cause === cause)?.amount ?? 0;

/** One reason, by what it is. */
const reason = (r: { reasons: FailedTreatment['reasons'] }, cause: string) => r.reasons.find((x) => x.cause === cause);

describe('the chance of a treatment working', () => {
  it('is its terms added up, kept between the least and the most, and cut by a botch', () => {
    const { odds, therapist } = atTable();
    for (const quals of [['swedish'], []] as const) {
      therapist.quals = [...quals];
      const c = odds();
      const sum = c.factors.reduce((n, f) => n + f.amount, BASE_CHANCE);
      expect(c.proper).toBe(Math.min(MAX_CHANCE, Math.max(MIN_CHANCE, sum)));
      expect(c.chance).toBe(c.problem ? c.proper * BOTCH_FACTOR : c.proper);
    }
  });

  it('moves by exactly what each term says when one thing changes', () => {
    const { odds, therapist, g, table, massage } = atTable(2);
    // kept off the cap so each change shows in full
    therapist.skill = 1;
    const plain = odds();
    therapist.skill = 2;
    expect(odds().chance - plain.chance).toBeCloseTo(SKILL_SUCCESS);
    therapist.skill = 1;
    g.guessed = true;
    expect(term(odds(), 'guess')).toBe(-GUESS_PENALTY);
    expect(odds().chance - plain.chance).toBeCloseTo(-GUESS_PENALTY);
    g.guessed = false;
    therapist.energy = 5;
    expect(term(odds(), 'tired')).toBe(-TIRED_PENALTY);
    expect(odds().chance - plain.chance).toBeCloseTo(-TIRED_PENALTY);
    therapist.energy = 100;
    massage.vibes = 100;
    const vibes = term(odds(), 'vibes');
    expect(vibes).toBeLessThan(0);
    expect(odds().chance - plain.chance).toBeCloseTo(vibes);
    massage.vibes = 0;
    table.level = 2;
    expect(term(odds(), 'upgrade')).toBeCloseTo(2 * UPGRADE_SUCCESS);
    expect(odds().chance - plain.chance).toBeCloseTo(2 * UPGRADE_SUCCESS);
  });
});

describe('why a treatment failed', () => {
  it('names each thing that went against it, with what it took off', () => {
    const { odds, therapist, g, massage } = atTable();
    // a Trainee, so the chance is well off the most it can be and each thing wrong takes off its all
    therapist.skill = 1;
    therapist.energy = 5;
    g.health = 50;
    massage.vibes = 100;
    const r = odds();
    expect(reason(r, 'tired')?.text).toBe(`${therapist.name} was worn out`);
    expect(reason(r, 'tired')?.amount).toBeCloseTo(TIRED_PENALTY);
    expect(reason(r, 'worse')?.text).toBe(`${g.name} had gotten worse while waiting`);
    expect(reason(r, 'worse')?.amount).toBeCloseTo(-term(r, 'worse'));
    expect(reason(r, 'vibes')?.text).toBe('Bad vibes in the Massage Suite');
    expect(reason(r, 'vibes')?.amount).toBeCloseTo(-term(r, 'vibes'));
    // biggest first, and counted under the biggest thing wrong
    expect(r.reasons.map((x) => x.amount)).toEqual([...r.reasons.map((x) => x.amount)].sort((a, b) => b - a));
    expect(failureCause(r.problem, r.reasons)).toBe(r.reasons.find((x) => x.cause !== 'skill')?.cause);
  });

  it('sizes each reason by how much putting it right alone would raise the chance, the limits and botch and all', () => {
    const { odds, therapist, g, massage, table } = atTable(2);
    for (const [energy, health, vibes, quals, skill] of [
      [5, 50, 100, ['swedish'], 3],
      [5, 0, 100, [], 1],
      [100, 100, 0, ['swedish'], 5],
    ] as const) {
      Object.assign(therapist, { energy, quals: [...quals], skill });
      g.health = health;
      massage.vibes = vibes;
      table.level = 0;
      const c = odds();
      for (const r of c.reasons) {
        const f = c.factors.find((x) => x.cause === r.cause);
        // what was put right: the term at its best, or the botch gone
        const fixed = f
          ? settledChance(c.raw - f.amount + (f.best ?? 0), c.problem).chance
          : settledChance(c.raw, '').chance;
        expect(r.amount, r.cause).toBeCloseTo(fixed - c.chance);
      }
    }
  });

  it('lists a shortfall against the best there could be, but does not blame it', () => {
    const { odds, therapist, g, table } = atTable();
    therapist.skill = 1;
    g.diagnosis = 0.6;
    table.level = 0;
    const r = odds();
    expect(reason(r, 'skill')).toMatchObject({ text: `${therapist.name}’s rank is Trainee, not Expert` });
    // an Expert's hands would take it to the most a chance can be, and no further
    expect(reason(r, 'skill')?.amount).toBeCloseTo(Math.min(MAX_CHANCE, r.raw + 4 * SKILL_SUCCESS) - r.chance);
    expect(reason(r, 'diagnosis')?.text).toBe('The diagnosis was only 60% sure');
    expect(reason(r, 'upgrade')?.amount).toBeCloseTo(UPGRADE_LEVELS * UPGRADE_SUCCESS);
    expect(failureCause(r.problem, r.reasons)).toBe('odds');
  });

  it('puts an untrained hand first, with what the botch took off, and cuts the rest with it', () => {
    const { odds, therapist } = atTable();
    therapist.energy = 5;
    therapist.quals = [];
    const r = odds();
    expect(r.problem).toBe('unqualified');
    expect(r.reasons[0]).toMatchObject({
      cause: 'unqualified',
      text: `${therapist.name} is not trained in Swedish massage`,
    });
    expect(r.reasons[0]?.amount).toBeCloseTo(r.proper * (1 - BOTCH_FACTOR));
    expect(reason(r, 'tired')?.amount).toBeCloseTo(TIRED_PENALTY * BOTCH_FACTOR);
    expect(failureCause(r.problem, r.reasons)).toBe('unqualified');
  });

  it('is what the roll was made of: each failure in a busy game matches the chance its guest had on the table', () => {
    const { sim, s, therapist } = atTable(3);
    // an untrained therapist fails often, and tires as the day goes
    therapist.quals = [];
    const ctx = ctxOf(sim);
    let checked = 0;
    for (let i = 0; i < 6000 && checked < 6; i++) {
      // the chance each guest on a table has this moment, which is what the roll at the end of this step uses
      const before = new Map<number, { c: Chance; table: number }>();
      for (const g of s.guests) {
        const c = g.state === 'served' ? sim.chanceFor(g) : null;
        if (c) before.set(g.id, { c, table: g.station });
      }
      const seen = s.failures?.length ?? 0;
      sim.tick(0.1);
      for (const f of (s.failures ?? []).slice(seen)) {
        const was = before.get(f.guestId);
        expect(was, f.guest).toBeDefined();
        if (!was) continue;
        // the room's vibes fade a little within the step, before the roll, so the chance moves in its fifth place at most
        expect(f.chance).toBeCloseTo(was.c.chance, 4);
        // and what each reason took off is read off that chance alone
        const g = s.guests.find((x) => x.id === f.guestId)!;
        const table = s.items.find((x) => x.id === was.table)!;
        const again = failureReasons(ctx, table, therapist, g, was.c);
        expect(f.reasons.map((x) => x.cause)).toEqual(again.map((x) => x.cause));
        f.reasons.forEach((x, n) => expect(x.amount).toBeCloseTo(again[n]?.amount ?? 0, 4));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(s.failures?.length).toBe(s.stats.failed);
  });
});

describe('a failed treatment', () => {
  it('is said at once: which treatment, for whom, where, at what chance and why', () => {
    const { ctx, s, table, therapist, g, odds, sim } = atTable();
    therapist.energy = 5;
    sim.drain();
    const f = recordFailure(ctx, table, therapist, g, odds(), 0);
    const [toast] = sim.drain().filter((e) => e.type === 'toast');
    expect(toast).toMatchObject({ kind: 'bad', about: { kind: 'guest', id: g.id }, key: 'failed:swedish' });
    expect(toast?.type === 'toast' && toast.text).toBe(failureText(f));
    expect(failureText(f)).toMatch(
      new RegExp(
        `^Swedish massage failed for ${g.name} in the Massage Suite, at \\d+%: ${therapist.name} was worn out \\(−15%\\)`,
      ),
    );
    expect(s.failures).toEqual([f]);
    expect(failureOf(s.failures, g.id)).toBe(f);
  });

  it('owns up to bad luck when nothing much was wrong, at the rate it really fails, Healing Hands and all', () => {
    const { ctx, table, therapist, g, odds } = atTable();
    therapist.skill = 1;
    const c = odds();
    const f = recordFailure(ctx, table, therapist, g, c, HANDS);
    expect(f.cause).toBe('odds');
    expect(f.limit).toBeUndefined();
    expect(failRate(f)).toBeCloseTo((1 - c.chance) * (1 - HANDS));
    expect(failureText(f)).toContain(
      `: bad luck, which comes ${Math.round(failRate(f) * 100)}% of the time. Biggest shortfall: `,
    );
    expect(failureText(f)).toMatch(new RegExp(`${therapist.name}’s Healing Hands could not save it\\.$`));
    expect(failureLines(f)[0]?.text).toBe(`Bad luck: it fails ${Math.round(failRate(f) * 100)}% of the time`);
  });

  it('says plainly, at the most any treatment can be, that there is nothing to fix', () => {
    const { ctx, table, therapist, g, odds } = atTable();
    // an Expert, a certain diagnosis and the table fully upgraded: more than the most a chance can be
    therapist.skill = 5;
    table.level = UPGRADE_LEVELS;
    const c = odds();
    expect(c.raw).toBeGreaterThan(MAX_CHANCE);
    // nothing short of its best counts, since putting it right could not raise the chance
    expect(c.reasons).toEqual([]);
    const f = recordFailure(ctx, table, therapist, g, c, 0);
    expect(f).toMatchObject({ cause: 'odds', limit: 'ceiling' });
    expect(failureText(f)).toMatch(/: bad luck, a 2% chance any treatment fails, however well it’s set up\.$/);
    expect(failureBreakdown([f])[0]?.fix).toBe('Nothing to fix: no treatment is surer than 98%');
  });

  it('puts an untrained hand at a specialty item down to the room it is in, and says to train them', () => {
    const { ctx, s, sim, table, therapist, g, odds } = withRack();
    const f = recordFailure(ctx, table, therapist, g, odds(), 0);
    expect(f.cause).toBe('unqualified');
    expect(f.fix).toBe(
      `The Stretch Rack in the Massage Suite brings Sports massage guests. Nobody else at work is trained in it: send ${therapist.name} on the Sports massage course in a Training Room, or hire a ${ROLES.therapist.name} who is.`,
    );
    expect(failureText(f)).toContain('is not trained in Sports massage (−');
    expect(failureText(f).endsWith(` ${f.fix}`)).toBe(true);
    // and the casebook works the same out afresh, which says nothing once they are trained
    expect(failureBreakdown([f], (x) => sim.failureFix(x))[0]?.fix).toBe(f.fix);
    therapist.quals.push('sports');
    expect(sim.failureFix(f)).toBeUndefined();
    expect(failureBreakdown([f], (x) => sim.failureFix(x))[0]?.fix).toMatch(/Training Room/);
    expect(s.failures).toEqual([f]);
  });

  it('keeps an untrained hand out of a room a trained colleague already works in', () => {
    const { ctx, sim, table, therapist, g, odds } = withRack();
    const sam = hire(sim, 'therapist');
    sam.quals = ['swedish', 'sports'];
    // new staff work anywhere, so Sam can already work in the Massage Suite
    expect(sam.rooms).toEqual([]);
    const f = recordFailure(ctx, table, therapist, g, odds(), 0);
    expect(f.fix).toBe(
      `The Stretch Rack in the Massage Suite brings Sports massage guests. ${sam.name}, who is trained in it, already works there: assign ${therapist.name} to other rooms from their inspector, or send ${therapist.name} on the Sports massage course.`,
    );
  });

  it('assigns a trained colleague to the room when they work elsewhere, and leaves out one who is away', () => {
    const { ctx, sim, table, therapist, g, odds, consult } = withRack();
    const sam = hire(sim, 'therapist');
    sam.quals = ['swedish', 'sports'];
    sam.rooms = [consult.id];
    expect(recordFailure(ctx, table, therapist, g, odds(), 0).fix).toBe(
      `The Stretch Rack in the Massage Suite brings Sports massage guests. ${sam.name} is trained in it: assign them to the Massage Suite from their inspector, or send ${therapist.name} on the Sports massage course.`,
    );
    sam.state = 'training';
    expect(recordFailure(ctx, table, therapist, g, odds(), 0).fix).toMatch(/^The Stretch Rack .+ Nobody else at work/);
  });

  it('says to train an untrained hand where no specialty item draws the guests', () => {
    const { ctx, table, therapist, g, odds } = atTable();
    therapist.quals = [];
    const f = recordFailure(ctx, table, therapist, g, odds(), 0);
    expect(f.fix).toBe(
      `Nobody else at work is trained in it: send ${therapist.name} on the Swedish massage course in a Training Room, or hire a ${ROLES.therapist.name} who is.`,
    );
  });

  it(`keeps only the latest ${FAILURES_KEPT}`, () => {
    const { ctx, s, table, therapist, g, odds } = atTable();
    for (let i = 0; i < FAILURES_KEPT + 5; i++) recordFailure(ctx, table, therapist, g, odds(), 0);
    expect(s.failures).toHaveLength(FAILURES_KEPT);
  });

  it('shows in the guest’s inspector: the treatment, the place, the practitioner, and the main reason first', () => {
    const { ctx, table, therapist, g, odds, massage } = atTable();
    therapist.skill = 1;
    massage.vibes = 100;
    const f = recordFailure(ctx, table, therapist, g, odds(), 0);
    expect(failureHead(f)).toMatch(
      new RegExp(`^Swedish massage in the Massage Suite, given by ${therapist.name}, at a \\d+% chance$`),
    );
    const lines = failureLines(f);
    expect(lines[0]).toMatchObject({ text: 'Bad vibes in the Massage Suite', main: true });
    expect(lines.filter((l) => l.main)).toHaveLength(1);
  });
});

describe('the breakdown of failed treatments', () => {
  /** A failure of one technique, counted under one cause. */
  const failure = (modality: 'swedish' | 'hotstone', cause: string, amount: number, chance = 0.5) =>
    ({
      modality,
      cause,
      chance,
      reasons: cause === 'odds' ? [{ cause: 'prestige', text: '', amount: 0.08 }] : [{ cause, text: '', amount }],
    }) as FailedTreatment;

  it('groups by technique, the one that failed most first, its commonest cause first, and its fix', () => {
    const rows = failureBreakdown([
      failure('swedish', 'tired', 0.15),
      failure('hotstone', 'unqualified', 0.4),
      failure('hotstone', 'unqualified', 0.5),
      failure('hotstone', 'tired', 0.15),
    ]);
    expect(rows.map((r) => r.modality)).toEqual(['hotstone', 'swedish']);
    expect(rows[0]?.causes.map(causeText)).toEqual(['Untrained ×2, −45%', 'Worn-out staff ×1, −15%']);
    expect(rows[0]?.fix).toMatch(/Training Room/);
    expect(rows[1]?.fix).toMatch(/Staff Room/);
  });

  it('points a run of bad luck at the biggest shortfall, such as a plain room', () => {
    const [row] = failureBreakdown([failure('swedish', 'odds', 0, 0.8), failure('swedish', 'odds', 0, 0.9)]);
    expect(row?.causes.map(causeText)).toEqual(['Bad luck ×2, at 85%']);
    expect(row?.fix).toMatch(/Decorate/);
  });
});
