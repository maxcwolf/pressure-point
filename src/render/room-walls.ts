// The shape of a room: every box that makes up its walls, windows and door frame.
// Nothing here draws anything, so it can be tested without a renderer.

import type { Plot } from '../core/data';
import type { Room } from '../core/state/types';
import { H_LOW, H_TALL, OUTER_PANE_H, OUTER_PANE_Y0, OUTER_T, WALL_T } from './shared';

/** What a box is made of: plain wall, the room's colored trim, or window glass. */
export type WallMaterial = 'wall' | 'trim' | 'glass';

/** A box running along one wall. */
export interface WallBox {
  /** True for the north and south walls, which run along x. */
  horizontal: boolean;
  /** Where the wall sits on the other axis. */
  fixed: number;
  /** Where the box starts and ends along the wall. */
  a: number;
  b: number;
  /** The height of its base, and how tall it is. */
  y0: number;
  h: number;
  thick: number;
  material: WallMaterial;
}

/** A door propped open into the room, and the sign over its doorway. */
export interface Doorway {
  horizontal: boolean;
  fixed: number;
  /** The tile along the wall the door is in. */
  at: number;
  /** Whether this is one of the tall walls at the back, which get a door leaf. */
  tall: boolean;
  /** The height of the wall the door is in. */
  wallHeight: number;
  /** Which way is into the room: 1 or -1. */
  inward: number;
}

export interface RoomShape {
  boxes: WallBox[];
  doorway: Doorway | null;
}

/** The height of the bottom of a window pane, and how tall the pane is. */
export const WINDOW_SILL = 0.42;
export const WINDOW_PANE = 0.56;

/** One wall of a room, as it is asked for. */
interface Side {
  horizontal: boolean;
  fixed: number;
  a: number;
  b: number;
  /** The tall walls are at the back; the near ones are cut low so you can see in. */
  tall: boolean;
  doorAt: number | null;
  windowsAt: number[];
  inward: number;
  /** It runs along the building's outer wall, which stands in for it; `fixed` is then where that wall is. */
  outer: boolean;
}

/** Which of a room's sides run along the building's outer walls. */
export function alongOuterWall(room: Room, plot: Plot) {
  return {
    north: room.y === plot.y0,
    south: room.y + room.h - 1 === plot.y1,
    west: room.x === plot.x0,
    east: room.x + room.w - 1 === plot.x1,
  };
}

/** Every box of one wall, with its door frame and windows. */
function sideBoxes(side: Side): WallBox[] {
  if (side.outer) return outerSideBoxes(side);
  const { horizontal, fixed, a, b, tall, doorAt, windowsAt } = side;
  const T = WALL_T;
  const hgt = tall ? H_TALL : H_LOW;
  const boxes: WallBox[] = [];
  /** Add a box running along the wall from p to q, or nothing if it has no length. */
  const box = (p: number, q: number, y0: number, h: number, thick: number, material: WallMaterial) => {
    if (q - p <= 0.001) return;
    boxes.push({ horizontal, fixed, a: p, b: q, y0, h, thick, material });
  };
  /** One plain run of wall between openings, as a single box plus its trim. */
  const plain = (p: number, q: number) => {
    box(p, q, 0, hgt, T, 'wall');
    box(p, q, hgt, 0.07, T + 0.05, 'trim');
  };
  let runStart = a;
  for (let t = a; t < b; t++) {
    const isDoor = t === doorAt;
    const isWindow = windowsAt.includes(t);
    if (!isDoor && !isWindow) continue;
    plain(runStart, t);
    runStart = t + 1;
    if (!isWindow) continue;
    // A sill, a pane and a frame, at the same height in every wall. The near walls are cut low so you
    // can see in, so there the window stands up out of the wall. Its sill clears the building's low
    // outer wall, which would otherwise hide all but the top of a window at the edge of the building.
    const paneTop = WINDOW_SILL + WINDOW_PANE;
    box(t, t + 1, 0, WINDOW_SILL, T, 'wall');
    box(t + 0.06, t + 0.94, WINDOW_SILL, WINDOW_PANE, 0.04, 'glass');
    box(t, t + 1, WINDOW_SILL - 0.02, 0.05, T + 0.08, 'trim');
    for (const p of [t, t + 0.94]) box(p, p + 0.06, WINDOW_SILL, WINDOW_PANE, T + 0.03, 'trim');
    if (tall) {
      // the wall carries on over the window
      box(t, t + 1, paneTop, hgt - paneTop, T, 'wall');
      box(t, t + 1, hgt, 0.07, T + 0.05, 'trim');
    } else box(t, t + 1, paneTop, 0.05, T + 0.03, 'trim');
  }
  plain(runStart, b);
  if (doorAt !== null) {
    for (const p of [doorAt, doorAt + 0.9]) box(p, p + 0.1, 0, hgt + 0.07, T + 0.07, 'trim');
    if (tall) box(doorAt, doorAt + 1, hgt - 0.12, 0.19, T + 0.07, 'trim');
  }
  return boxes;
}

/**
 * A side along the building's outer wall: no wall of the room's own, only its windows set into the outer wall.
 * At the back they sit in the tall wall at the building's own window height; at the front they stand on the low wall.
 */
function outerSideBoxes(side: Side): WallBox[] {
  const { horizontal, fixed, tall, windowsAt, inward } = side;
  const boxes: WallBox[] = [];
  /** Add a box running along the wall from p to q, standing off the wall's face by `off`. */
  const box = (p: number, q: number, y0: number, h: number, thick: number, material: WallMaterial, off = 0) => {
    boxes.push({ horizontal, fixed: fixed + off * inward, a: p, b: q, y0, h, thick, material });
  };
  for (const t of windowsAt) {
    if (tall) {
      const top = OUTER_PANE_Y0 + OUTER_PANE_H;
      box(t + 0.06, t + 0.94, OUTER_PANE_Y0, OUTER_PANE_H, 0.04, 'glass', 0.02);
      box(t, t + 1, OUTER_PANE_Y0 - 0.05, 0.05, 0.08, 'trim', 0.04);
      box(t, t + 1, top, 0.05, 0.08, 'trim', 0.04);
      for (const p of [t, t + 0.94]) box(p, p + 0.06, OUTER_PANE_Y0, OUTER_PANE_H, 0.08, 'trim', 0.04);
    } else {
      const paneTop = WINDOW_SILL + WINDOW_PANE;
      box(t, t + 1, 0, WINDOW_SILL, OUTER_T, 'wall');
      box(t + 0.06, t + 0.94, WINDOW_SILL, WINDOW_PANE, 0.04, 'glass');
      box(t, t + 1, WINDOW_SILL - 0.02, 0.05, OUTER_T + 0.08, 'trim');
      for (const p of [t, t + 0.94]) box(p, p + 0.06, WINDOW_SILL, WINDOW_PANE, OUTER_T + 0.03, 'trim');
      box(t, t + 1, paneTop, 0.05, OUTER_T + 0.03, 'trim');
    }
  }
  return boxes;
}

/** Everything a room is built from: its four walls, with their windows and its door, in a building on a plot. */
export function roomShape(room: Room, plot: Plot): RoomShape {
  const T = WALL_T;
  const d = room.door;
  const outer = alongOuterWall(room, plot);
  /** Which tiles along one wall have a window. */
  const wins = (dx: number, dy: number) =>
    room.windows.filter((w) => w.dx === dx && w.dy === dy).map((w) => (dx ? w.y : w.x));
  const sides: Side[] = [
    {
      horizontal: true,
      fixed: outer.north ? plot.y0 : room.y + T / 2,
      a: room.x,
      b: room.x + room.w,
      tall: true,
      doorAt: d.dy === -1 ? d.x : null,
      windowsAt: wins(0, -1),
      inward: 1,
      outer: outer.north,
    },
    {
      horizontal: true,
      fixed: outer.south ? plot.y1 + 1 + OUTER_T / 2 : room.y + room.h - T / 2,
      a: room.x,
      b: room.x + room.w,
      tall: false,
      doorAt: d.dy === 1 ? d.x : null,
      windowsAt: wins(0, 1),
      inward: -1,
      outer: outer.south,
    },
    {
      horizontal: false,
      fixed: outer.west ? plot.x0 : room.x + T / 2,
      a: room.y,
      b: room.y + room.h,
      tall: true,
      doorAt: d.dx === -1 ? d.y : null,
      windowsAt: wins(-1, 0),
      inward: 1,
      outer: outer.west,
    },
    {
      horizontal: false,
      fixed: outer.east ? plot.x1 + 1 + OUTER_T / 2 : room.x + room.w - T / 2,
      a: room.y,
      b: room.y + room.h,
      tall: false,
      doorAt: d.dx === 1 ? d.y : null,
      windowsAt: wins(1, 0),
      inward: -1,
      outer: outer.east,
    },
  ];
  const withDoor = sides.find((s) => s.doorAt !== null);
  return {
    boxes: sides.flatMap(sideBoxes),
    doorway:
      withDoor && withDoor.doorAt !== null
        ? {
            horizontal: withDoor.horizontal,
            fixed: withDoor.fixed,
            at: withDoor.doorAt,
            tall: withDoor.tall,
            wallHeight: withDoor.tall ? H_TALL : H_LOW,
            inward: withDoor.inward,
          }
        : null,
  };
}
