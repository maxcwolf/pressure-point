// The Pressure Point Foundation: three gifts a campaign center can make once every star there is earned, each worth
// karma for the campaign, once.
import { beforeEach, describe, expect, it } from 'vitest';

import { markOf, playEvents } from '../../src/app/play-events';
import { freshCampaign, karmaEarned, withGifts } from '../../src/core/campaign';
import { type CenterId, FOUNDATION_GIFTS, FOUNDATION_KARMA } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { yearTotals } from '../../src/core/sim/awards';
import { netOf, payrollOutlook } from '../../src/core/sim/economy';
import { earnsForCampaign } from '../../src/core/sim/events';
import { Sim } from '../../src/core/sim/sim';
import { emptyLedger, emptyTally, newGame } from '../../src/core/state/game';
import { loadCampaign, recordGame } from '../../src/storage/campaign';
import { giftList, giftNote } from '../../src/ui/lib/foundation';
import { toasts } from './helpers';

/** A game in a center with so many stars and so much in the bank. */
function center(id: CenterId, stars: number, money: number): Sim {
  setSeed(1);
  const s = newGame(id);
  s.stars = stars;
  s.money = money;
  return new Sim(s);
}

describe('the Foundation', () => {
  it('opens once every star in a campaign center is earned, and never in the sandbox', () => {
    expect(center('willow', 2, 1e6).foundationOpen()).toBe(false);
    expect(center('willow', 2, 1e6).giftBlocker()).toBe('The Foundation takes gifts once every star here is earned.');
    expect(center('willow', 3, 1e6).foundationOpen()).toBe(true);
    expect(center('orchard', 3, 1e6).foundationOpen()).toBe(true);
    expect(center('sandbox', 3, 1e6).foundationOpen()).toBe(false);
  });

  it('takes three gifts, each dearer, and more where guests pay more', () => {
    expect(FOUNDATION_GIFTS).toEqual([50000, 100000, 200000]);
    const willow = center('willow', 3, 1e6);
    expect(willow.nextGift()).toBe(50000);
    expect(center('orchard', 3, 1e6).nextGift()).toBe(75000);
    for (const price of [50000, 100000, 200000]) {
      expect(willow.nextGift()).toBe(price);
      expect(willow.endow()).toBe(true);
    }
    expect(willow.s.gifts).toBe(3);
    expect(willow.nextGift()).toBeNull();
    expect(willow.giftBlocker()).toBe('Every gift has been made.');
    expect(willow.endow()).toBe(false);
  });

  it('pays a gift out of the bank, on a line of its own, and says what it earns', () => {
    const sim = center('willow', 3, 80000);
    sim.drain();
    expect(sim.endow()).toBe(true);
    expect(sim.s.money).toBe(30000);
    expect(sim.s.ledger.gifts).toBe(50000);
    expect(netOf(sim.s.ledger)).toBe(-50000);
    const events = sim.drain();
    expect(events).toContainEqual({ type: 'gift', n: 1 });
    expect(events).toContainEqual({ type: 'sfx', name: 'cash' });
    expect(toasts(events)).toEqual(['$50,000 given to the Pressure Point Foundation: +1 karma.']);
    expect(events.filter(earnsForCampaign)).toEqual([{ type: 'gift', n: 1 }]);
  });

  it('refuses a gift the bank cannot cover, or from a game the cheat console was used in', () => {
    const short = center('willow', 3, 49999);
    expect(short.giftBlocker()).toBe('Not enough money.');
    expect(short.endow()).toBe(false);
    expect(short.s.money).toBe(49999);
    expect(short.s.gifts).toBe(0);
    expect(short.drain()).toEqual([{ type: 'sfx', name: 'error' }]);
    const cheated = center('willow', 3, 1e6);
    cheated.s.cheated = true;
    expect(cheated.giftBlocker()).toBe('Cheats were used in this game, so the campaign keeps nothing from it.');
    expect(cheated.endow()).toBe(false);
  });

  it('costs no year-end award: the books are judged on trading', () => {
    const month = { ...emptyTally(), reputation: 50, money: 0 };
    const t = yearTotals([{ ...month, ledger: { ...emptyLedger(), treatment: 30000, gifts: 50000 } }]);
    expect(t.net).toBe(30000);
  });

  it('is counted in the play statistics, a gift at a time', () => {
    const sim = center('willow', 3, 1e6);
    const mark = markOf(sim.s);
    sim.endow();
    sim.endow();
    const gifts = playEvents(mark, sim.s).filter((e) => e.name === 'foundation_gift');
    expect(gifts.map((e) => e.props.gift)).toEqual([1, 2]);
    expect(gifts[1]?.props).toMatchObject({ center: 'willow', money: 1e6 - 150000 });
  });
});

describe("the Foundation's karma", () => {
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

  it('is earned once a gift in each center, on top of the stars', () => {
    expect(FOUNDATION_KARMA).toBe(1);
    const p = { ...freshCampaign(), stars: { willow: 3, exchange: 3 }, gifts: { willow: 3, exchange: 1 } };
    expect(karmaEarned(p)).toBe(12 + 4);
  });

  it('keeps the most gifts made in each center, and none from the sandbox', () => {
    const one = withGifts({}, 'willow', 1);
    expect(one).toEqual({ willow: 1 });
    expect(withGifts(one, 'willow', 0)).toBe(one);
    expect(withGifts(one, 'willow', 2)).toEqual({ willow: 2 });
    expect(withGifts(one, 'willow', 9)).toEqual({ willow: 3 });
    expect(withGifts(one, 'sandbox', 3)).toBe(one);
  });

  it('is recorded from a game, but not from one the cheat console was used in', () => {
    recordGame({ ...newGame('willow'), stars: 3, gifts: 2 });
    expect(loadCampaign()).toMatchObject({ stars: { willow: 3 }, gifts: { willow: 2 } });
    recordGame({ ...newGame('willow'), stars: 3, gifts: 1 });
    expect(loadCampaign().gifts).toEqual({ willow: 2 });
    recordGame({ ...newGame('exchange'), stars: 3, gifts: 3, cheated: true });
    expect(loadCampaign().gifts).toEqual({ willow: 2 });
  });

  it('ignores gifts that are junk, from no campaign center, or more than there are', () => {
    store.set(
      'pressure-point-campaign',
      JSON.stringify({ gifts: { willow: 2, exchange: 7, sandbox: 1, atlantis: 1, boardwalk: 'lots', orchard: 0 } }),
    );
    expect(loadCampaign().gifts).toEqual({ willow: 2, exchange: 3 });
  });
});

describe("the Foundation's words", () => {
  it('lists the gifts to come', () => {
    expect(giftList([50000, 100000, 200000])).toBe('$50,000, then $100,000, then $200,000');
    expect(giftList([300000])).toBe('$300,000');
  });

  it('says what a gift leaves for the next payday', () => {
    const o = { ...payrollOutlook(newGame('willow')), money: 80000, wages: 20000, upkeep: 1000, coming: 0 };
    expect(giftNote(o, 50000)).toBe('The bank would keep $30,000, enough for the next payday as things stand.');
    expect(giftNote({ ...o, daysLeft: 11.5 }, 70000)).toBe(
      'The bank would keep $10,000: $11,000 short of the next payday in 12 days, as things stand.',
    );
    expect(giftNote({ ...o, daysLeft: 11.5, coming: 15000 }, 70000)).toBe(
      'The bank would keep $10,000, enough for the next payday as things stand.',
    );
  });
});
