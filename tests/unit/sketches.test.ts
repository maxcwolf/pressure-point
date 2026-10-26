// Rooms pencilled in for later: where a sketch can go, what it keeps from being built over it, building it, a blueprint
// pencilled in instead, saves from before there were any, whether it still fits as the world changes, doors onto it,
// and a sketch on a plot that is bought and built on.
import { describe, expect, it } from 'vitest';

import { ITEMS, ROOM_TILE_COST, ROOMS, WINDOW_COST } from '../../src/core/data';
import { placeLayout } from '../../src/core/room-layout';
import type { Sim } from '../../src/core/sim/sim';
import { noLongerFits, SKETCH_TIP, sketchCost, sketchesCost, unfitCount } from '../../src/core/sim/sketches';
import type { GameState, Sketch } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { freshSim, LAYOUT, openCenter, run } from './helpers';

// The sandbox: its building runs from x 3 to 27 and y 3 to 17. Its east wing, for sale, runs from x 28 to 35 and y 3 to
// 17; the open standard little center leaves the floor from x 16 to 26 and y 9 to 12 or so free.

/** A Consultation Room's floor in the open corridor, and its door onto the corridor to the south. */
const FLOOR = { x: 20, y: 6, w: 4, h: 4 };
const DOOR = { x: 21, y: 9, dx: 0, dy: 1 };

/** A fresh sandbox game with money to spend and a Consultation Room pencilled in. */
function sketched() {
  const sim = freshSim();
  sim.s.money = 100_000;
  const sketch = sim.addSketch('consult', FLOOR, DOOR);
  if (!sketch) throw new Error('could not pencil the room in');
  return { sim, sketch };
}

describe('pencilling a room in', () => {
  it('keeps its kind, floor, door and day, costs nothing, and repaints the floor', () => {
    const sim = freshSim();
    sim.s.day = 20.6;
    const money = sim.s.money;
    const version = sim.world.version;
    const sketch = sim.addSketch('consult', FLOOR, DOOR);
    expect(sketch).toMatchObject({ type: 'consult', ...FLOOR, door: DOOR, day: 20 });
    expect(sim.s.sketches).toEqual([sketch]);
    expect(sim.s.money).toBe(money);
    expect(sim.world.version).toBeGreaterThan(version);
  });

  it('says what to do next the first time only', () => {
    const sim = freshSim();
    sim.addSketch('consult', FLOOR, DOOR);
    sim.addSketch('staffroom', { x: 20, y: 12, w: 3, h: 3 }, { x: 21, y: 12, dx: 0, dy: -1 });
    const tips = sim.drain().filter((e) => e.type === 'toast' && e.text === SKETCH_TIP);
    expect(tips).toHaveLength(1);
  });

  it('follows the rules a room does inside the building', () => {
    const sim = freshSim();
    expect(sim.world.sketchRectValid('consult', { x: 20, y: 6, w: 2, h: 2 }).reason).toMatch(/Too small/);
    sim.createRoom('massage', LAYOUT.massage.rect, LAYOUT.massage.door);
    expect(sim.world.sketchRectValid('consult', { x: 12, y: 6, w: 4, h: 4 }).reason).toMatch(/another room/);
    expect(sim.addSketch('consult', { x: 12, y: 6, w: 4, h: 4 }, { x: 12, y: 6, dx: -1, dy: 0 })).toBeNull();
  });

  it('wants a door a room could have inside the building', () => {
    const sim = freshSim();
    // through the building's outer wall
    expect(sim.world.sketchDoorValid(FLOOR, { x: 21, y: 6, dx: 0, dy: -1 }).ok).toBe(true);
    expect(sim.world.sketchDoorValid({ x: 20, y: 3, w: 4, h: 4 }, { x: 21, y: 3, dx: 0, dy: -1 }).ok).toBe(false);
    expect(sim.addSketch('consult', { x: 20, y: 3, w: 4, h: 4 }, { x: 21, y: 3, dx: 0, dy: -1 })).toBeNull();
  });

  it('can go on a plot for sale, with its door on any edge', () => {
    const sim = freshSim();
    const plot = { x: 29, y: 5, w: 4, h: 4 };
    expect(sim.world.sketchRectValid('consult', plot).ok).toBe(true);
    expect(sim.addSketch('consult', plot, { x: 29, y: 6, dx: -1, dy: 0 })).not.toBeNull();
  });

  it('may not straddle the building and a plot, nor go anywhere else outdoors', () => {
    const sim = freshSim();
    expect(sim.world.sketchRectValid('consult', { x: 26, y: 5, w: 4, h: 4 }).reason).toMatch(/all inside/);
    // the front lawn
    expect(sim.world.sketchRectValid('consult', { x: 18, y: 18, w: 4, h: 2 }).ok).toBe(false);
    expect(sim.addSketch('consult', { x: 26, y: 5, w: 4, h: 4 }, { x: 26, y: 6, dx: -1, dy: 0 })).toBeNull();
  });

  it('may not go over another sketch, which it names', () => {
    const { sim, sketch } = sketched();
    const check = sim.world.sketchRectValid('staffroom', { x: 22, y: 8, w: 3, h: 3 });
    expect(check).toEqual({
      ok: false,
      reason: "That's pencilled in for a Consultation Room. Erase the sketch first.",
      sketch: sketch.id,
    });
    // nor over one on a plot
    sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    expect(sim.world.sketchRectValid('staffroom', { x: 31, y: 7, w: 3, h: 3 }).sketch).toBeDefined();
  });

  it('can be erased, for nothing, and repaints the floor', () => {
    const { sim, sketch } = sketched();
    const version = sim.world.version;
    expect(sim.eraseSketch(sketch.id)).toBe(true);
    expect(sim.s.sketches).toEqual([]);
    expect(sim.world.version).toBeGreaterThan(version);
    expect(sim.eraseSketch(sketch.id)).toBe(false);
  });

  it('costs what its room would at its size', () => {
    const { sim } = sketched();
    sim.addSketch('staffroom', { x: 20, y: 11, w: 5, h: 4 }, { x: 21, y: 11, dx: 0, dy: -1 });
    const staffroom = ROOMS.staffroom.cost + (20 - 16) * ROOM_TILE_COST;
    expect(sketchCost({ type: 'staffroom', w: 5, h: 4 })).toBe(staffroom);
    expect(sketchesCost(sim.s)).toBe(ROOMS.consult.cost + staffroom);
  });
});

describe('nothing is built over a sketch', () => {
  const NAMED = "That's pencilled in for a Consultation Room. Erase the sketch first.";

  it('turns down an item on it, naming it', () => {
    const { sim, sketch } = sketched();
    expect(sim.world.canPlaceItem('plant', 21, 7, 0)).toEqual({ ok: false, reason: NAMED, sketch: sketch.id });
    expect(sim.placeItem('plant', 21, 7, 0)).toBeNull();
    // a rug lies flat, but not on a sketch either
    expect(sim.world.canPlaceItem('rug', 21, 7, 0).sketch).toBe(sketch.id);
  });

  it('turns down an item used from it', () => {
    const { sim, sketch } = sketched();
    // a bench at row 5 is sat on from row 6, the sketch's first row
    expect(ITEMS.bench.access[0]?.y).toBe(1);
    expect(sim.world.canPlaceItem('bench', 21, 5, 0).sketch).toBe(sketch.id);
    // turned round, it is used from row 4, clear of it
    expect(sim.world.canPlaceItem('bench', 21, 5, 2).ok).toBe(true);
  });

  it('turns down something hung on the wall behind it', () => {
    const sim = freshSim();
    // against the building's back wall
    const sketch = sim.addSketch('consult', { x: 20, y: 3, w: 4, h: 4 }, { x: 21, y: 6, dx: 0, dy: 1 });
    const wall = sim.world.nearestWall('motivational_poster', 21.5, 3.1);
    expect(wall).not.toBeNull();
    if (wall) expect(sim.world.canPlaceItem('motivational_poster', wall.x, wall.y, wall.rot).sketch).toBe(sketch?.id);
    // further along the wall the sketch is no bar
    const along = sim.world.nearestWall('motivational_poster', 25.5, 3.1);
    if (along)
      expect(sim.world.canPlaceItem('motivational_poster', along.x, along.y, along.rot).sketch).toBeUndefined();
  });

  it('turns down something outdoors on a sketch on a plot, naming it', () => {
    const sim = freshSim();
    const sketch = sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    expect(sim.world.canPlaceItem('generator', 30, 6, 0)).toMatchObject({ ok: false, sketch: sketch?.id });
  });

  it('turns down a room drawn over it, but not its own build', () => {
    const { sim, sketch } = sketched();
    const over = { x: 18, y: 6, w: 4, h: 4 };
    expect(sim.world.roomRectValid('massage', over)).toEqual({ ok: false, reason: NAMED, sketch: sketch.id });
    expect(sim.world.roomRectValid('consult', over, undefined, sketch.id).ok).toBe(true);
  });

  it('turns down a room resized into it', () => {
    const { sim, sketch } = sketched();
    const room = sim.createRoom('staffroom', { x: 16, y: 6, w: 3, h: 3 }, { x: 17, y: 8, dx: 0, dy: 1 });
    const into = { x: 16, y: 6, w: 5, h: 3 };
    expect(sim.world.resizeValid(room, into)).toEqual({ ok: false, reason: NAMED, sketch: sketch.id });
    expect(sim.resizeRoom(room.id, into)).toBe(false);
    // short of it is fine
    expect(sim.world.resizeValid(room, { x: 16, y: 6, w: 4, h: 3 }).ok).toBe(true);
  });

  it('turns down a room moved, copied or built from a template over it', () => {
    const { sim, consult } = openCenter();
    const sketch = sim.addSketch('staffroom', { x: 20, y: 6, w: 4, h: 3 }, { x: 21, y: 8, dx: 0, dy: 1 });
    const placed = placeLayout(sim.roomLayout(consult), 19, 5);
    expect(sim.world.layoutValid('consult', placed, consult).sketch).toBe(sketch?.id);
    expect(sim.moveRoom(consult.id, placed)).toBe(false);
  });

  it('leaves the way through as it was: nobody walks round a sketch', () => {
    const plain = openCenter().sim;
    const { sim } = openCenter();
    sim.addSketch('staffroom', { x: 20, y: 9, w: 4, h: 3 }, { x: 21, y: 9, dx: 0, dy: -1 });
    sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    sim.world.rebuild();
    plain.world.rebuild();
    expect(sim.world.zone).toEqual(plain.world.zone);
    expect(sim.world.blocked).toEqual(plain.world.blocked);
    expect(sim.world.reserved).toEqual(plain.world.reserved);
    expect([...sim.world.doors]).toEqual([...plain.world.doors]);
    expect(sim.world.findPath(14, 17, 22, 10)).toEqual(plain.world.findPath(14, 17, 22, 10));
    expect(sim.world.walkable(21, 10)).toBe(true);
  });
});

describe('building a sketch', () => {
  it('opens its blueprint in its rectangle, with its door, and rubs it out', () => {
    const { sim, sketch } = sketched();
    const money = sim.s.money;
    const room = sim.buildSketch(sketch.id);
    expect(room).toMatchObject({ type: 'consult', ...FLOOR, door: DOOR, done: false });
    expect(sim.s.sketches).toEqual([]);
    // nothing is charged until the blueprint is built
    expect(sim.s.money).toBe(money);
  });

  it('keeps the sketch when it no longer fits', () => {
    const { sim, sketch } = sketched();
    // a room next door whose doorway is the sketch's own doorway
    sim.createRoom('staffroom', { x: 20, y: 10, w: 3, h: 3 }, { x: 21, y: 10, dx: 0, dy: -1 });
    expect(sim.world.sketchFits(sketch).ok).toBe(false);
    expect(sim.buildSketch(sketch.id)).toBeNull();
    expect(sim.s.sketches).toEqual([sketch]);
  });

  it('elsewhere, gives way only to a room on its floor', () => {
    const { sim, sketch } = sketched();
    const apart = sim.buildSketchAt(sketch.id, { x: 16, y: 11, w: 4, h: 4 }, { x: 17, y: 11, dx: 0, dy: -1 });
    expect(apart?.type).toBe('consult');
    expect(sim.s.sketches).toEqual([sketch]);
    const over = sim.buildSketchAt(sketch.id, { x: 21, y: 6, w: 4, h: 4 }, { x: 22, y: 9, dx: 0, dy: 1 });
    expect(over).toMatchObject({ type: 'consult', x: 21 });
    expect(sim.s.sketches).toEqual([]);
  });

  it('comes back as it was if its blueprint is torn up, while its floor is free', () => {
    const { sim, sketch } = sketched();
    const copy: Sketch = { ...sketch };
    const room = sim.buildSketch(sketch.id);
    if (!room) throw new Error('no blueprint');
    sim.removeRoom(room.id, 1);
    expect(sim.restoreSketch(copy)).toBe(true);
    expect(sim.s.sketches).toEqual([copy]);
    // but not twice, nor where something has been put down meanwhile
    expect(sim.restoreSketch(copy)).toBe(false);
    sim.eraseSketch(copy.id);
    sim.placeItem('plant', 21, 7, 0);
    expect(sim.restoreSketch(copy)).toBe(false);
  });
});

describe('a blueprint pencilled in for later', () => {
  it('is torn up with its windows and extras refunded, and kept as a sketch of its floor and door', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const before = sim.s.money;
    const room = sim.createRoom('consult', FLOOR, DOOR);
    sim.placeItem('consult_desk', 21, 7, 0, { free: true, roomId: room.id });
    sim.toggleWindow(room.id, { x: 23, y: 7, dx: 1, dy: 0 });
    sim.placeItem('plant', 20, 6, 0);
    expect(sim.s.money).toBe(before - WINDOW_COST - ITEMS.plant.cost);
    const sketch = sim.sketchBlueprint(room.id);
    expect(sketch).toMatchObject({ type: 'consult', ...FLOOR, door: DOOR });
    expect(sim.world.room(room.id)).toBeUndefined();
    expect(sim.s.items).toEqual([]);
    expect(sim.s.money).toBe(before);
    expect(sim.s.sketches).toEqual([sketch]);
  });

  it('is only for a blueprint', () => {
    const { sim, consult } = openCenter();
    expect(sim.sketchBlueprint(consult.id)).toBeNull();
    expect(sim.world.room(consult.id)).toBe(consult);
  });
});

describe('saves', () => {
  it('from before rooms were pencilled in have none', () => {
    const sim = freshSim();
    const old = JSON.parse(JSON.stringify(sim.s)) as Partial<GameState>;
    delete old.sketches;
    old.version = 39;
    upgradeSave(old as GameState);
    expect(old.sketches).toEqual([]);
  });

  it('keep sketches, and drop any of a kind of room this version has never heard of', () => {
    const { sim, sketch } = sketched();
    const save = JSON.parse(JSON.stringify(sim.s)) as GameState;
    save.sketches.push({ ...sketch, id: 999, type: 'teleporter' as Sketch['type'] });
    upgradeSave(save);
    expect(save.sketches).toEqual([sketch]);
  });
});

describe('a fit that keeps up', () => {
  it('is worked out once while the world stays as it was, and again once it changes', () => {
    const { sim, sketch } = sketched();
    const fit = sim.world.sketchFit(sketch);
    expect(fit).toEqual({ fit: { ok: true, reason: '' }, standing: 'fits' });
    expect(sim.world.sketchFit(sketch)).toBe(fit);
    // a plant in its doorway, the tile its door opens onto
    expect(sim.placeItem('plant', 21, 10, 0)).not.toBeNull();
    const blocked = sim.world.sketchFit(sketch);
    expect(blocked).not.toBe(fit);
    expect(blocked).toMatchObject({ fit: { ok: false, reason: 'Something is blocking that doorway' } });
    expect(blocked.standing).toBe('doorway');
    expect(sim.world.sketchFits(sketch)).toBe(blocked.fit);
  });

  it('says a doorway is blocked when a room next door takes the tile its door opens onto', () => {
    const { sim, sketch } = sketched();
    sim.createRoom('staffroom', { x: 20, y: 10, w: 3, h: 3 }, { x: 21, y: 12, dx: 0, dy: 1 });
    expect(sim.world.sketchFit(sketch).standing).toBe('doorway');
    expect(noLongerFits(sim.world, sketch)).toBe(true);
  });

  it('says it no longer fits when its floor is taken', () => {
    const { sim, sketch } = sketched();
    const room = sim.createRoom('staffroom', { x: 16, y: 11, w: 3, h: 3 }, { x: 17, y: 11, dx: 0, dy: -1 });
    // moved over half of it behind the rules' back, as a save from before them could have it
    Object.assign(room, { x: 18, y: 6, door: { x: 19, y: 8, dx: 0, dy: 1 } });
    sim.world.rebuild();
    expect(sim.world.sketchFit(sketch)).toMatchObject({ fit: { reason: 'Overlaps another room' }, standing: 'unfit' });
  });

  it('counts the sketches that no longer fit, not the ones waiting for their land', () => {
    const { sim, sketch } = sketched();
    sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    expect(unfitCount(sim.world)).toBe(0);
    sim.placeItem('plant', 21, 10, 0);
    expect(unfitCount(sim.world)).toBe(1);
    expect(noLongerFits(sim.world, sketch)).toBe(true);
  });
});

describe('no door opens onto a sketch', () => {
  const NAMED = "That's pencilled in for a Consultation Room. Erase the sketch first.";

  it("turns down a room's door, naming it", () => {
    const { sim, sketch } = sketched();
    const door = { x: 19, y: 7, dx: 1, dy: 0 };
    expect(sim.world.doorValid('staffroom', { x: 17, y: 6, w: 3, h: 3 }, door)).toEqual({
      ok: false,
      reason: NAMED,
      sketch: sketch.id,
    });
    // the same door opening the other way is fine
    expect(sim.world.doorValid('staffroom', { x: 17, y: 6, w: 3, h: 3 }, { x: 17, y: 7, dx: -1, dy: 0 }).ok).toBe(true);
  });

  it('turns down a room resized so its door would open onto one', () => {
    const { sim, sketch } = sketched();
    const room = sim.createRoom('staffroom', { x: 16, y: 6, w: 3, h: 3 }, { x: 18, y: 7, dx: 1, dy: 0 });
    expect(sim.world.resizeValid(room, { x: 16, y: 6, w: 4, h: 3 })).toEqual({
      ok: false,
      reason: NAMED,
      sketch: sketch.id,
    });
  });

  it('turns down a room moved so its door would open onto one', () => {
    const { sim, consult } = openCenter();
    const sketch = sim.addSketch('staffroom', { x: 20, y: 6, w: 3, h: 3 }, { x: 21, y: 6, dx: 0, dy: -1 });
    // the Consultation Room's door is on its east wall, two rows down, so it opens onto (20, 8)
    const placed = placeLayout(sim.roomLayout(consult), 16, 6);
    expect(placed.door).toMatchObject({ x: 19, y: 8, dx: 1 });
    expect(sim.world.layoutValid('consult', placed, consult).sketch).toBe(sketch?.id);
  });

  it("turns down a sketch's door onto another sketch, inside or on a plot", () => {
    const { sim, sketch } = sketched();
    expect(sim.world.sketchDoorValid({ x: 24, y: 6, w: 3, h: 3 }, { x: 24, y: 7, dx: -1, dy: 0 }).sketch).toBe(
      sketch.id,
    );
    const onPlot = sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    const next = { x: 29, y: 9, w: 4, h: 4 };
    expect(sim.world.sketchDoorValid(next, { x: 30, y: 9, dx: 0, dy: -1 }).sketch).toBe(onPlot?.id);
    expect(sim.addSketch('consult', next, { x: 30, y: 9, dx: 0, dy: -1 })).toBeNull();
    expect(sim.world.sketchDoorValid(next, { x: 30, y: 12, dx: 0, dy: 1 }).ok).toBe(true);
  });

  it("turns down a sketch over another sketch's doorway", () => {
    const { sim, sketch } = sketched();
    // the Consultation Room's door opens onto (21, 10)
    expect(sim.world.sketchRectValid('staffroom', { x: 20, y: 10, w: 3, h: 3 })).toEqual({
      ok: false,
      reason: NAMED,
      sketch: sketch.id,
    });
    expect(sim.world.sketchRectValid('staffroom', { x: 20, y: 11, w: 3, h: 3 }).ok).toBe(true);
  });
});

describe('a sketch on a plot', () => {
  /** A sandbox game with money, every plot for sale, and two sketches on the east wing: one whose door will face in. */
  function onTheWing() {
    const sim = freshSim();
    sim.s.money = 1_000_000;
    sim.s.unlockAll = true;
    const inward = sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    // its door on the wing's east edge, which will be the building's outer wall
    const outward = sim.addSketch('consult', { x: 32, y: 10, w: 4, h: 4 }, { x: 35, y: 11, dx: 1, dy: 0 });
    if (!inward || !outward) throw new Error('could not pencil the rooms in');
    return { sim, inward, outward };
  }

  /** Have the builders finish every plot they are at, as if the days had passed. */
  function finishWork(sim: Sim) {
    for (const l of sim.s.land) if (l.ready !== undefined) l.ready = sim.s.day;
    run(sim, 1.1);
  }

  it('waits for its land, and is not counted as no longer fitting meanwhile', () => {
    const { sim, inward } = onTheWing();
    expect(sim.world.sketchFit(inward)).toEqual({
      fit: { ok: false, reason: 'That land is not yours yet' },
      standing: 'waits',
    });
    expect(sim.buyPlot('east-wing')).toBe(true);
    expect(sim.world.sketchFit(inward)).toMatchObject({ fit: { reason: 'The builders are at work there' } });
    expect(unfitCount(sim.world)).toBe(0);
  });

  it('is kept when its plot is bought and built on, and judged as any other inside', () => {
    const { sim, inward, outward } = onTheWing();
    expect(sim.buyPlot('east-wing')).toBe(true);
    finishWork(sim);
    expect(sim.s.sketches).toEqual([inward, outward]);
    expect(sim.world.inside(inward.x, inward.y)).toBe(true);
    expect(sim.world.sketchFit(inward).standing).toBe('fits');
    // its door faces the new outer wall
    expect(sim.world.sketchFit(outward)).toMatchObject({
      fit: { ok: false, reason: 'Doors must open onto a corridor' },
      standing: 'doorway',
    });
    expect(unfitCount(sim.world)).toBe(1);
    // and the one that fits can be built where it is
    expect(sim.buildSketch(inward.id)).toMatchObject({ type: 'consult', x: 29, y: 5 });
  });

  it("no longer fits once the building's new entrance needs its floor kept clear", () => {
    const { sim } = onTheWing();
    expect(sim.buyPlot('east-wing')).toBe(true);
    finishWork(sim);
    // over the tiles inside the garden pavilion's own front door, which opens at (39, 17)
    const sketch = sim.addSketch('consult', { x: 39, y: 14, w: 4, h: 4 }, { x: 40, y: 14, dx: 0, dy: -1 });
    if (!sketch) throw new Error('could not pencil the room in');
    expect(sim.buyPlot('garden-block')).toBe(true);
    finishWork(sim);
    expect(sim.s.sketches).toContain(sketch);
    expect(sim.world.sketchFit(sketch)).toMatchObject({
      fit: { ok: false, reason: 'Keep doorways and access spots clear' },
      standing: 'unfit',
    });
  });
});
