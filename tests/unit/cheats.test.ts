// The cheat console: its commands, and how a game they are used in stops counting for the campaign.
import { beforeEach, describe, expect, it } from 'vitest';

import { freshCampaign, karmaEarned } from '../../src/core/campaign';
import { CENTERS } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { checkAchievements } from '../../src/core/sim/achievements';
import { CHEAT_ORDER, CHEATS, MAX_SKIP_DAYS, parseAmount } from '../../src/core/sim/cheats';
import { createContext } from '../../src/core/sim/context';
import { Sim } from '../../src/core/sim/sim';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { giveKarma, loadCampaign, recordGame } from '../../src/storage/campaign';
import { consoleNote, recallStep } from '../../src/ui/lib/console';
import { freshSim, openCenter } from './helpers';

describe('the cheat console', () => {
  it('lists every command for help, and does not count help as cheating', () => {
    const sim = freshSim();
    const r = sim.cheat('help');
    expect(r.ok).toBe(true);
    for (const n of CHEAT_ORDER) expect(r.text).toContain(CHEATS[n].usage);
    expect(sim.s.cheated).toBe(false);
  });

  it('refuses what it does not know, without counting it as cheating', () => {
    const sim = freshSim();
    expect(sim.cheat('')).toMatchObject({ ok: false });
    expect(sim.cheat('moneyz')).toMatchObject({ ok: false, text: expect.stringContaining('moneyz') as string });
    expect(sim.cheat('money lots')).toMatchObject({ ok: false });
    expect(sim.s.cheated).toBe(false);
  });

  it('adds money, $10,000 unless told how much, and takes it away with a minus', () => {
    const sim = freshSim();
    const start = sim.s.money;
    expect(sim.cheat('money').ok).toBe(true);
    expect(sim.s.money).toBe(start + 10000);
    sim.cheat('MONEY $2.5k');
    expect(sim.s.money).toBe(start + 12500);
    sim.cheat('money -500');
    expect(sim.s.money).toBe(start + 12000);
    expect(sim.s.cheated).toBe(true);
  });

  it('reads amounts as typed', () => {
    expect(parseAmount('50,000')).toBe(50000);
    expect(parseAmount('$10k')).toBe(10000);
    expect(parseAmount('-20')).toBe(-20);
    expect(parseAmount('ten')).toBeNaN();
    expect(parseAmount('5x')).toBeNaN();
  });

  it('adds reputation, kept between 0 and 100', () => {
    const sim = freshSim();
    sim.s.reputation = 30;
    sim.cheat('rep');
    expect(sim.s.reputation).toBe(40);
    sim.cheat('rep 500');
    expect(sim.s.reputation).toBe(100);
    sim.cheat('rep -150');
    expect(sim.s.reputation).toBe(0);
  });

  it('hands karma back for the campaign to keep, since the game cannot', () => {
    const sim = freshSim();
    expect(sim.cheat('karma 6')).toMatchObject({ ok: true, karma: 6 });
    expect(sim.cheat('karma -6')).toMatchObject({ ok: false });
    expect(sim.cheat('karma 0').karma).toBeUndefined();
  });

  it('earns the next star with its prize, and every star with win', () => {
    const sim = freshSim();
    const start = sim.s.money;
    expect(sim.cheat('star').ok).toBe(true);
    expect(sim.s.stars).toBe(1);
    expect(sim.s.money).toBe(start + 5000);
    expect(sim.cheat('win').ok).toBe(true);
    expect(sim.s.stars).toBe(CENTERS.sandbox.goals.length);
    expect(sim.cheat('star').ok).toBe(false);
    expect(sim.cheat('win').ok).toBe(false);
    expect(sim.drain().filter((e) => e.type === 'star').length).toBeGreaterThan(0);
  });

  it('sends in guests once the center is open, with a condition if named', () => {
    expect(freshSim().cheat('guests')).toMatchObject({ ok: false });
    const { sim, s } = openCenter();
    s.open = true;
    const before = s.guests.length;
    expect(sim.cheat('guests 3 slump').ok).toBe(true);
    const sent = s.guests.slice(before);
    expect(sent).toHaveLength(3);
    expect(sent.every((g) => g.condition === 'slump')).toBe(true);
    expect(sim.cheat('guests slump 2').ok, 'in either order').toBe(true);
    expect(sim.cheat('guests 3 nonsense')).toMatchObject({ ok: false });
    expect(sim.cheat('guests 500')).toMatchObject({ ok: false });
  });

  it('offers an emergency and a stress outbreak on demand, one at a time', () => {
    const { sim, s } = openCenter();
    s.open = true;
    expect(sim.cheat('emergency').ok).toBe(true);
    expect(s.offer).not.toBeNull();
    expect(sim.cheat('emergency').ok).toBe(false);
    expect(sim.cheat('outbreak').ok).toBe(true);
    expect(s.outbreakOffer).not.toBeNull();
    expect(sim.cheat('outbreak').ok).toBe(false);
  });

  it('refuses an emergency when nobody could treat one', () => {
    const sim = freshSim();
    expect(sim.cheat('emergency').ok).toBe(false);
  });

  it('refreshes the staff and settles the guests', () => {
    const { sim, s, therapist } = openCenter();
    s.open = true;
    expect(freshSim().cheat('staff').ok).toBe(false);
    therapist.energy = 10;
    therapist.morale = 20;
    therapist.thirst = 90;
    expect(sim.cheat('staff').ok).toBe(true);
    expect(therapist).toMatchObject({ energy: 100, morale: 100, thirst: 0, hunger: 0 });
    expect(sim.cheat('happy').ok, 'with no guests yet').toBe(false);
    sim.cheat('guests 2');
    for (const g of s.guests) g.patience = 5;
    expect(sim.cheat('happy').ok).toBe(true);
    expect(s.guests.every((g) => g.patience === 100 && g.bladder === 0)).toBe(true);
  });

  it('unlocks everything, once', () => {
    const sim = freshSim();
    expect(sim.cheat('unlock').ok).toBe(true);
    expect(sim.s.unlockAll).toBe(true);
    expect(sim.cheat('unlock').ok).toBe(false);
  });

  it('skips ahead whole days, keeping the messages but not the noise', () => {
    const { sim, s } = openCenter();
    s.speed = 0;
    sim.drain();
    const day = s.day;
    expect(sim.cheat('skip 3').ok).toBe(true);
    expect(s.day).toBeCloseTo(day + 3, 6);
    expect(s.open, 'the game played on while paused').toBe(true);
    const events = sim.drain();
    expect(events.some((e) => e.type === 'sfx' || e.type === 'announce' || e.type === 'float')).toBe(false);
    expect(sim.cheat('skip 0').ok).toBe(false);
    expect(sim.cheat('skip 1.5').ok).toBe(false);
    expect(sim.cheat(`skip ${MAX_SKIP_DAYS + 1}`).ok).toBe(false);
  });
});

describe('a game the console has been used in', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });

  it('earns no achievements', () => {
    setSeed(1);
    const s = newGame('willow');
    s.money = 100_000;
    s.cheated = true;
    const ctx = createContext(s);
    checkAchievements(ctx);
    expect(s.achieved).toEqual([]);
    s.cheated = false;
    checkAchievements(ctx);
    expect(s.achieved).toContain('nest-egg');
  });

  it('records no stars or achievements for the campaign', () => {
    recordGame({ ...newGame('willow'), stars: 2, achieved: ['century'], cheated: true });
    expect(loadCampaign()).toEqual(freshCampaign());
    recordGame({ ...newGame('willow'), stars: 1 });
    expect(loadCampaign().stars).toEqual({ willow: 1 });
  });

  it('is remembered in its save, and an older save has not cheated', () => {
    const sim = new Sim(newGame('willow'));
    sim.cheat('money');
    const saved = JSON.parse(JSON.stringify(sim.s)) as GameState;
    upgradeSave(saved);
    expect(saved.cheated).toBe(true);
    const old: Partial<GameState> = JSON.parse(JSON.stringify(newGame('willow'))) as GameState;
    delete old.cheated;
    upgradeSave(old as GameState);
    expect(old.cheated).toBe(false);
  });
});

describe('karma from the console', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });

  it('adds to the karma earned, and is kept', () => {
    giveKarma(5);
    giveKarma(3);
    expect(loadCampaign().bonus).toBe(8);
    expect(karmaEarned(loadCampaign())).toBe(8);
    store.set('pressure-point-campaign', JSON.stringify({ bonus: -4 }));
    expect(loadCampaign().bonus, 'nothing unusable is read back').toBe(0);
  });
});

describe('what the console shows', () => {
  it('warns a campaign game before and after a command, and says nothing in the sandbox', () => {
    expect(consoleNote({ center: 'sandbox', cheated: true })).toBe('');
    expect(consoleNote({ center: 'willow', cheated: false })).toMatch(/stops/);
    expect(consoleNote({ center: 'willow', cheated: true })).toMatch(/Cheats used/);
  });

  it('steps back and forth through the commands typed', () => {
    expect(recallStep(0, null, -1)).toBeNull();
    expect(recallStep(3, null, -1)).toBe(2);
    expect(recallStep(3, 2, -1)).toBe(1);
    expect(recallStep(3, 0, -1), 'stays on the oldest').toBe(0);
    expect(recallStep(3, 1, 1)).toBe(2);
    expect(recallStep(3, 2, 1), 'past the newest is a new line').toBeNull();
    expect(recallStep(3, null, 1)).toBeNull();
  });
});
