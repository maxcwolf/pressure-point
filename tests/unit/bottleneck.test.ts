// Where guests are held up: each station's busy and staffed shares over the last few days, and the stage that holds
// guests up most.
import { describe, expect, it } from 'vitest';

import { DAY_SECONDS } from '../../src/core/data';
import { bottleneck, BUSY_DAYS, stages, trackBusy } from '../../src/core/sim/bottleneck';
import type { SimContext } from '../../src/core/sim/context';
import type { Item } from '../../src/core/state/types';
import { busyNote } from '../../src/ui/lib/busy';
import { openCenter, run, runUntil } from './helpers';

/** The game's own context, for calling the simulation directly. */
const ctxOf = (c: { sim: unknown }) => (c.sim as { ctx: SimContext }).ctx;

describe('a station', () => {
  it('drifts its shares toward how it has been over the last few days', () => {
    const it = {} as Item;
    // starting from how it is now
    trackBusy(it, false, true, 0.1);
    expect(it).toMatchObject({ busy: 0, staffed: 1 });
    trackBusy(it, true, true, 0.1);
    expect(it.busy).toBeCloseTo(0.1 / (BUSY_DAYS * DAY_SECONDS));
    // busy and staffed for a long while, then idle and empty for its span: about a third left
    for (let t = 0; t < 30 * DAY_SECONDS; t += 0.1) trackBusy(it, true, true, 0.1);
    expect(it.busy).toBeGreaterThan(0.99);
    for (let t = 0; t < BUSY_DAYS * DAY_SECONDS; t += 0.1) trackBusy(it, false, false, 0.1);
    expect(it.busy).toBeCloseTo(Math.exp(-1), 1);
    expect(it.staffed).toBeCloseTo(Math.exp(-1), 1);
  });

  it('counts as staffed while someone is at it, and busy while it has a guest', () => {
    const c = openCenter(1);
    const table = c.s.items.find((i) => i.type === 'massage_table')!;
    runUntil(c.sim, () => c.therapist.state === 'atPost', 120);
    run(c.sim, 10 * DAY_SECONDS);
    expect(table.staffed).toBeGreaterThan(0.5);
    expect(table.busy).toBeGreaterThan(0);
    expect(table.busy).toBeLessThanOrEqual(table.staffed! + 0.05);
  });
});

describe('the inspector', () => {
  it('says how a station has been doing, once it has been tracked', () => {
    expect(busyNote({})).toBeNull();
    expect(busyNote({ busy: 0.62, staffed: 0.9 })).toBe('Over the last few days: busy 62% of the time, staffed 90%');
    expect(busyNote({ busy: 0.62, staffed: 0.9 }, true)).toBe(
      'Over the last few days: busy 62% of the time, working 90%',
    );
  });
});

describe('the stage holding guests up', () => {
  it('groups stations by what guests wait for, and counts those in line', () => {
    const c = openCenter(1);
    runUntil(c.sim, () => c.s.guests.length > 0, 300);
    const ctx = ctxOf(c);
    const keys = stages(ctx).map((st) => st.key);
    expect(keys).toEqual(expect.arrayContaining(['reception', 'consult', 'massage']));
    const table = c.s.items.find((i) => i.type === 'massage_table')!;
    const g = c.s.guests[0]!;
    table.queue = [];
    for (let i = 0; i < 3; i++) {
      c.s.guests.push({ ...g, id: 9200 + i, station: table.id, state: 'waiting', goal: 'treat' });
      table.queue.push(9200 + i);
    }
    expect(stages(ctx).find((st) => st.key === 'massage')?.waiting).toBe(3);
    // three is not yet holding anyone up; four is
    expect(bottleneck(ctx)?.key).not.toBe('massage');
    c.s.guests.push({ ...g, id: 9203, station: table.id, state: 'waiting', goal: 'treat' });
    table.queue.push(9203);
    expect(bottleneck(ctx)).toMatchObject({ key: 'massage', waiting: 4 });
  });
});
