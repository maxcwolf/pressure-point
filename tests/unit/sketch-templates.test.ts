// Sketches that remember a room, and the Plans overlay: a template pencilled in, forgotten, moved and built whole, the
// refusals when it cannot be paid for or no longer fits, a layout this version cannot build, saves, and what the Plans
// overlay lists and says.
import { describe, expect, it } from 'vitest';

import { markOf, playEvents } from '../../src/app/play-events';
import { templateSketchHint } from '../../src/app/tools/hints';
import { Tools } from '../../src/app/tools/tools';
import { ITEMS, type ItemType } from '../../src/core/data';
import { money } from '../../src/core/format';
import { roomCost } from '../../src/core/resize';
import { copyCost, type Layout, placeLayout } from '../../src/core/room-layout';
import { itemsInRoom } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import type { Sim } from '../../src/core/sim/sim';
import { sketchCost, sketchesCost } from '../../src/core/sim/sketches';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import type { View } from '../../src/render/view';
import { colorsFloor, heatTiles, OVERLAYS } from '../../src/ui/lib/overlays';
import { planRows, plansLine, plansTag, remembers, sketchNote, sketchTag } from '../../src/ui/lib/sketches';
import { freshSim, toasts } from './helpers';

// The sandbox: its building runs from x 3 to 27 and y 3 to 17, and leaves the floor from x 16 to 26 and y 9 to 12 or
// so free, with the corridor north of it free from x 20.

/** A 4×4 Massage Suite: its door in the bottom wall, a window on each side, a table, a trolley and a plant. */
const COZY: Layout = {
  type: 'massage',
  w: 4,
  h: 4,
  door: { x: 1, y: 3, dx: 0, dy: 1 },
  windows: [
    { x: 0, y: 1, dx: -1, dy: 0 },
    { x: 3, y: 1, dx: 1, dy: 0 },
  ],
  items: [
    { type: 'massage_table', x: 1, y: 0, rot: 0 },
    { type: 'oil_trolley', x: 3, y: 0, rot: 0 },
    { type: 'plant', x: 3, y: 3, rot: 0 },
  ],
};

/** Where the suite goes: its top-left corner, in the free corridor, its door opening south onto (21, 10). */
const AT = { x: 20, y: 6 };

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
  return { tools, view, refusals };
}

/** A sandbox game with money in the bank, the build tools, and the suite pencilled in as "Cozy 4×4". */
function pencilled() {
  const sim = freshSim();
  sim.s.money = 100_000;
  const sketch = sim.pencilTemplate('Cozy 4×4', COZY, placeLayout(COZY, AT.x, AT.y));
  if (!sketch) throw new Error('could not pencil the template in');
  return { sim, sketch, ...toolsFor(sim) };
}

/** Click a point, as the pointer would. */
function click(tools: Tools, x: number, y: number) {
  tools.pointerMove(x, y);
  tools.pointerDown(x, y);
  tools.pointerUp(x, y);
}

describe('pencilling a template in', () => {
  it('copies the layout in, keeps its name, and charges nothing', () => {
    const sim = freshSim();
    const cash = sim.s.money;
    const layout = structuredClone(COZY);
    const sketch = sim.pencilTemplate('Cozy 4×4', layout, placeLayout(layout, AT.x, AT.y));
    expect(sketch).toMatchObject({
      type: 'massage',
      ...AT,
      w: 4,
      h: 4,
      door: { x: 21, y: 9, dx: 0, dy: 1 },
      template: 'Cozy 4×4',
      layout: COZY,
    });
    expect(sim.s.money).toBe(cash);
    // a copy: the template changing later leaves the sketch as it was
    layout.items.pop();
    expect(sketch?.layout?.items).toHaveLength(3);
  });

  it('is priced as building the template would be', () => {
    const { sketch } = pencilled();
    expect(sketchCost(sketch)).toBe(copyCost(COZY));
    expect(sketchCost(sketch)).toBeGreaterThan(roomCost('massage', sketch));
  });

  it('goes only where the template could be built, and in no other sketch’s doorway', () => {
    const { sim } = pencilled();
    // over the first
    expect(sim.pencilTemplate('Cozy 4×4', COZY, placeLayout(COZY, AT.x + 2, AT.y))).toBeNull();
    // through the building's back wall
    expect(sim.pencilTemplate('Cozy 4×4', COZY, placeLayout(COZY, AT.x, 1))).toBeNull();
    // over the tile the first one's door opens onto
    const below = sim.world.templateSketchValid(COZY, placeLayout(COZY, AT.x, AT.y + 4));
    expect(below.ok).toBe(false);
    expect(below.sketch).toBe(sim.s.sketches[0]?.id);
  });

  it('with the template tool: a click pencils it in, the tool stays for another, and the hint says so', () => {
    const sim = freshSim();
    const { tools } = toolsFor(sim);
    tools.startTemplate('Cozy 4×4', COZY, true);
    click(tools, AT.x + 2, AT.y + 2);
    expect(sim.s.sketches).toHaveLength(1);
    expect(sim.s.sketches[0]).toMatchObject({ ...AT, template: 'Cozy 4×4' });
    expect(sim.s.rooms.filter((r) => r.type === 'massage')).toHaveLength(0);
    expect(tools.tool).toMatchObject({ kind: 'template', sketch: true });
    expect(templateSketchHint('Cozy 4×4', 'massage', 7350)).toBe(
      '✎ Cozy 4×4 · Massage Suite template · click to pencil it in · $7,350 when built · nothing charged now · R turns it · Esc cancels',
    );
  });

  it('with the template tool: turned down over another sketch, counted as its own refusal', () => {
    const { sim, tools, refusals } = pencilled();
    tools.startTemplate('Cozy 4×4', COZY, true);
    click(tools, AT.x + 3, AT.y + 2);
    expect(sim.s.sketches).toHaveLength(1);
    expect(refusals.map(([action]) => action)).toEqual(['pencil_template']);
  });
});

describe('forgetting the template', () => {
  it('leaves a plain sketch, its kind, floor and door unchanged', () => {
    const { sim, sketch } = pencilled();
    const { type, x, y, w, h, door } = sketch;
    const version = sim.world.version;
    expect(sim.forgetTemplate(sketch.id)).toBe(true);
    expect(sim.s.sketches[0]).toEqual({ id: sketch.id, type, x, y, w, h, door, day: sketch.day });
    expect(sketchCost(sketch)).toBe(roomCost('massage', sketch));
    expect(sim.world.version).toBeGreaterThan(version);
    expect(sim.forgetTemplate(sketch.id)).toBe(false);
  });
});

describe('moving a sketch that remembers a room', () => {
  it('picks it up whole, and Esc puts it back as it was', () => {
    const { sim, sketch, tools } = pencilled();
    tools.moveSketch(sketch.id);
    expect(sim.s.sketches).toHaveLength(0);
    expect(tools.tool).toMatchObject({ kind: 'template', sketch: true, name: 'Cozy 4×4', layout: COZY });
    tools.back();
    expect(sim.s.sketches).toEqual([sketch]);
  });

  it('puts it down where it is clicked, still remembering, and selects it', () => {
    const { sim, sketch, tools, view } = pencilled();
    tools.moveSketch(sketch.id);
    click(tools, AT.x + 2, 15);
    const moved = sim.s.sketches[0];
    expect(moved).toMatchObject({ x: AT.x, y: 13, template: 'Cozy 4×4', layout: COZY });
    expect(view.selected).toEqual({ kind: 'sketch', id: moved?.id });
    expect(tools.tool.kind).toBe('none');
  });
});

describe('building a sketch that remembers a room', () => {
  it('builds it whole at once, furniture and windows, charges once, selects it, and counts it as from a template', () => {
    const { sim, sketch, tools, view } = pencilled();
    const cash = sim.s.money;
    const mark = markOf(sim.s);
    tools.buildSketch(sketch.id);
    const room = sim.s.rooms.at(-1);
    expect(room).toMatchObject({ type: 'massage', ...AT, w: 4, h: 4, done: true, door: sketch.door });
    expect(room?.windows).toHaveLength(2);
    if (!room) throw new Error('no room');
    const types = itemsInRoom(createContext(sim.s), room).map((it) => it.type);
    expect(types.sort()).toEqual((['massage_table', 'oil_trolley', 'plant'] as ItemType[]).sort());
    expect(sim.s.money).toBe(cash - copyCost(COZY));
    expect(sim.s.sketches).toHaveLength(0);
    expect(tools.tool.kind).toBe('none');
    expect(view.selected).toEqual({ kind: 'room', id: room.id });
    const built = playEvents(mark, sim.s).find((e) => e.name === 'sketch_built');
    expect(built?.props).toMatchObject({ room: 'massage', template: true });
    expect(toasts(sim.drain())).toContain(`"Cozy 4×4" built for ${money(copyCost(COZY))}.`);
  });

  it('is turned down, with the sketch kept, when the bank cannot cover it', () => {
    const { sim, sketch, tools, refusals } = pencilled();
    sim.s.money = copyCost(COZY) - 1;
    sim.drain();
    tools.buildSketch(sketch.id);
    expect(sim.s.money).toBe(copyCost(COZY) - 1);
    expect(sim.s.sketches).toEqual([sketch]);
    expect(toasts(sim.drain())).toContain(`"Cozy 4×4" costs ${money(copyCost(COZY))}. You can't afford it yet.`);
    expect(refusals).toEqual([['build_sketch', "Can't afford it"]]);
  });

  it('is turned down with why when it no longer fits, and the sketch shows amber', () => {
    const { sim, sketch, tools, refusals } = pencilled();
    // a plant in its doorway
    sim.placeItem('plant', 21, 10, 0, { free: true });
    expect(sim.world.sketchFit(sketch).standing).toBe('doorway');
    const rooms = sim.s.rooms.length;
    const cash = sim.s.money;
    sim.drain();
    tools.buildSketch(sketch.id);
    expect(sim.s.rooms).toHaveLength(rooms);
    expect(sim.s.money).toBe(cash);
    expect(sim.s.sketches).toEqual([sketch]);
    const reason = sim.world.sketchFit(sketch).fit.reason;
    expect(refusals).toEqual([['build_sketch', reason]]);
    expect(toasts(sim.drain()).some((t) => t.startsWith(reason))).toBe(true);
  });

  it('judges its fit as building it whole would: its own furniture cutting the corridor off no longer fits', () => {
    const { sim, sketch } = pencilled();
    expect(sim.world.sketchFit(sketch).standing).toBe('fits');
    // a remembered room that no longer makes sense, as when a template comes from a newer version
    sketch.layout?.items.push({ type: 'hologram' as ItemType, x: 0, y: 0, rot: 0 });
    sim.world.version++;
    const fit = sim.world.sketchFit(sketch);
    expect(fit).toEqual({
      fit: { ok: false, reason: "This template needs items this version doesn't have" },
      standing: 'unfit',
    });
  });

  it('with furniture this version does not know, is turned down until the template is forgotten', () => {
    const { sim, sketch, tools, refusals } = pencilled();
    sketch.layout?.items.push({ type: 'hologram' as ItemType, x: 0, y: 0, rot: 0 });
    sim.world.version++;
    tools.buildSketch(sketch.id);
    expect(sim.s.sketches).toEqual([sketch]);
    expect(refusals).toEqual([['build_sketch', "This template needs items this version doesn't have"]]);
    sim.forgetTemplate(sketch.id);
    expect(sim.world.sketchFit(sketch).standing).toBe('fits');
  });
});

describe('saves with sketches that remember a room', () => {
  /** A save of a game with the suite pencilled in, as written to storage. */
  function saved(): GameState {
    const { sim } = pencilled();
    return JSON.parse(JSON.stringify(sim.s)) as GameState;
  }

  it('keep the room remembered', () => {
    const save = saved();
    const before = structuredClone(save.sketches);
    upgradeSave(save);
    expect(save.sketches).toEqual(before);
  });

  it('forget a room with furniture this version does not know, keeping the sketch', () => {
    const save = saved();
    const sketch = save.sketches[0]!;
    sketch.layout?.items.push({ type: 'hologram' as ItemType, x: 0, y: 0, rot: 0 });
    upgradeSave(save);
    expect(save.sketches).toHaveLength(1);
    expect(save.sketches[0]).not.toHaveProperty('layout');
    expect(save.sketches[0]).not.toHaveProperty('template');
    expect(save.sketches[0]).toMatchObject({ type: 'massage', ...AT, w: 4, h: 4 });
  });

  it('forget a room of another kind or size than its sketch', () => {
    const save = saved();
    const sketch = save.sketches[0]!;
    if (sketch.layout) sketch.layout.w = 5;
    upgradeSave(save);
    expect(save.sketches[0]).not.toHaveProperty('layout');
  });
});

describe('what the interface says about a sketch that remembers a room', () => {
  it('labels it with its template, and its panel says what it holds', () => {
    const { sim, sketch } = pencilled();
    const fit = sim.world.sketchFit(sketch);
    expect(sketchTag(sketch, fit)).toBe('from "Cozy 4×4" · pencilled in');
    expect(remembers(COZY)).toBe(
      `Remembers a Massage Table, an ${ITEMS.oil_trolley.name}, a ${ITEMS.plant.name} and 2 windows. Built whole when you build it.`,
    );
    expect(sketchNote(sketch, sim.s)).toMatch(
      /^Remembers a Massage Table, .* Built whole when you build it\. Pencilled in on Day \d+\. Needs a Massage Therapist once it opens\.$/,
    );
    expect(ITEMS.massage_table.name).toBe('Massage Table');
  });

  it('counts furniture there is more than one of, and leaves out certificates', () => {
    const two = {
      ...COZY,
      windows: [],
      items: [
        ...COZY.items,
        { type: 'plant' as ItemType, x: 0, y: 3, rot: 0 },
        { type: 'certificate' as ItemType, x: 0, y: 0, rot: 0 },
      ],
    };
    expect(remembers(two)).toBe(
      `Remembers a Massage Table, an ${ITEMS.oil_trolley.name} and 2 ${ITEMS.plant.name}s. Built whole when you build it.`,
    );
  });
});

describe('the Plans overlay', () => {
  /** Three sketches: a Consultation Room that fits, a Staff Room with a plant in its doorway, and the suite. */
  function threePlans() {
    const sim = freshSim();
    sim.s.money = 100_000;
    const consult = sim.addSketch('consult', { x: 20, y: 13, w: 4, h: 4 }, { x: 21, y: 13, dx: 0, dy: -1 });
    const staff = sim.addSketch('staffroom', { x: 16, y: 13, w: 3, h: 3 }, { x: 17, y: 13, dx: 0, dy: -1 });
    sim.placeItem('plant', 17, 12, 0, { free: true });
    const suite = sim.pencilTemplate('Cozy 4×4', COZY, placeLayout(COZY, AT.x, AT.y));
    if (!consult || !staff || !suite) throw new Error('could not pencil them in');
    return { sim, consult, staff, suite };
  }

  it('is listed last in the picker, and colors no tiles', () => {
    const sim = freshSim();
    expect(OVERLAYS.at(-1)).toMatchObject({ id: 'plans', name: 'Plans', icon: 'overlay-plans' });
    expect(heatTiles(sim, 'plans')).toEqual([]);
    expect(colorsFloor('plans')).toBe(false);
    expect(colorsFloor('decor')).toBe(true);
    expect(colorsFloor('patience')).toBe(false);
  });

  it('counts the sketches, what building them all costs, and how many no longer fit', () => {
    const { sim } = threePlans();
    const total = sketchesCost(sim.s);
    expect(total).toBe(roomCost('consult', { w: 4, h: 4 }) + roomCost('staffroom', { w: 3, h: 3 }) + copyCost(COZY));
    expect(plansLine(sim.world)).toBe(`3 pencilled in · ${money(total)} to build them all. One no longer fits.`);
    expect(plansLine(freshSim().world)).toBe('Nothing pencilled in yet. Pencil rooms in from the Rooms menu.');
  });

  it('lists each with its size or template, day, fit and price', () => {
    const { sim, staff, suite } = threePlans();
    const day = `Day ${Math.floor(sim.s.day) + 1}`;
    expect(planRows(sim.world).map(({ name, sub, chip, unfit, price }) => ({ name, sub, chip, unfit, price }))).toEqual(
      [
        {
          name: 'Consultation Room',
          sub: `4×4 · ${day}`,
          chip: '✔ fits',
          unfit: false,
          price: money(roomCost('consult', { w: 4, h: 4 })),
        },
        {
          name: 'Staff Room',
          sub: `3×3 · ${day}`,
          chip: '⚠ doorway',
          unfit: true,
          price: money(roomCost('staffroom', { w: 3, h: 3 })),
        },
        { name: 'Massage Suite', sub: `Cozy 4×4 · ${day}`, chip: '✔ fits', unfit: false, price: money(copyCost(COZY)) },
      ],
    );
    expect(plansTag(staff, sim.world.sketchFit(staff))).toBe('⚠ doorway blocked');
    expect(plansTag(suite, sim.world.sketchFit(suite))).toBe(`${money(copyCost(COZY))} · from "Cozy 4×4"`);
  });

  it('labels a plain sketch with its price and fit, and one waiting for land as waiting', () => {
    const { sim, consult } = threePlans();
    expect(plansTag(consult, sim.world.sketchFit(consult))).toBe(`${money(roomCost('consult', consult))} · fits`);
    const plot = sim.addSketch('consult', { x: 29, y: 5, w: 4, h: 4 }, { x: 29, y: 6, dx: -1, dy: 0 });
    if (!plot) throw new Error('could not pencil it in on the plot');
    expect(plansTag(plot, sim.world.sketchFit(plot))).toBe(`${money(roomCost('consult', plot))} · waits for its land`);
    expect(planRows(sim.world).at(-1)?.chip).toBe('⌛ waits');
  });

  it('drops a sketch from the list once built from it', () => {
    const { sim, suite } = threePlans();
    const { tools } = toolsFor(sim);
    tools.buildSketch(suite.id);
    expect(planRows(sim.world).map((r) => r.name)).toEqual(['Consultation Room', 'Staff Room']);
  });
});
