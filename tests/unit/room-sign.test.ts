// A room's door and sign: where the sign stands, the threshold across the doorway, what the lamp on the sign shows,
// and what it all costs to draw.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import { footprintOf } from '../../src/core/footprint';
import type { Item, Room, Staff, StaffState, WallSpot } from '../../src/core/state/types';
import { mat } from '../../src/render/models/parts';
import { lampGlow, lampMaterial } from '../../src/render/models/sign-plaque';
import { lampStates } from '../../src/render/room-lamp';
import { roomShape, type WallMaterial } from '../../src/render/room-walls';
import { DOOR_JAMB, H_LOW, H_TALL, PLAQUE_W, THRESHOLD_DEPTH, THRESHOLD_INSET, WALL_T } from '../../src/render/shared';
import { nearSides } from '../../src/render/turn';

/** The sandbox's building, as it starts. */
const BUILDING = footprintOf(SANDBOX_PLOT);

/** A finished room at 10,10, four tiles by three, with its door where it is asked for. */
function room(door: WallSpot, extra: Partial<Room> = {}): Room {
  return {
    id: 1,
    type: 'massage',
    x: 10,
    y: 10,
    w: 4,
    h: 3,
    door,
    windows: [],
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
    ...extra,
  };
}

const NORTH: WallSpot = { x: 11, y: 10, dx: 0, dy: -1 };
const SOUTH: WallSpot = { x: 11, y: 12, dx: 0, dy: 1 };

describe("a room's sign", () => {
  it('stands on top of the door frame in a tall wall, over the middle of the doorway', () => {
    const { doorway } = roomShape(room(NORTH), BUILDING);
    expect(doorway?.tall).toBe(true);
    expect(doorway?.sign).toEqual({ along: 11.5, base: expect.closeTo(H_TALL + 0.09, 5) as number, post: false });
  });

  it('stands on a post beside the doorway in a wall cut low, clear of the doorway and the corners', () => {
    for (const x of [10, 11, 12, 13]) {
      const { doorway } = roomShape(room({ ...SOUTH, x }), BUILDING);
      const sign = doorway?.sign;
      expect(doorway?.tall).toBe(false);
      expect(sign?.post).toBe(true);
      const a = (sign?.along ?? 0) - PLAQUE_W / 2;
      const b = (sign?.along ?? 0) + PLAQUE_W / 2;
      // over the wall, not the doorway, and short of the walls at either end
      expect(b <= x || a >= x + 1, `door at ${x}: ${a}..${b}`).toBe(true);
      expect(a).toBeGreaterThanOrEqual(10 + WALL_T);
      expect(b).toBeLessThanOrEqual(14 - WALL_T);
      expect(sign?.base).toBeGreaterThan(H_LOW + 0.07);
    }
  });
});

describe("a room's door", () => {
  it('has a raised threshold over the one the floor is painted with, running into the room from its edge', () => {
    for (const [door, edge, inward] of [
      [NORTH, 10, 1],
      [SOUTH, 13, -1],
    ] as const) {
      const { boxes } = roomShape(room(door), BUILDING);
      const sills = boxes.filter((b) => b.material === 'trim' && b.y0 === 0 && b.h < 0.05);
      expect(sills).toHaveLength(1);
      const [sill] = sills;
      expect(sill?.a).toBeCloseTo(11 + THRESHOLD_INSET);
      expect(sill?.b).toBeCloseTo(12 - THRESHOLD_INSET);
      expect(sill?.thick).toBeCloseTo(THRESHOLD_DEPTH);
      expect(sill?.fixed).toBeCloseTo(edge + (inward * THRESHOLD_DEPTH) / 2);
    }
  });

  it('is framed in the trim, a head across a tall wall and only the stubs of its jambs in a low one', () => {
    for (const [door, tall] of [
      [NORTH, true],
      [SOUTH, false],
    ] as const) {
      const { boxes } = roomShape(room(door), BUILDING);
      const frame = boxes.filter((b) => b.material === 'trim' && b.a >= 11 && b.b <= 12 && b.thick > WALL_T);
      const jambs = frame.filter((b) => Math.abs(b.b - b.a - DOOR_JAMB) < 1e-9);
      const heads = frame.filter((b) => Math.abs(b.b - b.a - 1) < 1e-9);
      expect(jambs).toHaveLength(2);
      expect(heads).toHaveLength(tall ? 1 : 0);
      expect(Math.max(...jambs.map((b) => b.y0 + b.h))).toBeCloseTo((tall ? H_TALL : H_LOW) + 0.07);
    }
  });
});

/** A member of staff in a state, at a post. */
const staff = (id: number, post: number, state: StaffState) => ({ id, post, state }) as Staff;
/** An item of a type in the room, or in the corridor, worn as asked. */
const item = (id: number, type: Item['type'], wear = 0, staffId = 0, inRoom = true) =>
  ({ id, type, wear, staffId, x: inRoom ? 11 : 30, y: 11 }) as Item;

/** The lamp states for these rooms, items and staff, every item in the room at 10,10 unless it is at 30. */
function lamps(rooms: Room[], items: Item[], people: Staff[] = []) {
  return lampStates({
    s: { rooms, items },
    world: {
      /** The first room, for anything not out in the corridor. */
      roomOfItem: (it) => (it.x === 30 ? undefined : rooms[0]),
    },
    /** The member of staff with this id. */
    staff: (id) => people.find((p) => p.id === id),
  });
}

describe("a room's lamp", () => {
  const massage = room(NORTH);
  /** The room's massage table, worn and worked as asked. */
  const table = (wear = 0, staffId = 0) => item(1, 'massage_table', wear, staffId);

  it('is grey while the room is unfinished, whatever else is so', () => {
    expect(lamps([{ ...massage, done: false }], [table(100)]).get(1)).toBe('unfinished');
  });

  it('is red when a station or a required item is broken', () => {
    const at = [staff(9, 1, 'atPost')];
    expect(lamps([massage], [table(100, 9)], at).get(1)).toBe('broken');
    expect(lamps([massage], [table(0, 9), item(2, 'oil_trolley', 100)], at).get(1)).toBe('broken');
    // something it was not built with, worn out, is not the room's to answer for
    expect(lamps([massage], [table(0, 9), item(3, 'plant', 100)], at).get(1)).toBe('working');
  });

  it('is amber when nobody is at a station, and green when someone is at their post', () => {
    expect(lamps([massage], [table()]).get(1)).toBe('idle');
    for (const state of ['toPost', 'onBreak', 'toBreak', 'away', 'leaving'] as const)
      expect(lamps([massage], [table(0, 9)], [staff(9, 1, state)]).get(1), state).toBe('idle');
    // posted somewhere else since
    expect(lamps([massage], [table(0, 9)], [staff(9, 7, 'atPost')]).get(1)).toBe('idle');
    expect(lamps([massage], [table(0, 9)], [staff(9, 1, 'atPost')]).get(1)).toBe('working');
  });

  it('is green for a finished, whole room with no stations to work', () => {
    const restroom = room(NORTH, { type: 'restroom' });
    expect(lamps([restroom], [item(1, 'toilet'), item(2, 'sink')]).get(1)).toBe('working');
    expect(lamps([restroom], [item(1, 'toilet', 100), item(2, 'sink')]).get(1)).toBe('broken');
  });

  it("counts a group station only for being broken: it is worked from its room's lead station", () => {
    const sound = room(NORTH, { type: 'sound' });
    const bowls = item(1, 'singing_bowls', 0, 9);
    const mat = item(2, 'sound_mat');
    expect(lamps([sound], [bowls, mat], [staff(9, 1, 'atPost')]).get(1)).toBe('working');
    expect(lamps([sound], [bowls, { ...mat, wear: 100 }], [staff(9, 1, 'atPost')]).get(1)).toBe('broken');
  });

  it('pulses amber and red gently, and holds green and grey steady', () => {
    /** How brightly a lamp in a state glows over the first part of a second. */
    const at = (state: Parameters<typeof lampGlow>[0]) => [0, 0.2, 0.4, 0.6, 0.8].map((t) => lampGlow(state, t));
    for (const state of ['idle', 'broken'] as const) {
      const glow = at(state);
      expect(Math.max(...glow) - Math.min(...glow), state).toBeGreaterThan(0.3);
      expect(Math.min(...glow), state).toBeGreaterThan(0.5);
    }
    for (const state of ['working', 'unfinished'] as const) expect(new Set(at(state)).size, state).toBe(1);
    // lit, so it reads under the tone mapping; grey only faintly
    expect(lampMaterial('working').emissiveIntensity).toBeGreaterThan(1);
    expect(lampMaterial('unfinished').emissiveIntensity).toBeLessThan(0.3);
  });
});

describe('what a room costs to draw', () => {
  // a sign shows its icon from a picture, which Node does not have: one that never arrives will do
  beforeAll(() => {
    Object.assign(globalThis, { Image: Object });
  });

  /** The meshes a room is drawn with, built as the game builds it. */
  async function meshes(r: Room) {
    const { buildRoom } = await import('../../src/render/rooms');
    const trim = mat(0x5aa0c8, 0.6);
    const wall = mat(0xece4d6, 0.9);
    const frame = mat(0xfbfaf6, 0.5);
    const materials: Record<WallMaterial, THREE.Material> = { wall, trim, glass: trim, pane: trim, frame, shell: trim };
    const { group, sign } = buildRoom(r, BUILDING, nearSides(0), materials);
    const out: THREE.Mesh[] = [];
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) out.push(o as THREE.Mesh);
    });
    return { out, sign };
  }

  it('draws its walls, door and sign in a few calls, with its lamp and halo on their own', async () => {
    for (const door of [NORTH, SOUTH]) {
      const { out, sign } = await meshes(room(door));
      // wall, trim, the door's white, the icon, the lamp and its halo
      expect(out.length, `door ${door.dy}`).toBeLessThanOrEqual(6);
      expect(out).toContain(sign?.lamp);
      expect(out).toContain(sign?.halo);
    }
  });
});
