// Pencilling rooms in with the build tools: the sketch tool's drag and door, its hints, what a refusal over a sketch
// selects, building a sketch into its blueprint, a blueprint pencilled in for later, what the interface says, the play
// statistics, and that the tutorial pays sketches no mind.
import { describe, expect, it } from 'vitest';

import { markOf, playEvents } from '../../src/app/play-events';
import { sketchDoorHint, sketchHint } from '../../src/app/tools/hints';
import { Tools } from '../../src/app/tools/tools';
import { ITEMS, ROOMS, WINDOW_COST } from '../../src/core/data';
import type { Sim } from '../../src/core/sim/sim';
import type { View } from '../../src/render/view';
import { hintChips } from '../../src/ui/lib/hint-chips';
import { shortfall, sketchCount, sketchDay, sketchNote, sketchTag } from '../../src/ui/lib/sketches';
import { addConsult, freshSim, hire } from './helpers';

/** Ignore a call to the scene. */
const nothing = () => undefined;

/** The build tools on a game, with a scene that puts the cursor wherever the pointer says, and the refusals counted. */
function toolsFor(sim: Sim) {
  const refusals: [string, string][] = [];
  const view = {
    selected: null,
    setOverlay: nothing,
    setMarkers: nothing,
    setGhost: nothing,
    setDoor: nothing,
    nudge: nothing,
    /** The tile under the pointer: the pointer is given in tiles. */
    groundAt: (x: number, y: number) => ({ x, y }),
  };
  const tools = new Tools(sim, view as unknown as View, nothing, nothing, (action, reason) =>
    refusals.push([action, reason]),
  );
  return { tools, refusals };
}

/** A sandbox game with money in the bank and the build tools on it. */
function game() {
  const sim = freshSim();
  sim.s.money = 100_000;
  return { sim, ...toolsFor(sim) };
}

/** Drag a rectangle out from one tile to another and let go, as the pointer would. */
function drag(tools: Tools, from: [number, number], to: [number, number]) {
  tools.pointerDown(from[0] + 0.5, from[1] + 0.5);
  tools.pointerMove(to[0] + 0.5, to[1] + 0.5);
  tools.pointerUp(to[0] + 0.5, to[1] + 0.5);
}

/** Click a point, as the pointer would. */
function click(tools: Tools, x: number, y: number) {
  tools.pointerDown(x, y);
  tools.pointerUp(x, y);
}

// a Consultation Room's floor from (20, 6) to (23, 9), with its door at the middle of its south wall
const SOUTH_DOOR: [number, number] = [21.5, 9.95];

describe('the sketch tool', () => {
  it('drags out the floor, takes the door, pencils the room in, and stays in hand for another', () => {
    const { sim, tools } = game();
    const money = sim.s.money;
    tools.startSketch('consult');
    drag(tools, [20, 6], [23, 9]);
    expect(tools.tool).toMatchObject({ kind: 'sketch', phase: 'door', rect: { x: 20, y: 6, w: 4, h: 4 } });
    expect(tools.hint).toBe(sketchDoorHint('consult'));
    click(tools, ...SOUTH_DOOR);
    expect(sim.s.sketches).toMatchObject([{ type: 'consult', x: 20, y: 6, door: { x: 21, y: 9, dx: 0, dy: 1 } }]);
    expect(sim.s.money).toBe(money);
    expect(tools.tool).toMatchObject({ kind: 'sketch', type: 'consult', phase: 'drag', rect: null });
  });

  it('says what it will cost one day and that nothing is charged now, in chips', () => {
    const { tools } = game();
    tools.startSketch('consult');
    expect(hintChips(tools.hint)).toEqual([
      { kind: 'name', text: '✎ Consultation Room' },
      { kind: 'step', text: 'drag out the floor to pencil it in (at least 3×3)' },
      { kind: 'cost', text: '$4,000 when built · nothing charged now' },
      { kind: 'key', key: 'Esc', text: 'cancels' },
    ]);
    expect(sketchDoorHint('consult')).toBe(
      '✎ Consultation Room · click a wall for the door · Esc goes back to the floor',
    );
    expect(sketchHint('consult', { x: 0, y: 0, w: 5, h: 4 })).toContain('$4,800 when built');
  });

  it('goes back to the floor from the door with Esc, and is put down from the floor', () => {
    const { tools } = game();
    tools.startSketch('consult');
    drag(tools, [20, 6], [23, 9]);
    tools.back();
    expect(tools.tool).toMatchObject({ kind: 'sketch', phase: 'drag', rect: { x: 20, y: 6 }, held: true });
    // a click takes the floor back as it was
    click(tools, 21.5, 7.5);
    expect(tools.tool).toMatchObject({ kind: 'sketch', phase: 'door', rect: { x: 20, y: 6, w: 4, h: 4 } });
    tools.back();
    tools.back();
    expect(tools.tool.kind).toBe('none');
  });

  it('turns down a sketch over another, saying whose it is, and selects that one', () => {
    const { sim, tools, refusals } = game();
    const first = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    tools.startSketch('staffroom');
    drag(tools, [22, 8], [24, 10]);
    expect(sim.s.sketches).toHaveLength(1);
    expect(refusals).toEqual([['draw_sketch', "That's pencilled in for a Consultation Room. Erase the sketch first."]]);
    expect(tools.selected).toEqual({ kind: 'sketch', id: first?.id });
  });

  it('turns down a door the room could not have, as its own refusal', () => {
    const { sim, tools, refusals } = game();
    tools.startSketch('consult');
    drag(tools, [20, 3], [23, 6]);
    // through the building's back wall
    click(tools, 21.5, 3.05);
    expect(sim.s.sketches).toEqual([]);
    expect(refusals.map(([action]) => action)).toEqual(['place_sketch_door']);
  });
});

describe('building over a sketch', () => {
  it('turns an item down with the sketch named, and selects it so it can be erased', () => {
    const { sim, tools, refusals } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    tools.startItem('plant');
    tools.pointerMove(21.5, 7.5);
    expect(tools.problem).toBe("That's pencilled in for a Consultation Room. Erase the sketch first.");
    tools.pointerUp(21.5, 7.5);
    expect(refusals.map(([action]) => action)).toEqual(['place_item']);
    expect(tools.selected).toEqual({ kind: 'sketch', id: sketch?.id });
    expect(sim.s.items).toEqual([]);
  });

  it('turns a room drawn over it down the same way', () => {
    const { sim, tools, refusals } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    tools.startRoom('massage');
    drag(tools, [17, 6], [20, 9]);
    expect(refusals.map(([action]) => action)).toEqual(['draw_room']);
    expect(tools.selected).toEqual({ kind: 'sketch', id: sketch?.id });
  });
});

describe('Build here', () => {
  it('opens the blueprint in the sketch, with its door, and the first required item in hand', () => {
    const { sim, tools } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    tools.buildSketch(sketch.id);
    const t = tools.tool;
    expect(t).toMatchObject({ kind: 'room', phase: 'plan', sub: { kind: 'item', type: ROOMS.consult.required[0] } });
    expect(tools.plan?.room).toMatchObject({ type: 'consult', x: 20, y: 6, w: 4, h: 4, door: sketch.door });
    expect(sim.s.sketches).toEqual([]);
  });

  it('puts the sketch back if the blueprint is cancelled', () => {
    const { sim, tools } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    tools.buildSketch(sketch.id);
    tools.cancel();
    expect(sim.s.rooms).toEqual([]);
    expect(sim.s.sketches).toEqual([sketch]);
    expect(tools.selected).toEqual({ kind: 'sketch', id: sketch.id });
  });

  it('is turned down, the sketch kept, when the room cannot be paid for', () => {
    const { sim, tools, refusals } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    sim.s.money = ROOMS.consult.cost - 1;
    tools.buildSketch(sketch.id);
    expect(tools.tool.kind).toBe('none');
    expect(refusals).toEqual([['build_sketch', "Can't afford it"]]);
    expect(sim.s.sketches).toEqual([sketch]);
  });

  it('where it no longer fits, hands its floor to the room tool: a click keeps it, and the room gives the sketch way', () => {
    const { sim, tools } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    // a room on the corridor the sketch's door opened onto
    sim.createRoom('staffroom', { x: 20, y: 10, w: 3, h: 3 }, { x: 22, y: 12, dx: 0, dy: 1 });
    tools.buildSketch(sketch.id);
    expect(tools.tool).toMatchObject({ kind: 'room', phase: 'drag', held: true, rect: { x: 20, y: 6, w: 4, h: 4 } });
    expect(tools.problem).toBe('');
    // pressed and let go on one tile, the floor is kept as it was
    click(tools, 21.5, 7.5);
    expect(tools.tool).toMatchObject({ kind: 'room', phase: 'door', rect: { x: 20, y: 6, w: 4, h: 4 } });
    // a door onto the corridor to the east
    click(tools, 23.95, 7.5);
    expect(tools.plan?.room).toMatchObject({ type: 'consult', x: 20, y: 6, door: { x: 23, dx: 1 } });
    expect(sim.s.sketches).toEqual([]);
  });

  it('where it no longer fits, a drag elsewhere leaves the sketch be', () => {
    const { sim, tools } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    sim.createRoom('staffroom', { x: 20, y: 10, w: 3, h: 3 }, { x: 22, y: 12, dx: 0, dy: 1 });
    tools.buildSketch(sketch.id);
    drag(tools, [5, 6], [8, 9]);
    click(tools, 8.95, 7.5);
    expect(tools.plan?.room).toMatchObject({ type: 'consult', x: 5, y: 6 });
    expect(sim.s.sketches).toEqual([sketch]);
  });
});

describe('Move', () => {
  it('picks the sketch up with its floor offered where it was, and puts it down where it is drawn again', () => {
    const { sim, tools } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    tools.moveSketch(sketch.id);
    expect(sim.s.sketches).toEqual([]);
    expect(tools.hint).toContain('drag it out again');
    drag(tools, [10, 6], [13, 9]);
    click(tools, 11.5, 9.95);
    expect(sim.s.sketches).toMatchObject([{ type: 'consult', x: 10, y: 6 }]);
    expect(tools.tool.kind).toBe('none');
    expect(tools.selected).toEqual({ kind: 'sketch', id: sim.s.sketches[0]?.id });
  });

  it('puts the sketch back as it was if the tool is put down first', () => {
    const { sim, tools } = game();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    tools.moveSketch(sketch.id);
    tools.back();
    expect(sim.s.sketches).toEqual([sketch]);
  });
});

describe('a blueprint pencilled in for later', () => {
  it('closes the blueprint, refunds its windows, and selects the sketch it leaves', () => {
    const { sim, tools } = game();
    tools.startRoom('consult');
    drag(tools, [20, 6], [23, 9]);
    click(tools, ...SOUTH_DOOR);
    const room = tools.plan?.room;
    if (!room) throw new Error('no blueprint');
    const before = sim.s.money;
    sim.toggleWindow(room.id, { x: 23, y: 7, dx: 1, dy: 0 });
    expect(sim.s.money).toBe(before - WINDOW_COST);
    tools.planSketch();
    expect(tools.tool.kind).toBe('none');
    expect(sim.s.money).toBe(before);
    expect(sim.s.rooms).toEqual([]);
    expect(sim.s.sketches).toMatchObject([{ type: 'consult', x: 20, y: 6, door: room.door }]);
    expect(tools.selected).toEqual({ kind: 'sketch', id: sim.s.sketches[0]?.id });
  });
});

describe('what the interface says', () => {
  it('counts the sketches and what building them all would cost', () => {
    const sim = freshSim();
    expect(sketchCount(sim.world)).toBe('Nothing pencilled in yet');
    sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    expect(sketchCount(sim.world)).toBe('1 pencilled in · $4,000 to build it');
    sim.addSketch('staffroom', { x: 20, y: 11, w: 3, h: 3 }, { x: 21, y: 11, dx: 0, dy: -1 });
    expect(sketchCount(sim.world)).toBe(
      `2 pencilled in · $${(4000 + ROOMS.staffroom.cost).toLocaleString('en-US')} to build them all`,
    );
  });

  it('counts the sketches that no longer fit, one or more', () => {
    const sim = freshSim();
    sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    sim.addSketch('staffroom', { x: 16, y: 11, w: 3, h: 3 }, { x: 17, y: 11, dx: 0, dy: -1 });
    const cost = `$${(4000 + ROOMS.staffroom.cost).toLocaleString('en-US')}`;
    // a plant in each doorway
    sim.placeItem('plant', 21, 10, 0);
    expect(sketchCount(sim.world)).toBe(`2 pencilled in · ${cost} to build them all · one no longer fits`);
    sim.placeItem('plant', 17, 10, 0);
    expect(sketchCount(sim.world)).toBe(`2 pencilled in · ${cost} to build them all · 2 no longer fit`);
  });

  it('labels a sketch with its size, or what has gone wrong with it', () => {
    const sim = freshSim();
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    expect(sketchTag(sketch, sim.world.sketchFit(sketch))).toBe('pencilled in · 4×4');
    const fit = { ok: false, reason: '' };
    expect(sketchTag(sketch, { fit, standing: 'waits' })).toBe('pencilled in · 4×4');
    expect(sketchTag(sketch, { fit, standing: 'doorway' })).toBe('⚠ doorway blocked');
    expect(sketchTag(sketch, { fit, standing: 'unfit' })).toBe('⚠ no longer fits');
    sim.placeItem('plant', 21, 10, 0);
    expect(sketchTag(sketch, sim.world.sketchFit(sketch))).toBe('⚠ doorway blocked');
  });

  it('says when a sketch was drawn and who its room needs', () => {
    const sim = freshSim();
    sim.s.day = 20.4;
    const sketch = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    if (!sketch) throw new Error('no sketch');
    expect(sketchNote(sketch, sim.s)).toBe(
      'Pencilled in on Day 21. Needs a Wellness Consultant once it opens. Nothing can be placed on it until you erase it.',
    );
    sim.s.day += 60;
    expect(sketchDay(sketch, sim.s)).toMatch(/^Day 21 of M\d+ Y1$/);
    const restroom = { ...sketch, type: 'restroom' as const };
    expect(sketchNote(restroom, sim.s)).not.toContain('Needs');
  });

  it("says what the bank is short of a blueprint's price, and nothing when it is not", () => {
    expect(shortfall(2340, 4000)).toBe('You have $2,340: not enough to build this yet.');
    expect(shortfall(4000, 4000)).toBeNull();
  });
});

describe('the play statistics', () => {
  it('count a sketch drawn, one built and one erased', () => {
    const { sim, tools } = game();
    let mark = markOf(sim.s);
    const a = sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    const b = sim.addSketch('staffroom', { x: 5, y: 6, w: 3, h: 3 }, { x: 6, y: 8, dx: 0, dy: 1 });
    expect(playEvents(mark, sim.s).map((e) => [e.name, e.props.room])).toEqual([
      ['sketch_drawn', 'consult'],
      ['sketch_drawn', 'staffroom'],
    ]);
    mark = markOf(sim.s);
    if (!a || !b) throw new Error('no sketches');
    tools.buildSketch(a.id);
    sim.eraseSketch(b.id);
    expect(playEvents(mark, sim.s).map((e) => [e.name, e.props.room])).toEqual([
      ['sketch_built', 'consult'],
      ['sketch_erased', 'staffroom'],
    ]);
  });
});

describe('the tutorial', () => {
  it('is not moved on by a room pencilled in', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    sim.s.tutorial = true;
    sim.noteLooked();
    sim.s.speed = 0;
    sim.placeItem('reception_desk', 14, 13, 0);
    hire(sim, 'receptionist');
    expect(sim.tutorialStepId()).toBe('consult');
    sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
    expect(sim.tutorialStepId()).toBe('consult');
    addConsult(sim);
    expect(sim.tutorialStepId()).toBe('consultant');
  });
});

it('an item is charged as ever beside a sketch', () => {
  const { sim } = game();
  sim.addSketch('consult', { x: 20, y: 6, w: 4, h: 4 }, { x: 21, y: 9, dx: 0, dy: 1 });
  const before = sim.s.money;
  expect(sim.placeItem('plant', 19, 7, 0)).not.toBeNull();
  expect(sim.s.money).toBe(before - ITEMS.plant.cost);
});
