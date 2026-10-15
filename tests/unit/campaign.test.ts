// The campaign: which centers are open, the progress kept between games, and what sets each center apart.
import { beforeEach, describe, expect, it } from 'vitest';

import { newGameCenter } from '../../src/app/start';
import { centerOpen, nextCenter, withStars } from '../../src/core/campaign';
import { CAMPAIGN, type CenterId, CENTERS } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { rollCondition } from '../../src/core/sim/guests';
import { Sim } from '../../src/core/sim/sim';
import { arrivalFactor, impatience, inRush, seasonOf, updateTwists } from '../../src/core/sim/twists';
import { addWear } from '../../src/core/sim/upkeep';
import { disciplineHere, disciplineOn, newGame } from '../../src/core/state/game';
import { loadCampaign, recordGame } from '../../src/storage/campaign';
import { campaignCards } from '../../src/ui/lib/campaign';
import { runUntil } from './helpers';

describe('the campaign trail', () => {
  it('opens each center once the one before it has a star', () => {
    expect(CAMPAIGN).toEqual(['willow', 'exchange', 'saltmarsh', 'highpines', 'orchard']);
    expect(centerOpen({}, 'willow')).toBe(true);
    expect(centerOpen({}, 'exchange')).toBe(false);
    expect(centerOpen({ willow: 1 }, 'exchange')).toBe(true);
    expect(centerOpen({ willow: 3 }, 'sandbox')).toBe(false);
    expect(nextCenter('willow')).toBe('exchange');
    expect(nextCenter('exchange')).toBe('saltmarsh');
    expect(nextCenter('saltmarsh')).toBe('highpines');
    expect(nextCenter('highpines')).toBe('orchard');
    expect(nextCenter('orchard')).toBeUndefined();
    expect(nextCenter('sandbox')).toBeUndefined();
  });

  it('keeps the best stars earned, and never counts the sandbox', () => {
    const one = withStars({}, 'willow', 1);
    expect(one).toEqual({ willow: 1 });
    expect(withStars(one, 'willow', 0)).toBe(one);
    expect(withStars(one, 'willow', 2)).toEqual({ willow: 2 });
    expect(withStars(one, 'sandbox', 3)).toBe(one);
  });

  it('shows a card per center, saying how far along it is or what opens it', () => {
    const [willow, exchange] = campaignCards({});
    expect(willow).toMatchObject({ name: 'Willow Lane', open: true, earned: 0, of: 3, extras: [] });
    expect(exchange).toMatchObject({
      open: false,
      locked: 'Earn a star at Willow Lane to open',
      extras: ['Acupuncture'],
    });
    expect(campaignCards({ willow: 2 })[1]?.open).toBe(true);
  });

  it('reads the choice that starts a game', () => {
    expect(newGameCenter('new')).toBe('sandbox');
    expect(newGameCenter('new:exchange')).toBe('exchange');
    expect(newGameCenter('new:atlantis')).toBeNull();
    expect(newGameCenter('auto')).toBeNull();
  });
});

describe('campaign progress', () => {
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

  /** Note the stars a game in a center has reached. */
  const recordStars = (center: CenterId, stars: number) => recordGame({ ...newGame(center), stars });

  it('is kept between games, best stars only', () => {
    expect(loadCampaign().stars).toEqual({});
    recordStars('willow', 1);
    recordStars('willow', 0);
    recordStars('sandbox', 3);
    expect(loadCampaign().stars).toEqual({ willow: 1 });
    recordStars('willow', 2);
    expect(loadCampaign().stars).toEqual({ willow: 2 });
  });

  it('ignores junk', () => {
    store.set('pressure-point-campaign', 'not json');
    expect(loadCampaign()).toEqual({ stars: {}, achieved: [], unlocked: [] });
    store.set(
      'pressure-point-campaign',
      JSON.stringify({ stars: { willow: 2, atlantis: 3, exchange: 'lots', sandbox: -1 } }),
    );
    expect(loadCampaign().stars).toEqual({ willow: 2 });
  });
});

describe('what each center offers', () => {
  it('opens disciplines along the way', () => {
    /** A new game in a center. */
    const at = (id: CenterId) => newGame(id);
    expect(disciplineHere(at('willow'), 'acupuncture')).toBe(false);
    expect(disciplineOn(at('willow'), 'massage')).toBe(true);
    expect(disciplineOn(at('exchange'), 'acupuncture')).toBe(true);
    expect(disciplineOn(at('exchange'), 'reiki')).toBe(false);
    expect(disciplineOn(at('sandbox'), 'reiki')).toBe(true);
    // switching one off still works where it exists
    const s = at('exchange');
    s.options = { acupuncture: false };
    expect(disciplineOn(s, 'acupuncture')).toBe(false);
  });

  it('never offers a discipline a center does not have, whatever the stars', () => {
    const sim = new Sim(newGame('willow'));
    sim.s.stars = 3;
    expect(sim.offered('acupuncture')).toBe(false);
    expect(sim.unlocked('cupping')).toBe(false);
  });

  it('brings in more of its local conditions', () => {
    const office = new Set(Object.keys(CENTERS.exchange.conditions ?? {}));
    /** The share of guests arriving with an office ailment, two stars in. */
    const share = (id: CenterId) => {
      setSeed(9);
      const ctx = createContext(newGame(id));
      ctx.s.stars = 2;
      // guests only come for treatments the center has a room for
      ctx.s.rooms.push({
        id: 999,
        type: 'massage',
        x: 10,
        y: 10,
        w: 3,
        h: 3,
        door: { x: 11, y: 12, dx: 0, dy: 1 },
        windows: [],
        done: true,
        priority: false,
        vibes: 0,
        claimedBy: 0,
      });
      let hits = 0;
      for (let i = 0; i < 2000; i++) if (office.has(rollCondition(ctx))) hits++;
      return hits / 2000;
    };
    expect(share('sandbox')).toBeCloseTo(0.5, 1);
    expect(share('exchange')).toBeGreaterThan(0.65);
  });
});

describe('rush hours', () => {
  it('come in waves: two days in every six', () => {
    expect(inRush(1)).toBe(false);
    expect(inRush(3)).toBe(true);
    expect(inRush(4.9)).toBe(true);
    expect(inRush(5)).toBe(false);
    expect(inRush(9.5)).toBe(true);
    expect(inRush(11.5)).toBe(false);
  });

  it('bunch up arrivals and shorten tempers at The Exchange, and nowhere else', () => {
    const exchange = createContext(newGame('exchange'));
    const { rush } = CENTERS.exchange;
    exchange.s.day = 3.5;
    expect(arrivalFactor(exchange)).toBe(rush?.peak);
    exchange.s.day = 0.5;
    expect(arrivalFactor(exchange)).toBe(rush?.lull);
    expect(impatience(exchange)).toBe(rush?.impatience);
    const sandbox = createContext(newGame());
    sandbox.s.day = 0.1;
    expect(arrivalFactor(sandbox)).toBe(1);
    expect(impatience(sandbox)).toBe(1);
  });

  it('are explained the first time one starts, and not again', () => {
    const ctx = createContext(newGame('exchange'));
    ctx.s.open = true;
    ctx.s.day = 3.001;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toEqual([
      expect.objectContaining({ type: 'toast', text: expect.stringContaining('Rush hour') }),
    ]);
    ctx.s.day = 9.001;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toEqual([]);
  });
});

describe('The Exchange', () => {
  it('can be built and run inside its own walls', () => {
    setSeed(6);
    const sim = new Sim(newGame('exchange'));
    sim.s.money = 100_000;
    /** Build a finished room with its furniture. */
    const room = (type: 'consult' | 'massage', rect: object, door: object, items: [string, number, number][]) => {
      const r = sim.createRoom(type, rect as never, door as never);
      for (const [t, x, y] of items)
        expect(sim.placeItem(t as never, x, y, 0, { free: true, roomId: r.id }), t).not.toBeNull();
      sim.finishRoom(r);
    };
    expect(sim.placeItem('reception_desk', 14, 13, 0)).not.toBeNull();
    room('consult', { x: 5, y: 6, w: 4, h: 4 }, { x: 8, y: 8, dx: 1, dy: 0 }, [
      ['consult_desk', 6, 7],
      ['cabinet', 5, 9],
    ]);
    room('massage', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 }, [
      ['massage_table', 21, 6],
      ['oil_trolley', 23, 6],
    ]);
    for (const role of ['receptionist', 'consultant', 'therapist'] as const) {
      const best = sim.s.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
      expect(best && sim.hire(best.id), role).toBeTruthy();
    }
    runUntil(sim, () => sim.s.stats.healed >= 3, 1200);
    expect(sim.objectives()[0]?.label).toMatch(/^Heal 15 guests/);
  });
});

describe('Driftwood Bay', () => {
  it('has seasons, starting the year in winter', () => {
    expect(seasonOf(0)).toBe('winter');
    expect(seasonOf(2 * 30)).toBe('spring');
    expect(seasonOf(5 * 30 + 10)).toBe('summer');
    expect(seasonOf(8 * 30)).toBe('autumn');
    expect(seasonOf(11 * 30)).toBe('winter');
    expect(seasonOf(12 * 30 + 5 * 30)).toBe('summer');
  });

  it('is busy in summer and quiet in winter, and nothing else has seasons', () => {
    const ctx = createContext(newGame('saltmarsh'));
    const seasons = CENTERS.saltmarsh.seasons;
    ctx.s.day = 6 * 30;
    expect(arrivalFactor(ctx)).toBe(seasons?.summer);
    ctx.s.day = 10;
    expect(arrivalFactor(ctx)).toBe(seasons?.winter);
    ctx.s.day = 3 * 30;
    expect(arrivalFactor(ctx)).toBe(1);
    expect(new Sim(newGame('saltmarsh')).season()).toBe('winter');
  });

  it('announces each season as it starts', () => {
    const ctx = createContext(newGame('saltmarsh'));
    ctx.s.open = true;
    ctx.s.day = 5 * 30 + 0.01;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toEqual([{ type: 'announce', text: expect.stringContaining('Summer') }]);
    ctx.s.day += 1;
    updateTwists(ctx, 0.1);
    expect(drainEvents(ctx)).toEqual([]);
  });

  it('has its own seaside ailments, found nowhere else', () => {
    const local = ['lobstered', 'sealegs', 'gull'];
    /** The local ailments that turn up among many guests in a center, two stars in, with every room built. */
    const seen = (id: CenterId) => {
      setSeed(3);
      const ctx = createContext(newGame(id));
      ctx.s.stars = 2;
      for (const type of ['massage', 'acupuncture', 'reiki'] as const)
        ctx.s.rooms.push({
          id: ctx.s.nextId++,
          type,
          x: 0,
          y: 0,
          w: 3,
          h: 3,
          door: { x: 1, y: 2, dx: 0, dy: 1 },
          windows: [],
          done: true,
          priority: false,
          vibes: 0,
          claimedBy: 0,
        });
      const found = new Set<string>();
      for (let i = 0; i < 3000; i++) found.add(rollCondition(ctx));
      return local.filter((c) => found.has(c));
    };
    expect(seen('saltmarsh')).toEqual(local);
    expect(seen('sandbox')).toEqual([]);
    expect(seen('exchange')).toEqual([]);
  });

  it('can be built and run inside its own walls', () => {
    setSeed(8);
    const sim = new Sim(newGame('saltmarsh'));
    sim.s.money = 100_000;
    /** Build a finished room with its furniture. */
    const room = (type: 'consult' | 'massage', rect: object, door: object, items: [string, number, number][]) => {
      const r = sim.createRoom(type, rect as never, door as never);
      for (const [t, x, y] of items)
        expect(sim.placeItem(t as never, x, y, 0, { free: true, roomId: r.id }), t).not.toBeNull();
      sim.finishRoom(r);
    };
    expect(sim.placeItem('reception_desk', 14, 13, 0)).not.toBeNull();
    room('consult', { x: 4, y: 7, w: 4, h: 4 }, { x: 7, y: 9, dx: 1, dy: 0 }, [
      ['consult_desk', 5, 8],
      ['cabinet', 4, 10],
    ]);
    room('massage', { x: 21, y: 7, w: 4, h: 4 }, { x: 22, y: 10, dx: 0, dy: 1 }, [
      ['massage_table', 22, 7],
      ['oil_trolley', 24, 7],
    ]);
    for (const role of ['receptionist', 'consultant', 'therapist'] as const) {
      const best = sim.s.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
      expect(best && sim.hire(best.id), role).toBeTruthy();
    }
    runUntil(sim, () => sim.s.stats.healed >= 3, 1500);
    expect(sim.objectives()[0]?.label).toMatch(/^Heal 25 guests/);
  });

  it('offers reiki, and wears equipment out faster', () => {
    expect(disciplineOn(newGame('saltmarsh'), 'reiki')).toBe(true);
    /** The wear one use adds to a massage table in a center. */
    const wearIn = (id: CenterId) => {
      const ctx = createContext(newGame(id));
      const table = { type: 'massage_table', wear: 0 } as never as Parameters<typeof addWear>[1];
      addWear(ctx, table);
      return table.wear;
    };
    expect(wearIn('saltmarsh')).toBeCloseTo(wearIn('sandbox') * (CENTERS.saltmarsh.wear ?? 1));
  });
});
