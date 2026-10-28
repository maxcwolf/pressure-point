// Ailments going around: when one comes, what it opens, the door it leaves for guests the center cannot treat yet, and
// the switch that turns the feature on and off.
import { describe, expect, it } from 'vitest';

import {
  MODALITIES,
  modalityLabel,
  WAVE_AFTER_STAR,
  WAVE_DAYS,
  WAVE_MOVE_DAYS,
  WAVE_MOVES,
  WAVE_SOON_DAYS,
  WAVE_WARNING_DAYS,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { waveAdvice } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { arrivalPace, spawnGuest } from '../../src/core/sim/guests';
import { awardStar } from '../../src/core/sim/progress';
import { countVisit } from '../../src/core/sim/records';
import { Sim } from '../../src/core/sim/sim';
import {
  announceWave,
  updateWaves,
  waveArrival,
  waveChecks,
  waveClash,
  wavePerWeek,
  waveReady,
  waveTodo,
} from '../../src/core/sim/waves';
import { newGame, openedKit, techniqueOpen } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { treatmentsUnlockedAt } from '../../src/ui/lib/unlocks';
import { addAcupuncture, addRecovery, hire, openCenter } from './helpers';

/** A game at The Exchange, with ailments going around switched on or off, and a context on it. */
function exchange(on = true) {
  setSeed(1);
  const s = newGame('exchange');
  s.features.waves = on;
  s.rivalOn = false;
  s.mishapsOn = false;
  s.outbreaksOn = false;
  s.visitsOn = false;
  s.nextEmergency = 1e9;
  const sim = new Sim(s);
  return { sim, s: sim.s, ctx: createContext(sim.s) };
}

/** The Exchange's wave, announced today. */
function announced(on = true) {
  const c = exchange(on);
  c.s.stars = 1;
  announceWave(c.ctx, { condition: 'coldfeet', afterStar: 1, cause: '' });
  return c;
}

describe('when an ailment goes around', () => {
  it("is set by The Exchange's first star, due a month and a half after it", () => {
    const { s, ctx } = exchange();
    s.day = 100;
    awardStar(ctx);
    expect(s.nextWave).toEqual({ day: 100 + WAVE_AFTER_STAR - WAVE_WARNING_DAYS, moves: 0 });
  });

  it('is never at a center with none of its own', () => {
    setSeed(1);
    const s = newGame('willow');
    s.features.waves = true;
    awardStar(createContext(s));
    expect(s.nextWave).toBeNull();
  });

  it('waits a week while something else wants a decision, a few times at most', () => {
    const { s, ctx } = exchange();
    s.stars = 1;
    s.day = 50;
    s.nextWave = { day: 50, moves: 0 };
    s.nextEmergency = 55;
    expect(waveClash(s)).toBe('emergency');
    updateWaves(ctx);
    expect(s.wave).toBeNull();
    expect(s.nextWave).toEqual({ day: 50 + WAVE_MOVE_DAYS, moves: 1 });
    s.nextWave = { day: 50, moves: WAVE_MOVES };
    updateWaves(ctx);
    expect(s.wave?.condition).toBe('coldfeet');
  });

  it('does not come once the star it opens early has been earned', () => {
    const { s, ctx } = exchange();
    s.stars = 2;
    s.nextWave = { day: 0, moves: 0 };
    updateWaves(ctx);
    expect(s.wave).toBeNull();
    expect(s.nextWave).toBeNull();
  });

  it('does not come with the feature off', () => {
    const { s, ctx } = exchange(false);
    s.stars = 1;
    s.nextWave = { day: 0, moves: 0 };
    updateWaves(ctx);
    expect(s.wave).toBeNull();
  });
});

describe('an ailment going around', () => {
  it('opens its technique and its kit ahead of their star, and they stay open', () => {
    const { s, ctx } = announced();
    expect(s.wave).toMatchObject({ condition: 'coldfeet', opened: true, starts: s.day + WAVE_WARNING_DAYS });
    expect(MODALITIES.moxa.star).toBe(2);
    expect(techniqueOpen(s, 'moxa')).toBe(true);
    expect(openedKit(s)).toEqual(['moxa_burner']);
    const events = drainEvents(ctx);
    expect(events.some((e) => e.type === 'wave')).toBe(true);
    expect(events.some((e) => e.type === 'announce' && e.text.startsWith('Cold Feet is going around.'))).toBe(true);
    s.day = s.wave!.ends;
    updateWaves(ctx);
    expect(s.wave).toBeNull();
    expect(s.pastWaves).toHaveLength(1);
    expect(techniqueOpen(s, 'moxa')).toBe(true);
  });

  it('is left out of the next star’s unlocks, as it is open already', () => {
    /** Every discipline switched on. */
    const all = () => true;
    /** The names of the treatments star 2 unlocks, leaving out those opened already. */
    const names = (opened: 'moxa'[] = []) => treatmentsUnlockedAt(2, all, opened).map((l) => l.text);
    expect(names()).toContain(modalityLabel('moxa'));
    expect(names(['moxa'])).not.toContain(modalityLabel('moxa'));
  });

  it('comes once', () => {
    const { s, ctx } = announced();
    s.day = s.wave!.ends;
    updateWaves(ctx);
    s.nextWave = { day: s.day, moves: 0 };
    updateWaves(ctx);
    expect(s.wave).toBeNull();
  });

  it('says its size as guests a week: a third of the usual guests, spread over the month', () => {
    expect(wavePerWeek(30)).toBeCloseTo((30 / 3) * (7 / 30));
  });

  it('brings guests on top of the usual ones only while it runs', () => {
    const { s, ctx } = announced();
    expect(arrivalPace(ctx).wave).toBe(0);
    s.day = s.wave!.starts;
    const pace = arrivalPace(ctx);
    expect(pace.wave).toBeCloseTo(pace.tables / 3);
    s.day = s.wave!.starts + WAVE_DAYS;
    expect(arrivalPace(ctx).wave).toBe(0);
  });

  it('turns a guest the center cannot treat yet back at the door, at no cost', () => {
    const { s, ctx } = announced();
    s.day = s.wave!.starts;
    const before = { money: s.money, reputation: s.reputation, turnedAway: s.stats.turnedAway };
    expect(waveChecks(ctx, 'moxa')).toMatchObject({ qualified: false, kit: false });
    // a share as large as the whole pace makes every arrival one with the ailment
    expect(waveArrival(ctx, 10, 10)).toBe('turned');
    expect(s.wave).toMatchObject({ turned: 1, came: 0 });
    expect(s.stats.later).toBe(1);
    expect({ money: s.money, reputation: s.reputation, turnedAway: s.stats.turnedAway }).toEqual(before);
    expect(drainEvents(ctx).some((e) => e.type === 'float' && e.text === 'Cold Feet: next time')).toBe(true);
  });

  it('has the advisor say what getting ready takes, or that it may pass', () => {
    const { s, ctx } = announced();
    expect(waveAdvice(ctx)).toBe('Cold Feet goes around in 7 days. Build an Acupuncture Clinic, or let it pass.');
    s.day = s.wave!.starts;
    expect(waveAdvice(ctx)).toBe('');
    s.wave!.turned = 1;
    expect(waveAdvice(ctx)).toBe(
      'Guests with Cold Feet are coming back later. Build an Acupuncture Clinic to see them.',
    );
  });

  it('counts a guest of its healed after its month is over', () => {
    const { sim, s } = openCenter();
    const ctx = createContext(s);
    const g = spawnGuest(ctx, 'coldfeet')!;
    g.wave = true;
    s.pastWaves = [
      {
        condition: 'coldfeet',
        warned: 0,
        starts: 7,
        ends: 37,
        opened: true,
        begun: true,
        came: 1,
        healed: 0,
        turned: 0,
      },
    ];
    countVisit(ctx, g, 'healed');
    expect(s.pastWaves[0]?.healed).toBe(1);
    expect(sim.s.wave).toBeNull();
  });

  it('lets its guests in only once the Recovery Lounge is built too, when its technique needs a rest', () => {
    const { sim, s } = openCenter();
    const ctx = createContext(s);
    s.opened = ['moxa'];
    addAcupuncture(sim);
    expect(sim.placeItem('moxa_burner', 27, 9, 0)).not.toBeNull();
    hire(sim, 'acupuncturist').quals.push('moxa');
    expect(waveChecks(ctx, 'moxa')).toEqual({ room: true, qualified: true, kit: true, rest: false });
    expect(waveReady(ctx, 'moxa')).toBe(false);
    expect(waveTodo(ctx, 'moxa')).toBe('Build a Recovery Lounge for the rest after Moxibustion');
    addRecovery(sim);
    expect(waveReady(ctx, 'moxa')).toBe(true);
    expect(waveTodo(ctx, 'moxa')).toBe('');
  });
});

describe('the feature switch', () => {
  it('ends a wave quietly when switched off, leaving what it opened open', () => {
    const { sim, s } = announced();
    sim.setFeature('waves', false);
    expect(s.wave).toBeNull();
    expect(techniqueOpen(s, 'moxa')).toBe(true);
    expect(sim.featureOn('waves')).toBe(false);
  });

  it('brings a wave it ended back round when switched on again, with its week of warning', () => {
    const { sim, s, ctx } = announced();
    const warned = s.day;
    s.day += 10;
    updateWaves(ctx);
    sim.setFeature('waves', false);
    // not one that has been, but one due again
    expect(s.pastWaves).toEqual([]);
    expect(s.nextWave?.day).toBe(warned);
    s.day += 20;
    sim.setFeature('waves', true);
    // its day went by while it was off, so it comes in a week rather than the moment the switch is on
    expect(s.nextWave).toEqual({ day: s.day + WAVE_SOON_DAYS, moves: 0 });
    updateWaves(ctx);
    expect(s.wave).toBeNull();
    s.day += WAVE_SOON_DAYS;
    updateWaves(ctx);
    expect(s.wave?.condition).toBe('coldfeet');
    expect(s.wave?.starts).toBe(s.day + WAVE_WARNING_DAYS);
    expect(techniqueOpen(s, 'moxa')).toBe(true);
  });

  it('keeps a wave due within the week on its day when switched on', () => {
    const { sim, s } = exchange(false);
    s.stars = 1;
    s.day = 120;
    s.nextWave = { day: 123, moves: 1 };
    sim.setFeature('waves', true);
    expect(s.nextWave).toEqual({ day: 123, moves: 1 });
  });

  it('brings the wave within the week when switched on after the first star', () => {
    const { sim, s } = exchange(false);
    s.stars = 1;
    s.day = 120;
    sim.setFeature('waves', true);
    expect(s.nextWave?.day).toBeLessThanOrEqual(127);
  });

  it('is off in a new game unless switched on', () => {
    setSeed(1);
    const s = newGame('exchange');
    expect(new Sim(s).featureOn('waves')).toBe(false);
  });

  it('gates the cheat', () => {
    const off = exchange(false);
    expect(off.sim.cheat('wave')).toMatchObject({ ok: false });
    const on = exchange(true);
    on.s.stars = 1;
    expect(on.sim.cheat('wave')).toMatchObject({ ok: true });
    expect(on.s.wave?.condition).toBe('coldfeet');
    expect(on.sim.cheat('wave end')).toMatchObject({ ok: true });
    expect(on.s.wave).toBeNull();
  });
});

describe('a save from before ailments went around', () => {
  it('loads with none going around, nothing opened and every feature at its default', () => {
    const { s } = exchange();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    for (const key of ['wave', 'pastWaves', 'nextWave', 'opened', 'features']) Reflect.deleteProperty(old, key);
    Reflect.deleteProperty(old.stats as object, 'later');
    upgradeSave(old as unknown as GameState);
    const loaded = old as unknown as GameState;
    expect(loaded).toMatchObject({ wave: null, pastWaves: [], nextWave: null, opened: [], features: {} });
    expect(loaded.stats.later).toBe(0);
  });
});
