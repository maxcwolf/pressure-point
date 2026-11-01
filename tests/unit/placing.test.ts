// The clock stops while a room or an item is being placed and starts again once it is down.
import { describe, expect, it } from 'vitest';

import { placing } from '../../src/app/tools/plan';
import type { Tool } from '../../src/app/tools/types';
import type { PlacingNow } from '../../src/core/sim/placing';
import type { Room } from '../../src/core/state/types';
import { freshSim } from './helpers';

/** What the player is doing this frame: placing or not, with the switch on unless said otherwise. */
const now = (placing: boolean, more: Partial<PlacingNow> = {}): PlacingNow => ({
  placing,
  choosing: false,
  auto: true,
  ...more,
});

describe('the clock while something is placed', () => {
  it('stops as placing starts and goes back to the speed it had once it ends', () => {
    const sim = freshSim();
    sim.s.speed = 2;
    sim.watchPlacing(now(false));
    expect(sim.s.speed).toBe(2);
    sim.watchPlacing(now(true));
    expect(sim.s.speed).toBe(0);
    expect(sim.pausedToPlace()).toBe(true);
    // it stays stopped while placing goes on, from one step to the next
    sim.watchPlacing(now(true));
    expect(sim.s.speed).toBe(0);
    sim.watchPlacing(now(false));
    expect(sim.s.speed).toBe(2);
    expect(sim.pausedToPlace()).toBe(false);
  });

  it('leaves a clock that was stopped already stopped', () => {
    const sim = freshSim();
    sim.s.speed = 0;
    sim.watchPlacing(now(true));
    expect(sim.pausedToPlace()).toBe(false);
    sim.watchPlacing(now(false));
    expect(sim.s.speed).toBe(0);
  });

  it('leaves the clock to a player who sets it going by hand meanwhile, even stopped again by hand', () => {
    const sim = freshSim();
    sim.s.speed = 2;
    sim.watchPlacing(now(true));
    sim.s.speed = 1;
    sim.watchPlacing(now(true));
    // not stopped again for the same placing
    expect(sim.s.speed).toBe(1);
    sim.watchPlacing(now(false));
    expect(sim.s.speed).toBe(1);

    sim.s.speed = 3;
    sim.watchPlacing(now(true));
    sim.s.speed = 1;
    sim.watchPlacing(now(true));
    sim.s.speed = 0;
    sim.watchPlacing(now(true));
    sim.watchPlacing(now(false));
    expect(sim.s.speed, 'stopped by hand stays stopped').toBe(0);
  });

  it('does nothing with the switch off', () => {
    const sim = freshSim();
    sim.s.speed = 2;
    sim.watchPlacing(now(true, { auto: false }));
    expect(sim.s.speed).toBe(2);
    sim.watchPlacing(now(false, { auto: false }));
    expect(sim.s.speed).toBe(2);
  });

  it('stays stopped while the next thing is chosen from a build menu, which alone does not stop it', () => {
    const sim = freshSim();
    sim.s.speed = 2;
    sim.watchPlacing(now(false, { choosing: true }));
    expect(sim.s.speed, 'a build menu opened with nothing in hand').toBe(2);
    sim.watchPlacing(now(true));
    // a Bench in hand is put down to open the Items menu again, and a Plant picked from it
    sim.watchPlacing(now(false, { choosing: true }));
    expect(sim.s.speed).toBe(0);
    sim.watchPlacing(now(true));
    expect(sim.s.speed).toBe(0);
    sim.watchPlacing(now(false, { choosing: true }));
    // the menu closed with nothing picked
    sim.watchPlacing(now(false));
    expect(sim.s.speed).toBe(2);
  });

  it('stops for every way of placing a room or an item, and for nothing else', () => {
    const room = { id: 1 } as Room;
    const layout = { type: 'consult' } as never;
    const stops: Tool[] = [
      { kind: 'item', type: 'bench', rot: 0 },
      { kind: 'move', id: 1, type: 'bench', rot: 0 },
      { kind: 'room', type: 'consult', phase: 'drag', start: null, rect: null, noFit: '' },
      { kind: 'room', type: 'consult', phase: 'door', rect: { x: 0, y: 0, w: 3, h: 3 } },
      { kind: 'room', type: 'consult', phase: 'plan', room, sub: null },
      { kind: 'sketch', type: 'consult', phase: 'drag', start: null, rect: null, held: false, moving: null },
      { kind: 'template', name: 'Cozy', layout },
      { kind: 'moveRoom', roomId: 1, layout, copy: false },
    ];
    const others: Tool[] = [
      { kind: 'none' },
      { kind: 'window', roomId: 1 },
      { kind: 'door', roomId: 1 },
      { kind: 'resize', roomId: 1, edge: null, rect: null },
      { kind: 'assign', staffId: 1 },
      { kind: 'expand', pointed: null },
    ];
    for (const t of stops) expect(placing(t), t.kind).toBe(true);
    for (const t of others) expect(placing(t), t.kind).toBe(false);
  });
});
