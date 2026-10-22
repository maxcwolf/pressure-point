// Karma: earned by campaign stars and achievements, spent on items that stay unlocked in every game.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CampaignProgress,
  cannotBuy,
  freshCampaign,
  itemOpen,
  karmaEarned,
  karmaLeft,
  withAchievements,
  withUnlock,
} from '../../src/core/campaign';
import {
  ACHIEVEMENT_ORDER,
  ACHIEVEMENTS,
  CAMPAIGN,
  CENTERS,
  ITEMS,
  KARMA_ITEMS,
  STAR_KARMA,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { checkAchievements } from '../../src/core/sim/achievements';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { seatDrain } from '../../src/core/sim/guests';
import { Sim } from '../../src/core/sim/sim';
import { newGame, unlockedUpTo } from '../../src/core/state/game';
import type { GameState, Guest } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { buyWithKarma, loadCampaign, recordGame } from '../../src/storage/campaign';
import { loadSandbox, saveSandbox } from '../../src/storage/settings';
import { achievementCards, lockLabel, shopCards } from '../../src/ui/lib/karma';
import { toasts } from './helpers';

/** Campaign progress with some stars and achievements. */
const progress = (fields: Partial<CampaignProgress>): CampaignProgress => ({ ...freshCampaign(), ...fields });

describe('karma', () => {
  it('is earned by every campaign star and achievement', () => {
    expect(karmaEarned(freshCampaign())).toBe(0);
    const p = progress({ stars: { willow: 3, exchange: 1, sandbox: 3 }, achieved: ['century', 'called-in'] });
    expect(karmaEarned(p)).toBe(4 * STAR_KARMA + ACHIEVEMENTS.century.karma + ACHIEVEMENTS['called-in'].karma);
  });

  it('is enough, once everything in the campaign is done, to unlock every item it can', () => {
    const stars = Object.fromEntries(CAMPAIGN.map((id) => [id, CENTERS[id].goals.length]));
    const all = progress({ stars, achieved: [...ACHIEVEMENT_ORDER] });
    const prices = KARMA_ITEMS.reduce((sum, t) => sum + (ITEMS[t].karma ?? 0), 0);
    expect(karmaEarned(all)).toBe(prices);
  });

  it('buys an item once, only when there is enough', () => {
    const p = progress({ stars: { willow: 2 } });
    expect(karmaLeft(p)).toBe(4);
    expect(cannotBuy(p, 'aquarium')).toBe('short');
    expect(cannotBuy(p, 'plant')).toBe('not-for-karma');
    expect(withUnlock(p, 'aquarium')).toBe(p);
    const after = withUnlock(p, 'bonsai');
    expect(after.unlocked).toEqual(['bonsai']);
    expect(karmaLeft(after)).toBe(1);
    expect(cannotBuy(after, 'bonsai')).toBe('owned');
    expect(withUnlock(after, 'bonsai')).toBe(after);
  });

  it('only buys items that are not treatment equipment', () => {
    expect(KARMA_ITEMS).toContain('koi_pond');
    expect(KARMA_ITEMS).toContain('aquarium');
    for (const t of ['stretch_rack', 'moxa_burner', 'singing_bowls'] as const) expect(KARMA_ITEMS).not.toContain(t);
  });
});

describe('a locked item', () => {
  it('opens at its star, with karma, or with everything unlocked; a karma-only one never opens by stars', () => {
    expect(itemOpen(ITEMS.aquarium, 1, [])).toBe(false);
    expect(itemOpen(ITEMS.aquarium, 2, [])).toBe(true);
    expect(itemOpen(ITEMS.aquarium, 0, ['aquarium'])).toBe(true);
    expect(itemOpen(ITEMS.koi_pond, 3, [])).toBe(false);
    expect(itemOpen(ITEMS.koi_pond, 0, ['koi_pond'])).toBe(true);
    expect(itemOpen(ITEMS.koi_pond, Infinity, [])).toBe(true);
    expect(itemOpen(ITEMS.plant, 0, [])).toBe(true);
  });

  it('says what unlocks it', () => {
    expect(lockLabel(ITEMS.aquarium)).toBe('Star 2, or 5 karma');
    expect(lockLabel(ITEMS.koi_pond)).toBe('6 karma');
    expect(lockLabel(ITEMS.moxa_burner)).toBe('Unlocks at star 2');
  });
});

describe('the karma shop and achievements on the title screen', () => {
  it('show what is unlocked, affordable and not yet', () => {
    const cards = shopCards(progress({ stars: { willow: 3 }, unlocked: ['bookcase'] }));
    /** How the shop shows an item. */
    const state = (t: string) => cards.find((c) => c.type === t)?.state;
    expect(cards.map((c) => c.type)).toEqual(KARMA_ITEMS);
    expect([state('bookcase'), state('arcade_machine'), state('koi_pond')]).toEqual(['owned', 'buy', 'short']);
    const feats = achievementCards(progress({ achieved: ['century'] }));
    expect(feats.map((a) => a.id)).toEqual(ACHIEVEMENT_ORDER);
    expect(feats.filter((a) => a.done).map((a) => a.id)).toEqual(['century']);
  });
});

describe('achievements', () => {
  /** A fresh game's context in a center. */
  const game = (center: GameState['center']) => {
    setSeed(1);
    return createContext(newGame(center));
  };

  it('are noticed in a campaign game, once each, with a message', () => {
    const ctx = game('willow');
    checkAchievements(ctx);
    expect(ctx.s.achieved).toEqual([]);
    ctx.s.stats.emergencies = 1;
    ctx.s.stats.healed = 100;
    checkAchievements(ctx);
    expect(ctx.s.achieved).toEqual(['called-in', 'century']);
    expect(toasts(drainEvents(ctx))).toEqual([
      'Achievement: Called In! +2 karma to spend in any center.',
      'Achievement: Century! +3 karma to spend in any center.',
    ]);
    checkAchievements(ctx);
    expect(drainEvents(ctx)).toEqual([]);
  });

  it('are not earned in the sandbox', () => {
    const ctx = game('sandbox');
    ctx.s.stats.healed = 500;
    checkAchievements(ctx);
    expect(ctx.s.achieved).toEqual([]);
  });

  it('merge in their listed order, without repeats', () => {
    expect(withAchievements(['century'], ['called-in', 'century'])).toEqual(['called-in', 'century']);
  });
});

describe('the campaign kept between games', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
      /** Forget a stored value. */
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });

  it("records a game's stars and achievements, and spends karma on items", () => {
    recordGame({ ...newGame('willow'), stars: 2, achieved: ['century'] });
    recordGame({ ...newGame('exchange'), stars: 0, achieved: ['called-in'] });
    expect(loadCampaign()).toEqual({
      stars: { willow: 2 },
      achieved: ['called-in', 'century'],
      unlocked: [],
      decor: [],
      bonus: 0,
    });
    expect(buyWithKarma('koi_pond')).toBe(true);
    expect(buyWithKarma('koi_pond')).toBe(false);
    expect(buyWithKarma('trophy_cabinet')).toBe(false);
    expect(loadCampaign().unlocked).toEqual(['koi_pond']);
    expect(karmaLeft(loadCampaign())).toBe(3);
  });

  it('drops achievements and items this version does not know', () => {
    store.set(
      'pressure-point-campaign',
      JSON.stringify({ stars: {}, achieved: ['century', 'moonwalk'], unlocked: ['koi_pond', 'plant', 'jacuzzi', 3] }),
    );
    expect(loadCampaign()).toMatchObject({ achieved: ['century'], unlocked: ['koi_pond'] });
  });

  it('remembers the sandbox settings, ignoring money it does not offer', () => {
    const on = {
      challenges: true,
      outbreaks: true,
      weather: true,
      visits: true,
      rival: true,
      mishaps: true,
      bankruptcy: true,
    };
    const usual = { money: CENTERS.sandbox.startMoney, unlockAll: false, ...on, difficulty: {} };
    expect(loadSandbox()).toEqual(usual);
    const chosen = {
      money: 200000,
      unlockAll: true,
      challenges: false,
      outbreaks: false,
      weather: false,
      visits: false,
      rival: false,
      mishaps: false,
      bankruptcy: false,
      difficulty: { patience: 'harder', loans: 'easier' } as const,
    };
    saveSandbox(chosen);
    expect(loadSandbox()).toEqual(chosen);
    store.set(
      'pressure-point-sandbox',
      JSON.stringify({
        money: 1e9,
        unlockAll: 'yes',
        challenges: 1,
        outbreaks: 'no',
        weather: 0,
        visits: 'x',
        rival: 2,
        mishaps: 'y',
        bankruptcy: 'z',
        difficulty: { patience: 'brutal', wear: 3 },
      }),
    );
    expect(loadSandbox()).toEqual(usual);
    // settings saved before there were challenges, outbreaks, weather, visits, a rival, mishaps or bankruptcy have them on
    store.set('pressure-point-sandbox', JSON.stringify({ money: 75000, unlockAll: true }));
    expect(loadSandbox()).toEqual({ money: 75000, unlockAll: true, ...on, difficulty: {} });
  });
});

describe('a game with everything unlocked', () => {
  it('has every room, item and treatment from the start', () => {
    const s = newGame();
    expect(unlockedUpTo(s)).toBe(0);
    s.unlockAll = true;
    expect(unlockedUpTo(s)).toBe(Infinity);
    const sim = new Sim(s);
    expect(sim.unlocked('stone')).toBe(true);
    expect(sim.unlocked('sound')).toBe(true);
  });

  it('is off for saves from before the setting, which also forget unknown achievements', () => {
    const old = JSON.parse(JSON.stringify(newGame('willow'))) as Record<string, unknown>;
    delete old.unlockAll;
    old.achieved = ['century', 'moonwalk'];
    upgradeSave(old as unknown as GameState);
    expect(old).toMatchObject({ unlockAll: false, achieved: ['century'] });
  });
});

describe('the Massage Chair', () => {
  it('keeps a guest sitting in it far more patient than a bench does', () => {
    const sim = new Sim(newGame());
    sim.s.money = 100_000;
    const chair = sim.placeItem('massage_chair', 12, 10, 0)!;
    const bench = sim.placeItem('bench', 15, 10, 0)!;
    const ctx = createContext(sim.s);
    /** A guest holding a seat. */
    const sitting = (claimItem: number) => ({ claimItem }) as Guest;
    expect(seatDrain(ctx, sitting(chair.id))).toBe(0.1);
    expect(seatDrain(ctx, sitting(bench.id))).toBe(0.6);
    expect(seatDrain(ctx, sitting(0))).toBe(0.6);
  });
});
