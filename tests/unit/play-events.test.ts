// The play statistics: the moments in a game they count, and the player's choice to share them or not.
import { beforeEach, describe, expect, it } from 'vitest';

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
