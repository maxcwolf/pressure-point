import { describe, expect, it } from 'vitest';

import { CAMEO_CHANCE, CAMEOS, MODALITIES, ROLE_ORDER, ROLES } from '../../src/core/data';
import { fairSalary, randomName } from '../../src/core/people';
import { random, setSeed } from '../../src/core/random';
import { newGame, SAVE_VERSION } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { openCenter, run } from './helpers';

describe('random numbers', () => {
  it('repeat exactly for the same seed', () => {
    setSeed(42);
    const a = [random(), random(), random()];
    setSeed(42);
    expect([random(), random(), random()]).toEqual(a);
    expect(a.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('are roughly uniform', () => {
    setSeed(7);
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += random();
    expect(sum / 5000).toBeGreaterThan(0.47);
    expect(sum / 5000).toBeLessThan(0.53);
  });
});

describe('names', () => {
  it('mix in the cameo names at about the configured rate', () => {
    setSeed(3);
    let cameos = 0;
    const names = CAMEOS.map((c) => c.name);
    for (let i = 0; i < 3000; i++) if (names.includes(randomName(i % 2 ? 'female' : 'male'))) cameos++;
    expect(cameos / 3000).toBeGreaterThan(CAMEO_CHANCE * 0.7);
    expect(cameos / 3000).toBeLessThan(CAMEO_CHANCE * 1.3);
  });

  it('include the ones that were asked for', () => {
    expect(CAMEOS.map((c) => c.name)).toEqual(expect.arrayContaining(['Rang Dipkin', 'Bilb Ono', 'Hosta Mohogey']));
  });
});

describe('a new game', () => {
  it('starts closed, solvent and with three applicants per role', () => {
    setSeed(1);
    const s = newGame();
    expect(s.open).toBe(false);
    expect(s.money).toBe(30000);
    expect(s.loan).toBe(0);
    expect(s.priceLevel).toBe(1);
    for (const role of ROLE_ORDER) expect(s.candidates.filter((c) => c.role === role)).toHaveLength(3);
    expect(s.candidates.filter((c) => c.role === 'therapist').every((c) => c.quals.includes('swedish'))).toBe(true);
    expect(s.candidates.filter((c) => c.role === 'acupuncturist').every((c) => c.quals.includes('needling'))).toBe(
      true,
    );
    expect(s.candidates.filter((c) => !ROLES[c.role].discipline).every((c) => c.quals.length === 0)).toBe(true);
    // nobody starts with a qualification from another discipline
    expect(s.candidates.every((c) => c.quals.every((m) => MODALITIES[m].discipline === ROLES[c.role].discipline))).toBe(
      true,
    );
  });
});

describe('fair salaries', () => {
  it('rise with skill and with qualifications', () => {
    expect(fairSalary('therapist', 3, [], ['swedish'])).toBeGreaterThan(fairSalary('therapist', 2, [], ['swedish']));
    expect(fairSalary('therapist', 2, [], ['swedish', 'deep'])).toBeGreaterThan(
      fairSalary('therapist', 2, [], ['swedish']),
    );
  });
  it('reflect quirks', () => {
    expect(fairSalary('caretaker', 2, ['bargain'], [])).toBeLessThan(fairSalary('caretaker', 2, [], []));
    expect(fairSalary('caretaker', 2, ['brisk'], [])).toBeGreaterThan(fairSalary('caretaker', 2, [], []));
  });
});

describe('older saves', () => {
  it('brings a first-version save up to date', () => {
    const { sim, s } = openCenter(2);
    run(sim, 30);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    old.version = 1;
    for (const st of old.staff)
      for (const k of ['quals', 'training', 'strain', 'morale', 'raiseAsked', 'unhappyT'])
        Reflect.deleteProperty(st, k);
    for (const c of old.candidates) delete c.quals;
    for (const it of old.items) delete it.wear;
    for (const k of ['loan', 'priceLevel', 'offer', 'emergency', 'nextEmergency', 'announceT'])
      Reflect.deleteProperty(old, k);
    delete old.ledger.training;
    delete old.ledger.interest;
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.version).toBe(SAVE_VERSION);
    expect(up.staff.find((x) => x.role === 'therapist')!.quals).toEqual(['swedish']);
    expect(up.staff.every((x) => x.morale === 75 && x.training === null)).toBe(true);
    expect(up.items.every((i) => i.wear === 0)).toBe(true);
    expect(up.priceLevel).toBe(1);
    expect(up.ledger.interest).toBe(0);
    expect(up.nextEmergency).toBeGreaterThan(up.day);
  });
});

describe('a save from before the policy', () => {
  it('gets the standard policy, no priority rooms, and nobody sent home', () => {
    const { sim, s } = openCenter(2);
    run(sim, 30);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    old.version = 4;
    delete old.policy;
    delete old.stats.sent;
    delete old.tally.sent;
    for (const r of old.rooms) delete r.priority;
    for (const g of old.guests) delete g.placed;
    upgradeSave(old as GameState);
    const up = old as GameState;
    expect(up.policy).toEqual({
      diagnosis: 0.75,
      emergenciesFirst: false,
      breakAt: 18,
      breakLimit: {},
      stashMushrooms: true,
    });
    expect(up.rooms.every((r) => !r.priority)).toBe(true);
    expect(up.guests.every((g) => !g.placed)).toBe(true);
    expect(up.stats.sent).toBe(0);
    expect(up.tally.sent).toBe(0);
  });
});
