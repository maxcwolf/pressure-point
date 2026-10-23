// Room templates: rooms kept under a name to build again, in this game or any other, and written to files.
import { describe, expect, it } from 'vitest';

import { typingIn } from '../../src/app/keyboard';
import { templateHint } from '../../src/app/tools/hints';
import { Tools } from '../../src/app/tools/tools';
import { DISCIPLINES, ITEMS, ROOMS } from '../../src/core/data';
import { money } from '../../src/core/format';
import { copyCost, type Layout, placeLayout, turnLayout } from '../../src/core/room-layout';
import { itemsInRoom } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import {
  addTemplate,
  describeLayout,
  freshName,
  layoutProblem,
  MAX_NAME,
  MAX_TEMPLATES,
  mergeTemplates,
  readLayout,
  readTemplates,
  readTemplatesFile,
  renameTemplate,
  type Template,
  TEMPLATE_FORMAT,
  templateFilename,
  templateLock,
  templatesFile,
  uniqueName,
} from '../../src/core/templates';
import type { View } from '../../src/render/view';
import {
  addAcupuncture,
  addPostureLab,
  addReiki,
  addRestroom,
  addSound,
  addStaffRoom,
  addTraining,
  inconsistencies,
  openCenter,
  toasts,
} from './helpers';

/** A 4×3 Massage Suite with its door on the bottom wall, a window on the left, and a table and trolley. */
const SUITE: Layout = {
  type: 'massage',
  w: 4,
  h: 3,
  door: { x: 1, y: 2, dx: 0, dy: 1 },
  windows: [{ x: 0, y: 1, dx: -1, dy: 0 }],
  items: [
    { type: 'massage_table', x: 1, y: 0, rot: 0 },
    { type: 'oil_trolley', x: 3, y: 0, rot: 0 },
  ],
};

/** Floor in the standard test center that nothing is built on: where the Staff Room and Restroom would go. */
const FREE = { x: 17, y: 5 };

/** Everything open: every star, every discipline. */
const ALL_OPEN = {
  upTo: Infinity,
  unlocked: [],
  /** Every discipline is on. */
  enabled: () => true,
};

describe('checking a layout', () => {
  it('passes the rooms the game builds, of every kind, turned every way', () => {
    const { sim, consult, massage } = openCenter(1);
    const rooms = [
      consult,
      massage,
      addStaffRoom(sim),
      addRestroom(sim),
      addTraining(sim),
      addPostureLab(sim),
      addAcupuncture(sim),
      addReiki(sim),
      addSound(sim),
    ];
    for (const room of rooms) {
      let layout = sim.roomLayout(room);
      for (let turn = 0; turn < 4; turn++) {
        expect(layoutProblem(layout), `${room.type}, turned ${turn} times`).toBe('');
        layout = turnLayout(layout);
      }
    }
  });

  it('finds a room too small, a door or window off the wall, and a window doubled', () => {
    expect(layoutProblem({ ...SUITE, w: 2, h: 2, items: [] })).toBe('Too small');
    expect(layoutProblem({ ...SUITE, door: { x: 1, y: 1, dx: 0, dy: 1 } })).toBe('The door is not in a wall');
    expect(layoutProblem({ ...SUITE, windows: [{ x: 2, y: 1, dx: 1, dy: 0 }] })).toBe('A window is misplaced');
    expect(layoutProblem({ ...SUITE, windows: [SUITE.door] })).toBe('A window is misplaced');
  });

  it('finds furniture that does not belong, does not fit, overlaps, or is in the way', () => {
    const table = SUITE.items[0]!;
    const trolley = SUITE.items[1]!;
    expect(layoutProblem({ ...SUITE, items: [...SUITE.items, { type: 'toilet', x: 0, y: 0, rot: 0 }] })).toBe(
      `The ${ITEMS.toilet.name} does not go in a Massage Suite`,
    );
    expect(layoutProblem({ ...SUITE, items: [table, { ...trolley, x: 4 }] })).toBe(
      `The ${ITEMS.oil_trolley.name} does not fit inside`,
    );
    expect(layoutProblem({ ...SUITE, items: [table, { ...trolley, x: 1 }] })).toBe('Furniture overlaps');
    // in the doorway
    expect(layoutProblem({ ...SUITE, items: [table, { ...trolley, x: 1, y: 2 }] })).toContain('in the way');
  });

  it('lets a rug lie under furniture, but not on another rug', () => {
    const rug = Object.values(ITEMS).find((d) => d.walkable && (d.where === 'any' || d.where === 'massage'))!;
    const under = { ...SUITE, items: [...SUITE.items, { type: rug.type, x: 0, y: 0, rot: 0 }] };
    expect(layoutProblem(under)).toBe('');
    expect(layoutProblem({ ...under, items: [...under.items, { type: rug.type, x: 0, y: 0, rot: 0 }] })).toBe(
      'Furniture overlaps',
    );
  });

  it('needs everything the room requires', () => {
    expect(layoutProblem({ ...SUITE, items: [SUITE.items[1]!] })).toBe(
      `It needs a ${ITEMS[ROOMS.massage.required[0]!].name}`,
    );
  });
});

describe('reading a layout from a file', () => {
  it('reads back a layout written out', () => {
    expect(readLayout(JSON.parse(JSON.stringify(SUITE)))).toEqual(SUITE);
  });

  it('reads a Recliner saved before it was renamed as the Lounger', () => {
    const lounge = { ...SUITE, type: 'recovery', items: [{ type: 'recliner', x: 1, y: 0, rot: 0 }] };
    expect(readLayout(lounge)?.items).toEqual([{ type: 'lounger', x: 1, y: 0, rot: 0 }]);
  });

  it('refuses anything that is not a buildable layout', () => {
    for (const bad of [
      null,
      'massage',
      { ...SUITE, type: 'casino' },
      { ...SUITE, w: 0 },
      { ...SUITE, w: 2.5 },
      { ...SUITE, door: { x: 1, y: 2, dx: 1, dy: 1 } },
      { ...SUITE, windows: 'none' },
      { ...SUITE, items: [{ type: 'jacuzzi', x: 0, y: 0, rot: 0 }] },
      { ...SUITE, items: [{ ...SUITE.items[0], rot: 4 }] },
      { ...SUITE, items: [{ ...SUITE.items[0], x: -1 }] },
    ])
      expect(readLayout(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('naming templates', () => {
  it('names a new template after its room, numbered after the first', () => {
    expect(freshName('massage', [])).toBe('Massage Suite');
    expect(freshName('massage', ['Massage Suite'])).toBe('Massage Suite 2');
    expect(freshName('massage', ['Massage Suite', 'Massage Suite 2'])).toBe('Massage Suite 3');
  });

  it('tidies a name, keeps it short, and never leaves it empty', () => {
    expect(uniqueName('  Big   corner  suite ', [])).toBe('Big corner suite');
    expect(uniqueName('   ', [])).toBe('Room');
    const long = 'x'.repeat(50);
    expect(uniqueName(long, [])).toHaveLength(MAX_NAME);
    expect(uniqueName(long, ['x'.repeat(MAX_NAME)])).toHaveLength(MAX_NAME);
    expect(uniqueName(long, ['x'.repeat(MAX_NAME)]).endsWith(' 2')).toBe(true);
  });

  it('adds templates with ids of their own, and renames one without taking another name', () => {
    let list: Template[] = [];
    list = addTemplate(list, 'Suite', SUITE);
    list = addTemplate(list, 'Suite', SUITE);
    expect(list.map((t) => [t.id, t.name])).toEqual([
      [1, 'Suite'],
      [2, 'Suite 2'],
    ]);
    expect(renameTemplate(list, 2, 'Suite').map((t) => t.name)).toEqual(['Suite', 'Suite 2']);
    expect(renameTemplate(list, 2, 'Corner').map((t) => t.name)).toEqual(['Suite', 'Corner']);
    // renaming to its own name keeps it
    expect(renameTemplate(list, 1, 'Suite').map((t) => t.name)).toEqual(['Suite', 'Suite 2']);
  });
});

describe('template files', () => {
  it('writes templates out and reads them back', () => {
    const list = addTemplate(addTemplate([], 'Suite', SUITE), 'Turned', turnLayout(SUITE));
    const back = readTemplatesFile(templatesFile(list));
    expect(back).toEqual(list);
  });

  it('refuses a file that is not a templates file, and skips templates in it that make no sense', () => {
    expect(readTemplatesFile('not json')).toBeNull();
    expect(readTemplatesFile(JSON.stringify({ format: 'pressure-point-save', templates: [] }))).toBeNull();
    const file = JSON.stringify({
      format: TEMPLATE_FORMAT,
      templates: [{ name: 'Good', layout: SUITE }, { name: 'Bad', layout: { ...SUITE, w: 0 } }, { layout: SUITE }],
    });
    expect(readTemplatesFile(file)?.map((t) => t.name)).toEqual(['Good']);
  });

  it('keeps no more templates than there is room for', () => {
    const many = Array.from({ length: MAX_TEMPLATES + 5 }, (_, i) => ({ name: `T${i}`, layout: SUITE }));
    expect(readTemplates(many)).toHaveLength(MAX_TEMPLATES);
    const full = readTemplates(many);
    expect(mergeTemplates(full, addTemplate([], 'More', SUITE))).toHaveLength(MAX_TEMPLATES);
  });

  it('adds imported templates after the ones there, under names of their own', () => {
    const mine = addTemplate([], 'Suite', SUITE);
    const merged = mergeTemplates(mine, addTemplate(addTemplate([], 'Suite', SUITE), 'Other', SUITE));
    expect(merged.map((t) => [t.id, t.name])).toEqual([
      [1, 'Suite'],
      [2, 'Suite 2'],
      [3, 'Other'],
    ]);
  });

  it('names files after a template, or for all of them', () => {
    expect(templateFilename('Big Corner Suite!')).toBe('pressure-point-room-big-corner-suite.json');
    expect(templateFilename('???')).toBe('pressure-point-room-templates.json');
    expect(templateFilename()).toBe('pressure-point-room-templates.json');
  });
});

describe('describing a template', () => {
  it('gives its room, size and furniture, and its windows if it has any', () => {
    expect(describeLayout(SUITE)).toBe('Massage Suite, 4×3, 2 items, 1 window');
    expect(describeLayout({ ...SUITE, windows: [], items: [SUITE.items[0]!] })).toBe('Massage Suite, 4×3, 1 item');
  });
});

describe('a template that no longer passes', () => {
  it('is kept, rather than lost the next time the templates are stored, and says why it cannot be built', () => {
    // well formed, but with no table: as a template saved before a room came to need something would be
    const tableless = { ...SUITE, items: [SUITE.items[1]!] };
    const kept = readTemplates([{ name: 'Old suite', layout: tableless }]);
    expect(kept.map((t) => t.name)).toEqual(['Old suite']);
    expect(templateLock(tableless, ALL_OPEN)).toBe(`It needs a ${ITEMS[ROOMS.massage.required[0]!].name}`);
  });

  it('is not built, even if asked', () => {
    const { sim, s } = openCenter(10);
    const tableless = { ...SUITE, items: [SUITE.items[1]!] };
    const rooms = s.rooms.length;
    expect(sim.buildTemplate('Old suite', tableless, placeLayout(tableless, FREE.x, FREE.y))).toBeNull();
    expect(s.rooms).toHaveLength(rooms);
  });
});

describe('what a game lets a template build', () => {
  it('builds anything once everything is open', () => {
    expect(templateLock(SUITE, ALL_OPEN)).toBe('');
  });

  it('says when the room is locked or switched off, or some of its furniture is locked', () => {
    const { sim } = openCenter(11);
    const studio = sim.roomLayout(addSound(sim));
    expect(templateLock(studio, { ...ALL_OPEN, upTo: 0 })).toBe(
      `The Sound Bath Studio unlocks at star ${ROOMS.sound.unlock}`,
    );
    /** Every discipline is off. */
    const off = () => false;
    expect(templateLock(studio, { ...ALL_OPEN, enabled: off })).toBe(`${DISCIPLINES.sound.name} is switched off`);
    // something small locked until a later star, in the suite's free corner
    const locked = Object.values(ITEMS).find(
      (d) => d.where === 'any' && (d.unlock ?? 0) > 0 && d.w === 1 && d.h === 1 && !d.walkable,
    )!;
    const decorated: Layout = { ...SUITE, items: [...SUITE.items, { type: locked.type, x: 0, y: 0, rot: 0 }] };
    expect(templateLock(decorated, { ...ALL_OPEN, upTo: 0 })).toBe(`The ${locked.name} is still locked`);
    expect(templateLock(decorated, { ...ALL_OPEN, upTo: 0, unlocked: [locked.type] })).toBe('');
  });
});

describe('building from a template', () => {
  it('builds a finished room with new furniture, for what building it would cost, and says so', () => {
    const { sim, s, massage } = openCenter(7);
    sim.toggleWindow(massage.id, { x: 11, y: 6, dx: -1, dy: 0 });
    const layout = turnLayout(sim.roomLayout(massage));
    const before = s.money;
    const room = sim.buildTemplate('Corner suite', layout, placeLayout(layout, FREE.x, FREE.y))!;
    expect(room).toMatchObject({ type: 'massage', done: true, x: FREE.x, y: FREE.y });
    expect(room.windows).toHaveLength(1);
    expect(sim.missingItems(room)).toEqual([]);
    expect(itemsInRoom(createContext(s), room)).toHaveLength(2);
    expect(s.money).toBe(before - copyCost(layout));
    expect(toasts(sim.drain())).toContain(`"Corner suite" built for ${money(copyCost(layout))}.`);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('builds nothing where the room cannot go or without the money', () => {
    const { sim, s, consult } = openCenter(8);
    expect(sim.buildTemplate('Suite', SUITE, placeLayout(SUITE, consult.x, consult.y))).toBeNull();
    s.money = 100;
    const rooms = s.rooms.length;
    sim.drain();
    expect(sim.buildTemplate('Suite', SUITE, placeLayout(SUITE, FREE.x, FREE.y))).toBeNull();
    expect(toasts(sim.drain())).toContain(`"Suite" costs ${money(copyCost(SUITE))}. You can't afford it.`);
    expect(s.rooms).toHaveLength(rooms);
  });

  it('keeps building from the template in hand until put away, turned with R', () => {
    const { sim, s } = openCenter(9);
    /** Ignore a call to the scene. */
    const nothing = () => undefined;
    const view = {
      selected: null,
      setOverlay: nothing,
      setMarkers: nothing,
      setGhost: nothing,
      setDoor: nothing,
      nudge: nothing,
    };
    /** The cursor is on the ground wherever the pointer says. */
    const groundAt = (x: number, y: number) => ({ x, y });
    const tools = new Tools(sim, { ...view, groundAt } as unknown as View, nothing, nothing);
    tools.startTemplate('Suite', SUITE);
    expect(tools.hint).toBe(templateHint('Suite', copyCost(SUITE)));
    tools.rotate();
    expect(tools.tool).toMatchObject({ kind: 'template', layout: { w: 3, h: 4 } });
    const rooms = s.rooms.length;
    tools.pointerMove(19, 7);
    expect(tools.problem).toBe('');
    tools.pointerUp(19, 7);
    expect(s.rooms).toHaveLength(rooms + 1);
    expect(s.rooms.at(-1)).toMatchObject({ w: 3, h: 4 });
    expect(tools.tool.kind).toBe('template');
    tools.back();
    expect(tools.tool.kind).toBe('none');
  });

  it('words the hint with the name and price', () => {
    expect(templateHint('Corner suite', 3000)).toContain('Building "Corner suite" · $3,000 each');
  });
});

describe('typing a template name', () => {
  it('keeps the game from taking keys typed into a text field', () => {
    expect(typingIn({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(typingIn({ tagName: 'INPUT' })).toBe(true);
    expect(typingIn({ tagName: 'TEXTAREA' })).toBe(true);
    expect(typingIn({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(typingIn({ tagName: 'BUTTON' })).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});
