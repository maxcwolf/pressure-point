// Things hung on walls: where they can hang, what keeps out of their way, how they move with their room, and what
// each of them does.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHART_BONUS,
  CLOCK_BREAK_BOOST,
  CLOCK_DRAIN,
  ITEM_MENU,
  ITEMS,
  type ItemType,
  MISHAPS,
  POSTER_MORALE,
  TV_CALM,
} from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { resizeCost } from '../../src/core/resize';
import { placeLayout, turnLayout } from '../../src/core/room-layout';
import { decorOf } from '../../src/core/sim/ambience';
import { createContext } from '../../src/core/sim/context';
import { breakBoost, moraleTarget } from '../../src/core/sim/staffing';
import { chartBonus, wallDrain } from '../../src/core/sim/wall-items';
import type { Guest, Item, WallSpot } from '../../src/core/state/types';
import { layoutProblem } from '../../src/core/templates';
import { rotFacing, wallSpotsOf, Z_CORRIDOR } from '../../src/core/world';
import {
  addReiki,
  addStaffRoom,
  buildRoom,
  freshSim,
  hire,
  inconsistencies,
  openCenter,
  run,
  runUntil,
  toasts,
} from './helpers';

const HUNG: ItemType[] = ['motivational_poster', 'landscape_painting', 'wall_clock'];

// The sandbox building runs from 3,3 to 27,17, its windows two tiles wide along each wall with two tiles of wall
// between, and its front door at 14,17.
/** A stretch of the building's back wall, clear of its windows. */
const BACK_WALL = { x: 6, y: 3, rot: 0 };
/** One of the building's windows in the back wall. */
const BACK_WINDOW = { x: 4, y: 3, rot: 0 };

beforeEach(() => setSeed(3));

/** Hang something, for free, or say why it could not be hung. */
function hang(sim: ReturnType<typeof freshSim>, type: ItemType, at: { x: number; y: number; rot: number }) {
  return sim.world.canPlaceItem(type, at.x, at.y, at.rot).reason || sim.placeItem(type, at.x, at.y, at.rot);
}

describe('things hung on walls', () => {
  it('are in the Items menu, open from the start, and hang on a wall', () => {
    for (const type of HUNG) {
      expect(ITEM_MENU).toContain(type);
      expect(ITEMS[type].mount).toBe('wall');
      expect(ITEMS[type].unlock ?? 0).toBe(0);
    }
  });

  it('face out from the wall they hang on', () => {
    expect([
      rotFacing({ dx: 0, dy: -1 }),
      rotFacing({ dx: 1, dy: 0 }),
      rotFacing({ dx: 0, dy: 1 }),
      rotFacing({ dx: -1, dy: 0 }),
    ]).toEqual([0, 1, 2, 3]);
    for (const rot of [0, 1, 2, 3]) {
      const [spot] = wallSpotsOf({ type: 'wall_clock', x: 5, y: 5, rot });
      expect(spot && rotFacing(spot)).toBe(rot);
    }
  });

  it("hang on the building's outer wall in a corridor, in nobody's way", () => {
    const sim = freshSim();
    const clock = hang(sim, 'wall_clock', BACK_WALL);
    expect(clock).toMatchObject({ type: 'wall_clock', x: 6, y: 3 });
    expect(sim.world.walkable(6, 3)).toBe(true);
    expect(sim.world.blocked[sim.world.idx(6, 3)]).toBe(0);
    expect(sim.world.reserved[sim.world.idx(6, 3)]).toBe(0);
    // furniture can still stand on the floor in front of it
    expect(sim.placeItem('plant', 6, 3, 0)).toBeTruthy();
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('only hang where there is a free stretch of wall', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    addStaffRoom(sim);
    expect(hang(sim, 'wall_clock', BACK_WINDOW)).toBe('There is a window there');
    expect(hang(sim, 'wall_clock', { x: 10, y: 10, rot: 0 })).toBe('Hang it on a wall');
    // facing the wall rather than out from it
    expect(hang(sim, 'wall_clock', { ...BACK_WALL, rot: 2 })).toBe('Hang it on a wall');
    // the corridor side of a room's wall, which is never seen standing tall
    expect(hang(sim, 'wall_clock', { x: 17, y: 4, rot: 2 })).toBe(
      "Hang it inside the room, or on the building's outer wall",
    );
    // beside the front door, where its pillars are
    expect(hang(sim, 'wall_clock', { x: 13, y: 17, rot: 2 })).toBe('Too close to the entrance');
    expect(hang(sim, 'wall_clock', { x: 17, y: 17, rot: 2 })).toMatchObject({ type: 'wall_clock' });
    expect(hang(sim, 'wall_clock', BACK_WALL)).toMatchObject({ type: 'wall_clock' });
    expect(hang(sim, 'landscape_painting', BACK_WALL)).toBe('The Wall Clock hangs there');
    // the poster belongs in a Staff Room
    expect(hang(sim, 'motivational_poster', { x: 7, y: 3, rot: 0 })).toBe('Goes inside a Staff Room');
    expect(hang(sim, 'motivational_poster', { x: 17, y: 5, rot: 0 })).toMatchObject({ type: 'motivational_poster' });
  });

  it('cost what they cost, and sell back at half', () => {
    const sim = freshSim();
    const money = sim.s.money;
    const painting = sim.placeItem('landscape_painting', BACK_WALL.x, BACK_WALL.y, BACK_WALL.rot);
    expect(sim.s.money).toBe(money - 400);
    sim.sellItem(painting?.id ?? 0);
    expect(sim.s.money).toBe(money - 200);
    expect(sim.s.items.some((it) => it.type === 'landscape_painting')).toBe(false);
  });

  it("keep the building's own window from coming back over them when a room goes", () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    // a room along the back wall over half of the window at 4-5 leaves the other half free to hang something on
    const room = buildRoom(sim, 'staffroom', { x: 5, y: 3, w: 3, h: 3 }, { x: 6, y: 5, dx: 0, dy: 1 }, [
      ['sofa', 5, 3],
    ]);
    expect(sim.world.buildingWindows().some((w) => w.side === 'north' && w.a === 4)).toBe(false);
    expect(hang(sim, 'wall_clock', BACK_WINDOW)).toMatchObject({ type: 'wall_clock' });
    sim.removeRoom(room.id, 0.5);
    expect(sim.world.buildingWindows().some((w) => w.side === 'north' && w.a === 4)).toBe(false);
    expect(sim.world.buildingWindows().some((w) => w.side === 'north' && w.a === 8)).toBe(true);
  });

  it('keep rooms off them in a corridor', () => {
    const sim = freshSim();
    hang(sim, 'wall_clock', BACK_WALL);
    expect(sim.world.roomRectValid('staffroom', { x: 5, y: 3, w: 3, h: 3 }).reason).toBe(
      'Take the Wall Clock down first',
    );
    expect(sim.world.roomRectValid('staffroom', { x: 7, y: 3, w: 3, h: 3 }).ok).toBe(true);
  });

  it('keep windows and doors off them in a room, and go when it is demolished', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const room = addStaffRoom(sim);
    const poster = hang(sim, 'motivational_poster', { x: 19, y: 6, rot: 1 }) as Item;
    const spot: WallSpot = { x: 19, y: 6, dx: 1, dy: 0 };
    expect(sim.world.windowValid(room, spot).reason).toBe('Take the Motivational Poster down first');
    expect(sim.toggleWindow(room.id, spot)).toBe('');
    expect(sim.world.doorValid(room.type, room, spot, room).reason).toBe('Take the Motivational Poster down first');
    expect(sim.moveDoor(room.id, spot)).toBe(false);
    // and the other way about: nothing hangs where the door or a window is
    expect(hang(sim, 'wall_clock', { x: 18, y: 7, rot: 2 })).toBe('The door is there');
    expect(sim.toggleWindow(room.id, { x: 19, y: 5, dx: 0, dy: -1 })).toBe('added');
    expect(hang(sim, 'wall_clock', { x: 19, y: 5, rot: 0 })).toBe('There is a window there');
    sim.removeRoom(room.id, 0.5);
    expect(sim.world.item(poster.id)).toBeUndefined();
  });

  it('move along with the walls of a room being resized, and are sold if their wall is gone', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const room = addStaffRoom(sim);
    const back = hang(sim, 'wall_clock', { x: 18, y: 5, rot: 0 }) as Item;
    const side = hang(sim, 'landscape_painting', { x: 19, y: 6, rot: 1 }) as Item;
    // the back and east walls move out a tile, taking the clock and the painting with them
    expect(sim.resizeRoom(room.id, { x: 17, y: 4, w: 4, h: 4 })).toBe(true);
    expect([back.x, back.y, side.x, side.y]).toEqual([18, 4, 20, 6]);
    const corner = hang(sim, 'landscape_painting', { x: 20, y: 4, rot: 0 }) as Item;
    // the east wall moves back in: the painting on it goes with it, and the one at the end of the back wall has no
    // wall left
    sim.drain();
    const money = sim.s.money;
    const refund = -resizeCost(room, { x: 17, y: 4, w: 3, h: 4 });
    expect(sim.resizeRoom(room.id, { x: 17, y: 4, w: 3, h: 4 })).toBe(true);
    expect([back.x, back.y, side.x, side.y]).toEqual([18, 4, 19, 6]);
    expect(sim.world.item(corner.id)).toBeUndefined();
    expect(toasts(sim.drain())).toContain(
      'The Landscape Painting had no wall left to hang on, so it was sold for $200.',
    );
    expect(sim.s.money).toBe(money + 200 + refund);
    for (const it of [back, side]) for (const w of wallSpotsOf(it)) expect(sim.world.wallFace(w).ok).toBe(true);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('move and turn with their room', () => {
    const { sim, massage } = openCenter(2);
    const clock = hang(sim, 'wall_clock', { x: 13, y: 5, rot: 0 }) as Item;
    expect(sim.world.zoneAt(clock.x, clock.y)).toBe(massage.id);
    const turned = turnLayout(sim.roomLayout(massage));
    expect(sim.moveRoom(massage.id, placeLayout(turned, 17, 5))).toBe(true);
    const [spot] = wallSpotsOf(clock);
    if (!spot) throw new Error('no spot');
    expect(sim.world.zoneAt(spot.x, spot.y)).toBe(massage.id);
    expect(sim.world.zoneAt(spot.x + spot.dx, spot.y + spot.dy)).not.toBe(massage.id);
    expect(sim.world.wallFace(spot).ok).toBe(true);
    // it was on the back wall facing south; turned a quarter, it is on the east wall facing west
    expect(clock.rot).toBe(1);
    expect(spot.dx).toBe(1);
  });

  it('are kept in a template only on its own free walls', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const room = addStaffRoom(sim);
    hang(sim, 'motivational_poster', { x: 17, y: 5, rot: 0 });
    const layout = sim.roomLayout(room);
    expect(layoutProblem(layout)).toBe('');
    const poster = { type: 'motivational_poster' as const, x: 1, y: 1, rot: 0 };
    expect(layoutProblem({ ...layout, items: [...layout.items, poster] })).toBe(
      'The Motivational Poster is not on a free stretch of wall',
    );
    const onDoor = { ...poster, x: layout.door.x, y: layout.door.y, rot: 2 };
    expect(layoutProblem({ ...layout, items: [...layout.items, onDoor] })).toBe(
      'The Motivational Poster is not on a free stretch of wall',
    );
    for (let turn = 0, l = layout; turn < 4; turn++, l = turnLayout(l)) expect(layoutProblem(l)).toBe('');
  });

  it('come down and are sold when the building grows over their wall', () => {
    const { sim, s } = openCenter(2);
    s.money = 50_000;
    // the east wall, which the east wing will take down
    const clock = hang(sim, 'wall_clock', { x: 27, y: 7, rot: 1 }) as Item;
    expect(clock).toMatchObject({ type: 'wall_clock' });
    expect(sim.buyPlot('east-wing')).toBe(true);
    for (const l of s.land) if (l.ready !== undefined) l.ready = s.day;
    sim.drain();
    const money = s.money;
    run(sim, 1.1);
    expect(sim.world.item(clock.id)).toBeUndefined();
    expect(toasts(sim.drain())).toContain('The Wall Clock had no wall left to hang on, so it was sold for $75.');
    expect(s.money).toBeGreaterThanOrEqual(money + 75 - 50);
  });
});

describe('the first things to hang', () => {
  it('lift the staff with posters in the Staff Room, from up to two', () => {
    const { sim, s } = openCenter(2);
    addStaffRoom(sim);
    const st = hire(sim, 'caretaker');
    /** The morale the caretaker settles toward. */
    const morale = () => moraleTarget(createContext(s), st);
    const before = morale();
    for (const x of [17, 18, 19]) hang(sim, 'motivational_poster', { x, y: 5, rot: 0 });
    expect(s.items.filter((it) => it.type === 'motivational_poster')).toHaveLength(3);
    expect(morale() - before).toBeCloseTo(2 * POSTER_MORALE);
  });

  it('add decor to the corridor in front of a painting', () => {
    const sim = freshSim();
    sim.refreshAmbience();
    const before = sim.drainFactor(6, 4);
    hang(sim, 'landscape_painting', BACK_WALL);
    sim.refreshAmbience();
    // patience drains slower in pleasant surroundings
    expect(sim.drainFactor(6, 4)).toBeLessThan(before);
  });

  it('hurry staff off a break, and guests in sight of the clock lose patience faster', () => {
    const { sim, s } = openCenter(2);
    const room = addStaffRoom(sim);
    const st = hire(sim, 'caretaker');
    const sofa = s.items.find((it) => it.type === 'sofa');
    st.claimItem = sofa?.id ?? 0;
    /** How much faster the caretaker gets their energy back on a break. */
    const boost = () => breakBoost(createContext(s), st);
    const rested = boost();
    hang(sim, 'wall_clock', { x: 19, y: 5, rot: 0 });
    expect(sim.world.zoneAt(19, 5)).toBe(room.id);
    expect(boost()).toBeCloseTo(rested * CLOCK_BREAK_BOOST);

    const guest = { tx: 8, ty: 4, x: 8.5, y: 4.5 } as Guest;
    expect(wallDrain(createContext(s), guest)).toBe(1);
    hang(sim, 'wall_clock', BACK_WALL);
    expect(sim.world.zoneAt(8, 4)).toBe(Z_CORRIDOR);
    expect(wallDrain(createContext(s), guest)).toBe(CLOCK_DRAIN);
    expect(wallDrain(createContext(s), { tx: 20, ty: 14, x: 20.5, y: 14.5 } as Guest)).toBe(1);
  });
});

describe('the rest of the things to hang', () => {
  it('help treatments in their rooms with a chart, from one, in either of its rooms', () => {
    const { sim, s, massage } = openCenter(2);
    sim.s.stars = 3;
    const reiki = addReiki(sim);
    const table = s.items.find((it) => it.type === 'reiki_table')!;
    const bed = s.items.find((it) => it.type === 'massage_table')!;
    expect(chartBonus(createContext(s), table)).toBe(0);
    expect(hang(sim, 'chakra_chart', { x: 26, y: 13, rot: 0 })).toMatchObject({ type: 'chakra_chart' });
    expect(hang(sim, 'chakra_chart', { x: 27, y: 13, rot: 0 })).toMatchObject({ type: 'chakra_chart' });
    expect(chartBonus(createContext(s), table)).toBe(CHART_BONUS);
    expect(sim.world.zoneAt(26, 13)).toBe(reiki.id);
    // a chakra chart is for Reiki and the Sound Bath, and a meridian poster for acupuncture and massage
    expect(hang(sim, 'chakra_chart', { x: 13, y: 5, rot: 0 })).toBe(
      'Goes inside a Reiki Studio or a Sound Bath Studio',
    );
    expect(hang(sim, 'meridian_poster', { x: 13, y: 5, rot: 0 })).toMatchObject({ type: 'meridian_poster' });
    expect(sim.world.zoneAt(13, 5)).toBe(massage.id);
    expect(chartBonus(createContext(s), bed)).toBe(CHART_BONUS);
  });

  it('calm the wait with a television, which a power cut stops, as the freeze stops a wall fountain', () => {
    const { sim, s } = openCenter(2);
    sim.s.stars = 3;
    const guest = { tx: 8, ty: 4, x: 8.5, y: 4.5 } as Guest;
    expect(hang(sim, 'television', BACK_WALL)).toMatchObject({ type: 'television' });
    expect(wallDrain(createContext(s), guest)).toBe(TV_CALM);
    expect(wallDrain(createContext(s), { tx: 20, ty: 14, x: 20.5, y: 14.5 } as Guest)).toBe(1);
    expect(MISHAPS.power.stops).toContain('television');
    expect(MISHAPS.freeze.stops).toContain('wall_fountain');
    expect(hang(sim, 'television', { x: 13, y: 5, rot: 0 })).toBe('Goes in a corridor, not a room');
  });

  it('hang two tiles wide only on a straight free stretch of one wall', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    sim.s.stars = 3;
    addStaffRoom(sim);
    // the back wall from 6 to 7 is clear; 8 has one of the building's windows
    expect(hang(sim, 'tapestry', { x: 7, y: 3, rot: 0 })).toBe('There is a window there');
    expect(sim.world.nearestWall('tapestry', 7, 3.1)).toEqual({ x: 6, y: 3, rot: 0 });
    const tapestry = hang(sim, 'tapestry', { x: 6, y: 3, rot: 0 }) as Item;
    expect(wallSpotsOf(tapestry)).toEqual([
      { x: 6, y: 3, dx: 0, dy: -1 },
      { x: 7, y: 3, dx: 0, dy: -1 },
    ]);
    expect(hang(sim, 'wall_clock', { x: 7, y: 3, rot: 0 })).toBe('The Tapestry hangs there');
    // off the end of the Staff Room's back wall, where there is no wall
    expect(hang(sim, 'prayer_flags', { x: 19, y: 5, rot: 0 })).toBe('Hang it on a wall');
    expect(hang(sim, 'prayer_flags', { x: 18, y: 5, rot: 0 })).toMatchObject({ type: 'prayer_flags' });
  });

  it('need watering when living, and drag their surroundings down left dry', () => {
    const { sim, s } = openCenter(2);
    sim.s.stars = 3;
    const wall = hang(sim, 'living_wall', BACK_WALL) as Item;
    expect(decorOf(wall)).toBe(5);
    wall.water = 10;
    expect(decorOf(wall)).toBe(-1);
    hire(sim, 'caretaker');
    runUntil(sim, () => wall.water > 90, 300);
    expect(s.items).toContain(wall);
  });
});
