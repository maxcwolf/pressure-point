// The shape of a room: every box that makes up its walls, windows and door frame.
// Nothing here draws anything, so it can be tested without a renderer.

import { type Footprint, inFootprint } from '../core/footprint';
import type { Room } from '../core/state/types';
import {
  DOOR_CASING,
  DOOR_JAMB,
  H_LOW,
  H_TALL,
  OUTER_PANE_H,
  OUTER_PANE_Y0,
  OUTER_T,
  PLAQUE_LOW_BASE,
  PLAQUE_W,
  THRESHOLD_DEPTH,
  THRESHOLD_H,
  THRESHOLD_INSET,
  WALL_T,
} from './shared';
import { nearSides, type Sides } from './turn';
import { windowBoxes, windowSpans } from './windows';

/**
 * What a box is made of: plain wall, the room's colored trim, see-through glass in a room's own walls, the clouded
 * glass of a window in the building's wall, a window's white frame, or the building's teal trim.
 */
export type WallMaterial = 'wall' | 'trim' | 'glass' | 'pane' | 'frame' | 'shell';

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
  /** Part of a window in a wall cut low, drawn as a see-through ghost of itself where it would stand. */
  ghost?: boolean;
}

/** Where a room's sign stands along the wall its door is in. */
export interface SignSpot {
  /** The middle of the plaque along the wall. */
  along: number;
  /** The height of the plaque's bottom edge. */
  base: number;
  /** Whether it stands on a post, beside a doorway in a wall cut low, rather than on top of the door's frame. */
  post: boolean;
}

/** A door propped open into the room, and the sign over its doorway. */
export interface Doorway {
  horizontal: boolean;
  fixed: number;
  /** The tile along the wall the door is in. */
  at: number;
  /** Whether this is one of the tall walls across from the camera, which get a door leaf. */
  tall: boolean;
  /** The height of the wall the door is in. */
  wallHeight: number;
  /** Which way is into the room: 1 or -1. */
  inward: number;
  /** Where the room's sign stands. */
  sign: SignSpot;
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
  /** The walls across the room from the camera stand tall; the ones facing it are cut low so you can see in. */
  tall: boolean;
  doorAt: number | null;
  windowsAt: number[];
  inward: number;
  /** It runs along the building's outer wall, which stands in for it; `fixed` is then where that wall is. */
  outer: boolean;
}

/** One of a room's four walls, before it is split where it runs along the building's outer wall. */
interface WallSpec extends Omit<Side, 'outer' | 'fixed'> {
  /** Where the room's own wall stands, and where the middle of the outer wall is, for a stretch along it. */
  inner: number;
  outerFixed: number;
  /** The row (or column) of tiles just beyond the wall: where the outdoors is, if the outer wall stands in. */
  beyond: number;
}

/** A room's wall split into the stretches along the building's outer wall and the stretches inside it. */
function splitSide(spec: WallSpec, fp: Footprint): Side[] {
  const { inner, outerFixed, beyond, ...side } = spec;
  /** Whether the tile beyond the wall at a point along it is outdoors. */
  const outside = (t: number) => !(spec.horizontal ? inFootprint(fp, t, beyond) : inFootprint(fp, beyond, t));
  const out: Side[] = [];
  let start = spec.a;
  for (let t = spec.a + 1; t <= spec.b; t++) {
    if (t < spec.b && outside(t) === outside(start)) continue;
    const outer = outside(start);
    out.push({
      ...side,
      a: start,
      b: t,
      fixed: outer ? outerFixed : inner,
      doorAt: spec.doorAt !== null && spec.doorAt >= start && spec.doorAt < t ? spec.doorAt : null,
      windowsAt: spec.windowsAt.filter((w) => w >= start && w < t),
      outer,
    });
    start = t;
  }
  return out;
}

/** Every box of one wall, with its door frame and windows. */
function sideBoxes(side: Side): WallBox[] {
  if (side.outer) return outerSideBoxes(side);
  const { horizontal, fixed, a, b, tall, doorAt, windowsAt, inward } = side;
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
  const spans = windowSpans(windowsAt.filter((t) => t !== doorAt));
  // the openings along the wall in order: the door's tile, and each run of windows side by side
  const openings: [number, number][] = [
    ...spans,
    ...(doorAt !== null ? [[doorAt, doorAt + 1] as [number, number]] : []),
  ];
  openings.sort((x, y) => x[0] - y[0]);
  let runStart = a;
  for (const [p, q] of openings) {
    plain(runStart, p);
    runStart = q;
    if (p === doorAt) continue;
    if (tall) {
      // the wall below the window, and carrying on over it
      const paneTop = WINDOW_SILL + WINDOW_PANE;
      box(p, q, 0, WINDOW_SILL, T, 'wall');
      box(p, q, paneTop, hgt - paneTop, T, 'wall');
      box(p, q, hgt, 0.07, T + 0.05, 'trim');
    } else box(p, q, 0, hgt, T, 'wall');
    boxes.push(
      ...windowBoxes({
        horizontal,
        fixed,
        thick: T,
        inward,
        a: p,
        b: q,
        tall,
        sill: WINDOW_SILL,
        pane: WINDOW_PANE,
        inset: true,
        frame: 'trim',
        ledge: 'trim',
        glass: 'glass',
      }),
    );
  }
  plain(runStart, b);
  if (doorAt !== null) boxes.push(...doorFrame(side, doorAt, hgt));
  return boxes;
}

/**
 * A door's frame in the room's trim, standing out from both faces of its wall: a jamb at each side, a head across the
 * top of a tall wall (a wall cut low keeps only the stubs of its jambs), and a threshold across the floor, raised over
 * the one the floor is painted with.
 */
function doorFrame(side: Side, doorAt: number, hgt: number): WallBox[] {
  const { horizontal, fixed, tall, inward } = side;
  const deep = WALL_T + 2 * DOOR_CASING;
  /** A box of the frame along the wall from p to q. */
  const part = (p: number, q: number, y0: number, h: number): WallBox => ({
    horizontal,
    fixed,
    a: p,
    b: q,
    y0,
    h,
    thick: deep,
    material: 'trim',
  });
  const frame = [doorAt, doorAt + 1 - DOOR_JAMB].map((p) => part(p, p + DOOR_JAMB, 0, hgt + 0.07));
  if (tall) frame.push(part(doorAt, doorAt + 1, hgt - 0.12, 0.19));
  // the painted threshold runs from the room's edge, the outer face of its wall, into the room
  const edge = fixed - (inward * WALL_T) / 2;
  frame.push({
    ...part(doorAt + THRESHOLD_INSET, doorAt + 1 - THRESHOLD_INSET, 0, THRESHOLD_H),
    fixed: edge + (inward * THRESHOLD_DEPTH) / 2,
    thick: THRESHOLD_DEPTH,
  });
  return frame;
}

/**
 * Where a room's sign stands: on top of its door's frame in a tall wall, where it is seen over the wall from either
 * side; in a wall cut low, on a post beside the doorway, clear of whoever walks through it and of the room's corners.
 * A wall cut low faces the camera, so another room just beyond it shows its tall wall in front of the sign: the sign
 * then goes beside the other side of the door, or, if another room is beyond that too, up on a post tall enough to be
 * seen over its wall. `walled` is the tiles along the wall with another room beyond them.
 */
export function signSpot(
  side: Pick<Side, 'a' | 'b' | 'tall'>,
  doorAt: number,
  walled: readonly number[] = [],
): SignSpot {
  const hgt = side.tall ? H_TALL : H_LOW;
  if (side.tall) return { along: doorAt + 0.5, base: hgt + 0.09, post: false };
  const half = PLAQUE_W / 2;
  // beside the latch side if the wall carries on far enough there, before the corner's wall, else beside the hinges
  const latch = doorAt + 1 + half + 0.04;
  const hinge = doorAt - half - 0.04;
  /** Whether a plaque here is clear of the walls at either end. */
  const fits = (at: number) => at - half - WALL_T >= side.a && at + half + WALL_T <= side.b;
  /** Whether another room's tall wall stands just beyond the wall in front of a plaque here. */
  const hidden = (at: number) => walled.some((t) => t < at + half && t + 1 > at - half);
  const spots = [latch, hinge].filter(fits);
  const along = spots.find((at) => !hidden(at)) ?? spots[0] ?? Math.max(side.a + WALL_T + half, hinge);
  // over the top of a tall wall, as high as a sign on a tall wall's door frame
  return { along, base: hidden(along) ? H_TALL + 0.09 : PLAQUE_LOW_BASE, post: true };
}

/**
 * The tiles along the wall a room's door is in that have another room just beyond them, as `signSpot` wants them.
 * `inOther` says whether a tile is inside a room other than this one.
 */
export function walledBeyondDoor(room: Room, inOther: (x: number, y: number) => boolean): number[] {
  const d = room.door;
  const out: number[] = [];
  if (d.dy) {
    const y = d.dy < 0 ? room.y - 1 : room.y + room.h;
    for (let x = room.x; x < room.x + room.w; x++) if (inOther(x, y)) out.push(x);
  } else {
    const x = d.dx < 0 ? room.x - 1 : room.x + room.w;
    for (let y = room.y; y < room.y + room.h; y++) if (inOther(x, y)) out.push(y);
  }
  return out;
}

/**
 * A side along the building's outer wall: no wall of the room's own, only its windows, hung in the outer wall just as
 * the building's own are, with the room's trim on their ledge. `fixed` is the middle of the outer wall.
 */
function outerSideBoxes(side: Side): WallBox[] {
  const { horizontal, fixed, tall, windowsAt, inward } = side;
  return windowSpans(windowsAt).flatMap(([a, b]) =>
    windowBoxes({
      horizontal,
      fixed,
      thick: OUTER_T,
      inward,
      a,
      b,
      tall,
      sill: OUTER_PANE_Y0,
      pane: OUTER_PANE_H,
      inset: false,
      frame: 'frame',
      ledge: 'trim',
      glass: 'pane',
    }),
  );
}

/** The sides as they face the camera to begin with: tall at the north and west, low at the south and east. */
const FIRST_VIEW = nearSides(0);

/**
 * Everything a room is built from: its four walls, with their windows and its door, in a building. The walls on the
 * sides facing the camera are cut low so you can see in. Where a wall runs along the building's outer wall, the outer
 * wall stands in for it, and only its windows are added. `walled` is the tiles along the door's wall with another room
 * beyond them, which its sign keeps clear of.
 */
export function roomShape(
  room: Room,
  fp: Footprint,
  near: Sides = FIRST_VIEW,
  walled: readonly number[] = [],
): RoomShape {
  const T = WALL_T;
  const d = room.door;
  const top = room.y;
  const bottom = room.y + room.h;
  const left = room.x;
  const right = room.x + room.w;
  /** Which tiles along one wall have a window. */
  const wins = (dx: number, dy: number) =>
    room.windows.filter((w) => w.dx === dx && w.dy === dy).map((w) => (dx ? w.y : w.x));
  /** The middle of the building's outer wall, which stands in for a side along it, from its inside face. */
  const outerAt = (face: number, out: number) => face + (out * OUTER_T) / 2;
  const specs: WallSpec[] = [
    {
      horizontal: true,
      inner: top + T / 2,
      outerFixed: outerAt(top, -1),
      beyond: top - 1,
      a: left,
      b: right,
      tall: !near.north,
      doorAt: d.dy === -1 ? d.x : null,
      windowsAt: wins(0, -1),
      inward: 1,
    },
    {
      horizontal: true,
      inner: bottom - T / 2,
      outerFixed: outerAt(bottom, 1),
      beyond: bottom,
      a: left,
      b: right,
      tall: !near.south,
      doorAt: d.dy === 1 ? d.x : null,
      windowsAt: wins(0, 1),
      inward: -1,
    },
    {
      horizontal: false,
      inner: left + T / 2,
      outerFixed: outerAt(left, -1),
      beyond: left - 1,
      a: top,
      b: bottom,
      tall: !near.west,
      doorAt: d.dx === -1 ? d.y : null,
      windowsAt: wins(-1, 0),
      inward: 1,
    },
    {
      horizontal: false,
      inner: right - T / 2,
      outerFixed: outerAt(right, 1),
      beyond: right,
      a: top,
      b: bottom,
      tall: !near.east,
      doorAt: d.dx === 1 ? d.y : null,
      windowsAt: wins(1, 0),
      inward: -1,
    },
  ];
  const sides = specs.flatMap((spec) => splitSide(spec, fp));
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
            sign: signSpot(withDoor, withDoor.doorAt, walled),
          }
        : null,
  };
}
