// The play statistics: the moments in a game they count, the player's choice to share them or not, and the tests and
// bots that never send them.
import { beforeEach, describe, expect, it } from 'vitest';

import { automated } from '../../src/app/automation';
import { gameProps, markOf, playEvents } from '../../src/app/play-events';
import { DAYS_PER_MONTH } from '../../src/core/data';
import { forgetSharing, loadSharing, saveSharing } from '../../src/storage/analytics';
import { addConsult, addMassage, freshSim } from './helpers';

/** The names of the events, in order. */
const names = (events: { name: string }[]) => events.map((e) => e.name);

describe('play events', () => {
  it('count nothing while nothing happens', () => {
    const sim = freshSim();
    expect(playEvents(markOf(sim.s), sim.s)).toEqual([]);
  });

  it('count each room as it is finished, once', () => {
    const sim = freshSim();
    let mark = markOf(sim.s);
    addConsult(sim);
    const events = playEvents(mark, sim.s).filter((e) => e.name === 'room_built');
    expect(events).toHaveLength(1);
    expect(events[0]?.props).toMatchObject({ room: 'consult', rooms: 1, center: sim.s.center });
    mark = markOf(sim.s);
    addMassage(sim);
    expect(
      playEvents(mark, sim.s)
        .filter((e) => e.name === 'room_built')
        .map((e) => e.props.room),
    ).toEqual(['massage']);
  });

  it('count the doors opening, stars and achievements', () => {
    const sim = freshSim();
    const mark = markOf(sim.s);
    sim.s.open = true;
    sim.s.stars = 2;
    sim.s.achieved.push('called-in');
    const events = playEvents(mark, sim.s);
    expect(names(events)).toEqual(['doors_opened', 'star_earned', 'star_earned', 'achievement_earned']);
    expect(events.filter((e) => e.name === 'star_earned').map((e) => e.props.star)).toEqual([1, 2]);
  });

  it('count a month as it ends, with how it went', () => {
    const sim = freshSim();
    const mark = markOf(sim.s);
    // a day over, as playing a month on stops a hair short of its end
    sim.fastForward(DAYS_PER_MONTH + 1);
    const month = playEvents(mark, sim.s).find((e) => e.name === 'month_ended');
    expect(month?.props).toMatchObject({ month: 1, money: sim.s.months.at(-1)?.money, loan: 0 });
    // the next look, a moment later, counts it no more
    expect(names(playEvents(markOf(sim.s), sim.s))).not.toContain('month_ended');
  });

  it("count a new player's firsts, and each kind of item the first time it goes down", () => {
    const sim = freshSim();
    let mark = markOf(sim.s);
    addConsult(sim);
    let events = playEvents(mark, sim.s);
    expect(events.filter((e) => e.name === 'milestone_reached').map((e) => e.props.milestone)).toEqual(['first_item']);
    const types = new Set(sim.s.items.map((i) => i.type));
    expect(events.filter((e) => e.name === 'item_first_placed').map((e) => e.props.item)).toEqual([...types]);
    // another room counts only the kinds of item not seen before, and no milestone again
    mark = markOf(sim.s);
    addMassage(sim);
    events = playEvents(mark, sim.s);
    expect(names(events)).not.toContain('milestone_reached');
    const fresh = [...new Set(sim.s.items.map((i) => i.type))].filter((t) => !types.has(t));
    expect(events.filter((e) => e.name === 'item_first_placed').map((e) => e.props.item)).toEqual(fresh);
  });

  it('count staff hired, and tell a quit from a firing', () => {
    const sim = freshSim();
    addConsult(sim);
    let mark = markOf(sim.s);
    const [a, b] = sim.s.candidates;
    const first = sim.hire(a!.id)!;
    const second = sim.hire(b!.id)!;
    let events = playEvents(mark, sim.s);
    expect(events.filter((e) => e.name === 'staff_hired').map((e) => e.props.role)).toEqual([first.role, second.role]);
    expect(events.find((e) => e.name === 'milestone_reached')?.props.milestone).toBe('first_hire');

    mark = markOf(sim.s);
    sim.fire(first.id);
    events = playEvents(mark, sim.s).filter((e) => e.name === 'staff_left');
    expect(events.map((e) => e.props)).toMatchObject([{ role: first.role, reason: 'fired' }]);

    // quitting is the game's doing: it marks them leaving and notes the day
    mark = markOf(sim.s);
    second.state = 'leaving';
    sim.s.stats.lastQuit = sim.s.day + 0.5;
    events = playEvents(mark, sim.s).filter((e) => e.name === 'staff_left');
    expect(events.map((e) => e.props)).toMatchObject([{ role: second.role, reason: 'quit' }]);
  });

  it('count going into the red, loans, prices and marketing', () => {
    const sim = freshSim();
    let mark = markOf(sim.s);
    expect(sim.borrow()).toBe(true);
    sim.setPrice(sim.s.priceLevel + 0.1);
    expect(sim.startCampaign('word', 2)).toBe(true);
    const events = playEvents(mark, sim.s);
    expect(events.find((e) => e.name === 'loan_changed')?.props).toMatchObject({ change: 'borrowed' });
    expect(events.find((e) => e.name === 'price_changed')?.props).toMatchObject({ technique: 'all' });
    expect(events.find((e) => e.name === 'marketing_started')?.props).toMatchObject({ kind: 'word', months: 2 });

    mark = markOf(sim.s);
    sim.s.money = -100;
    expect(names(playEvents(mark, sim.s))).toEqual(['in_the_red']);
    // still in the red a moment later is not news
    expect(playEvents(markOf(sim.s), sim.s)).toEqual([]);
  });

  it('never say what the player named the game', () => {
    const sim = freshSim();
    expect(Object.keys(gameProps(sim.s)).sort()).toEqual(['center', 'cheated', 'day', 'stars']);
  });
});

describe('sharing play statistics', () => {
  // a stand-in for the browser's storage
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
      /** Forget a value. */
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    forgetSharing();
  });

  it('is on until switched off', () => {
    expect(loadSharing()).toBe(true);
  });

  it('stays off once switched off, and on again once switched back', () => {
    saveSharing(false);
    forgetSharing();
    expect(loadSharing()).toBe(false);
    saveSharing(true);
    forgetSharing();
    expect(loadSharing()).toBe(true);
  });

  it('still applies until the page closes when storage cannot keep it', () => {
    /** Storage that is not there. */
    const missing = () => {
      throw new Error('no storage');
    };
    globalThis.localStorage = { getItem: missing, setItem: missing, removeItem: missing } as unknown as Storage;
    saveSharing(false);
    expect(loadSharing()).toBe(false);
  });
});

describe('tests and bots', () => {
  const PLAYER =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

  it('are told apart from players', () => {
    expect(automated({ userAgent: PLAYER })).toBe(false);
    expect(automated({ webdriver: false, userAgent: PLAYER })).toBe(false);
  });

  it('include any browser under automation, as Playwright drives the browser and the desktop app', () => {
    expect(automated({ webdriver: true, userAgent: PLAYER })).toBe(true);
  });

  it('include crawlers and headless browsers that name themselves', () => {
    for (const userAgent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
    ])
      expect(automated({ userAgent })).toBe(true);
  });
});
