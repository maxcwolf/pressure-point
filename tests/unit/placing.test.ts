// The clock stops while a room or an item is being placed and starts again once it is down, and a piece of furniture
// put in a room not yet built can be picked up and put down elsewhere in it.
import { describe, expect, it } from 'vitest';

import { placing } from '../../src/app/tools/plan';
import { Tools } from '../../src/app/tools/tools';
import type { Tool } from '../../src/app/tools/types';
import type { PlacingNow } from '../../src/core/sim/placing';
import type { Room } from '../../src/core/state/types';
import type { OverlayTile } from '../../src/render/overlay-codes';
import type { GhostSpec } from '../../src/render/overlays';
import type { View } from '../../src/render/view';
import { freshSim, LAYOUT } from './helpers';

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

describe('moving a piece of furniture before the room is built', () => {
  /** Ignore a call to the scene. */
  const nothing = () => undefined;

  /**
   * A Consultation Room blueprint 4×5, open in the build tools with nothing in hand, with its Desk in and, unless
   * `missing`, its Chart Cabinet; and a stand-in for the scene that keeps what it is shown and picks the item under the
   * pointer.
   */
  function blueprint(missing = false) {
    const sim = freshSim();
    const room = sim.createRoom('consult', { ...LAYOUT.consult.rect, h: 5 }, LAYOUT.consult.door);
    const desk = sim.placeItem('consult_desk', 6, 6, 0, { free: true, roomId: room.id })!;
    const cabinet = missing ? null : sim.placeItem('cabinet', 5, 8, 0, { free: true, roomId: room.id });
    const seen = { ghost: null as GhostSpec | null, tiles: [] as OverlayTile[] };
    const view = {
      selected: null,
      /** Keep the tiles colored, to look at after. */
      setOverlay: (tiles: OverlayTile[]) => {
        seen.tiles = tiles;
      },
      setMarkers: nothing,
      /** Keep the ghost shown, to look at after. */
      setGhost: (g: GhostSpec | null) => {
        seen.ghost = g;
      },
      setDoor: nothing,
      nudge: nothing,
      /** The cursor is on the ground wherever the pointer says. */
      groundAt: (x: number, y: number) => ({ x, y }),
      /** The item on the tile under the pointer, if any. */
      pickAll: (x: number, y: number) => {
        const it = sim.world.itemAt(Math.floor(x), Math.floor(y));
        return it ? [{ kind: 'item', id: it.id }] : [];
      },
    };
    const tools = new Tools(sim, view as unknown as View, nothing, nothing);
    tools.tool = { kind: 'room', type: 'consult', phase: 'plan', room, sub: null };
    tools.refresh();
    return { sim, room, desk, cabinet: cabinet!, tools, seen };
  }

  /** The first spot in the room, other than where the piece in hand stands, where it can go. */
  function spotInRoom(tools: Tools, room: Room, from: { x: number; y: number }): [number, number] {
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x === from.x && y === from.y) continue;
        tools.pointerMove(x + 0.5, y + 0.5);
        if (tools.problem === '') return [x + 0.5, y + 0.5];
      }
    throw new Error('nowhere in the room for it');
  }

  it('picks a piece up with a click and puts it down elsewhere in the room, for nothing', () => {
    const { sim, room, cabinet, tools, seen } = blueprint();
    expect(tools.hint).toContain('click a piece in the room to move it');
    const money = sim.s.money;
    expect(tools.pieceAt(5.5, 8.5)?.id).toBe(cabinet.id);
    tools.pointerUp(5.5, 8.5);
    expect(tools.tool).toMatchObject({ phase: 'plan', sub: { kind: 'move', id: cabinet.id, type: 'cabinet' } });
    expect(tools.hint).toContain('Moving the Chart Cabinet');
    const [x, y] = spotInRoom(tools, room, cabinet);
    // shown as a built item being moved is: its ghost, and the squares it would cover
    expect(seen.ghost).toMatchObject({ type: 'cabinet', ok: true });
    expect(seen.tiles.length).toBeGreaterThan(0);
    tools.pointerUp(x, y);
    expect([cabinet.x, cabinet.y]).toEqual([Math.floor(x), Math.floor(y)]);
    expect(sim.s.money).toBe(money);
    expect(room.done).toBe(false);
    expect(sim.missingItems(room)).toEqual([]);
    // with everything in, nothing is handed over after
    expect(tools.tool).toMatchObject({ phase: 'plan', sub: null });
    expect(tools.planBuild()).toBe(true);
  });

  it('leaves a piece where it was when the move is called off', () => {
    const { sim, room, cabinet, tools } = blueprint();
    tools.pointerUp(5.5, 8.5);
    spotInRoom(tools, room, cabinet);
    tools.back();
    expect(tools.tool).toMatchObject({ phase: 'plan', sub: null });
    expect([cabinet.x, cabinet.y, cabinet.rot]).toEqual([5, 8, 0]);
    expect(sim.s.items).toContain(cabinet);
  });

  it('keeps a piece in its room', () => {
    const { cabinet, tools } = blueprint();
    tools.pointerUp(5.5, 8.5);
    tools.pointerMove(14.5, 14.5);
    expect(tools.problem).not.toBe('');
    tools.pointerUp(14.5, 14.5);
    expect([cabinet.x, cabinet.y]).toEqual([5, 8]);
    expect(tools.tool).toMatchObject({ sub: { kind: 'move', id: cabinet.id } });
  });

  it('goes on to the furniture still needed once a piece is down', () => {
    const { room, desk, tools } = blueprint(true);
    expect(tools.hint).toContain('Pick the missing furniture from the blueprint panel · click a piece');
    tools.pointerUp(6.5, 6.5);
    expect(tools.tool).toMatchObject({ sub: { kind: 'move', id: desk.id } });
    tools.pointerUp(...spotInRoom(tools, room, desk));
    expect(tools.tool).toMatchObject({ sub: { kind: 'item', type: 'cabinet', required: true } });
  });

  it('picks nothing up with something in hand, nor anything outside the room', () => {
    const { sim, tools } = blueprint();
    const plant = sim.placeItem('plant', 14, 13, 0)!;
    expect(tools.pieceAt(14.5, 13.5), 'outside the room').toBeUndefined();
    tools.pointerUp(14.5, 13.5);
    expect(tools.tool).toMatchObject({ sub: null });
    expect([plant.x, plant.y]).toEqual([14, 13]);
    tools.planHold('window');
    expect(tools.pieceAt(5.5, 8.5), 'with windows in hand').toBeUndefined();
  });
});
