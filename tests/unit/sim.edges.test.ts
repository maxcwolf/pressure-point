// Edge cases the placement rules keep out of ordinary play, but that the code must still get right
// if anything around it changes. Each was found in the October 2026 audit.
import { describe, expect, it } from 'vitest';

import { DAY_SECONDS } from '../../src/core/data';
import { canMoveItem } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import { updateEmergency } from '../../src/core/sim/emergencies';
import { drainEvents } from '../../src/core/sim/events';
import { guestCap } from '../../src/core/sim/guests';
import { repathAll } from '../../src/core/sim/movement';
import { Sim } from '../../src/core/sim/sim';
import { updateStations } from '../../src/core/sim/stations';
import { inRush, updateTwists } from '../../src/core/sim/twists';
import { newGame } from '../../src/core/state/game';
import { openCenter, run, runUntil } from './helpers';

describe('someone on their way out', () => {
  it('who can no longer reach the street is let go, not put back to work', () => {
    const { sim, s, therapist } = openCenter(2);
    sim.fire(therapist.id);
    expect(therapist.state).toBe('leaving');
    const ctx = createContext(s);
    // their way out is gone: their destination is somewhere nobody can walk
    therapist.dest = [0, 0, 0, 0, 0];
    repathAll(ctx);
    expect(therapist.state).toBe('leaving');
    expect(s.staff).not.toContain(therapist);
  });
});

describe('checking where an item could move to', () => {
  it('refuses an item that is not in the game, and leaves the rest alone', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    const items = [...s.items];
    const stranger = { ...s.items[0]!, id: 99999 };
    expect(canMoveItem(ctx, stranger, 12, 12, 0).ok).toBe(false);
    expect(s.items).toEqual(items);
  });
});

describe('a station', () => {
  it('whose staff member is posted elsewhere is not served by them', () => {
    const { sim, s, consultant } = openCenter(3);
    runUntil(sim, () => consultant.state === 'atPost', 120);
    const table = s.items.find((i) => i.type === 'massage_table')!;
    const guest = s.guests[0]!;
    // the table thinks the consultant, who is at the consultation desk, works it, and has a guest being served
    table.staffId = consultant.id;
    table.serving = guest.id;
    table.progress = 0;
    guest.station = table.id;
    guest.state = 'served';
    updateStations(createContext(s), 0.5);
    expect(table.staffId).toBe(0);
    expect(table.progress).toBe(0);
  });
});

describe('an emergency', () => {
  it('only counts a guest as sent once they are on their way in', () => {
    const { sim, s } = openCenter(2);
    s.stars = 1;
    run(sim, 5);
    expect(sim.offerEmergency()).toBe(true);
    sim.acceptEmergency();
    const ctx = createContext(s);
    // nobody can get from the street to the lobby
    const { door, front } = ctx.world.building;
    for (const x of door) s.items.push({ ...s.items[0]!, id: 90000 + x, type: 'plant', x, y: front - 1, rot: 0 });
    ctx.world.rebuild();
    const pending = s.emergency!.pending;
    updateEmergency(ctx);
    expect(s.emergency!.pending).toBe(pending);
  });
});

describe('the number of guests let in', () => {
  it('grows with finished rooms, not blueprints', () => {
    const { sim, s } = openCenter(1);
    const cap = guestCap(s);
    sim.createRoom('staffroom', { x: 17, y: 5, w: 3, h: 3 }, { x: 18, y: 7, dx: 0, dy: 1 });
    expect(guestCap(s)).toBe(cap);
  });
});

describe('the surroundings', () => {
  it('count from the moment a game is loaded, before any time has passed', () => {
    const { sim, s } = openCenter(1);
    sim.placeItem('statue', 16, 15, 0, { free: true });
    run(sim, 2);
    const near = sim.drainFactor(16, 14);
    expect(near).toBeLessThan(1.12);
    // the same game, loaded afresh and still paused
    const loaded = new Sim(JSON.parse(JSON.stringify(s)) as typeof s);
    expect(loaded.drainFactor(16, 14)).toBe(near);
  });
});

describe('rush hours', () => {
  it('last long enough to notice: two days or so, not a second', () => {
    let longest = 0;
    let run = 0;
    const step = 0.01;
    for (let day = 0; day < 40; day += step) {
      run = inRush(day) ? run + step : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeGreaterThanOrEqual(1.5);
  });

  it('are not announced over and over, chiming every few seconds', () => {
    const s = newGame('exchange');
    s.open = true;
    const ctx = createContext(s);
    const dt = 0.05;
    // a minute of play
    for (let t = 0; t < 60; t += dt) {
      s.day += dt / DAY_SECONDS;
      updateTwists(ctx, dt);
    }
    const events = drainEvents(ctx);
    expect(events.filter((e) => e.type === 'announce')).toEqual([]);
    expect(events.filter((e) => e.type === 'toast' && /rush/i.test(e.text)).length).toBeLessThanOrEqual(1);
  });
});
