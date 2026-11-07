// What preparing for a mishap looks like in the center, from the day it is paid for until the mishap is over: before a
// storm, planks nailed across every window in the building's outer walls, and sandbags banked either side of each
// entrance. A ward that held does its work unseen, so it shows nothing here. The pure parts, where each plank and bag
// goes, are worked out apart from the drawing, so they can be tested without a renderer.

import * as THREE from 'three';

import { entranceSpan, type Footprint, inFootprint, type Side, spotInWall } from '../core/footprint';
import { paidFor } from '../core/sim/mishaps';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { disposeOwned, owned } from './disposal';
import { mergeStill } from './models/merge';
import { mat, put, rbox } from './models/parts';
import { hash, OUTER_PANE_H, OUTER_PANE_Y0, OUTER_T } from './shared';
import { nearSides, type Sides, type Turn } from './turn';
import { LOW_INLAY, windowSpans } from './windows';

/** A run of windows in the building's outer wall: the side it is on, the line of the wall's inside face, and its tiles. */
export interface OuterWindow {
  side: Side;
  horizontal: boolean;
  line: number;
  a: number;
  b: number;
}

/** Which way is out through a side of the building, along its axis: 1 or -1. */
const outwardOf = (side: Side) => (side === 'south' || side === 'east' ? 1 : -1);

/**
 * Every window in the building's outer walls: the building's own, and those of the finished rooms that run along the
 * outer wall, which hang in it just as the building's do. A room's windows onto the corridor or the room next door are
 * inside, out of the weather, and left out.
 */
export function outerWindows(
  fp: Footprint,
  rooms: readonly Pick<Room, 'done' | 'windows'>[],
  building: readonly OuterWindow[],
): OuterWindow[] {
  const out = building.map((w) => ({ ...w }));
  const walls = new Map<string, { side: Side; line: number; tiles: number[] }>();
  for (const r of rooms) {
    if (!r.done) continue;
    for (const w of r.windows) {
      if (inFootprint(fp, w.x + w.dx, w.y + w.dy)) continue;
      const { side, line, t } = spotInWall(w);
      const key = `${side}|${line}`;
      const wall = walls.get(key) ?? { side, line, tiles: [] };
      wall.tiles.push(t);
      walls.set(key, wall);
    }
  }
  for (const { side, line, tiles } of walls.values())
    for (const [a, b] of windowSpans(tiles))
      out.push({ side, horizontal: side === 'north' || side === 'south', line, a, b });
  return out;
}

/** A plank, as a box: its middle along the wall and across it, its height, its size, how far it is tilted, its wood. */
export interface Plank {
  horizontal: boolean;
  along: number;
  across: number;
  y: number;
  /** Along the wall, up, and through it. */
  len: number;
  h: number;
  deep: number;
  /** Turned in the face of the wall, in radians, as planks nailed up in a hurry are. */
  tilt: number;
  /** Which of the two woods it is cut from. */
  shade: 0 | 1;
}

/** The widest stretch of window one set of planks covers: wider ones take a set for each stretch, as sheets would. */
export const PLANK_SPAN = 2;
/** How many planks go across a window standing tall, how tall each is, how thick, and how far past the frame they run. */
export const PLANKS = 3;
const PLANK_H = 0.17;
const PLANK_D = 0.03;
const PLANK_OVER = 0.06;
/** How far a window's frame stands out from the inside face of the building's wall (see `windowBoxes`). */
const FRAME_OUT = 0.06;
/** The most a plank is tilted, in radians. */
const PLANK_TILT = 0.05;
/** How tall the plank laid over a window cut low is: over its glass and the tops of its bars. */
const LOW_PLANK_H = 0.055;

/**
 * The planks over one run of outer windows. Standing tall, the window hangs on the wall's inside face, the one the
 * camera sees, so the planks are nailed across it there, each a little askew. Cut low, it is only a strip of glass
 * along the top of its stub of wall, so a plank is laid along the strip in its place.
 */
export function windowPlanks(win: OuterWindow, tall: boolean): Plank[] {
  const outward = outwardOf(win.side);
  const planks: Plank[] = [];
  for (let p = win.a; p < win.b; p += PLANK_SPAN) {
    const q = Math.min(win.b, p + PLANK_SPAN);
    const along = (p + q) / 2;
    const base = { horizontal: win.horizontal, along };
    if (!tall) {
      const { y0 } = LOW_INLAY.building;
      planks.push({
        ...base,
        across: win.line + (outward * OUTER_T) / 2,
        y: y0 + LOW_PLANK_H / 2,
        len: q - p - 0.02,
        h: LOW_PLANK_H,
        deep: OUTER_T - 0.04,
        tilt: 0,
        shade: hash(p, win.line) < 0.5 ? 0 : 1,
      });
      continue;
    }
    const across = win.line - outward * (FRAME_OUT + 0.005 + PLANK_D / 2);
    for (let i = 0; i < PLANKS; i++) {
      const nudge = (hash(p * 7 + i, win.line * 3 + outward) - 0.5) * 0.08;
      planks.push({
        ...base,
        along: along + nudge,
        across,
        y: OUTER_PANE_Y0 + (OUTER_PANE_H * (i + 0.5)) / PLANKS,
        len: q - p + 2 * PLANK_OVER,
        h: PLANK_H,
        deep: PLANK_D,
        tilt: (hash(p + i * 13, win.line - outward) - 0.5) * 2 * PLANK_TILT,
        shade: hash(i, p + win.line) < 0.5 ? 0 : 1,
      });
    }
  }
  return planks;
}

/** A sandbag: where its middle is, in the scene's x, y and z, how far it is turned about the upright, and its cloth. */
export interface Bag {
  x: number;
  y: number;
  z: number;
  yaw: number;
  shade: 0 | 1;
}

/** A sandbag's size: along the wall, up, and out from it, and the gap left between one and the next. */
export const BAG_W = 0.42;
export const BAG_H = 0.15;
export const BAG_D = 0.28;
const BAG_GAP = 0.02;
/** How many bags lie along the bottom of each bank, and how many rows it has, each a bag shorter than the one under it. */
export const BAGS_LOW = 4;
export const BAG_ROWS = 3;
/** How far the bank starts from the doorway, past its pillar. */
const BAG_CLEAR = 0.38;
/** How far out from the wall's outside face a bank lies. */
const BAG_OFF = 0.03;

/**
 * The sandbags banked either side of each entrance, outside against the wall, past its pillars and clear of the
 * doorway and the path out of it: four along the bottom of each bank, and a bag fewer in each row up, across the joins.
 */
export function entranceBags(fp: Pick<Footprint, 'entrances'>): Bag[] {
  const bags: Bag[] = [];
  const step = BAG_W + BAG_GAP;
  for (const e of fp.entrances) {
    const { side, line, a, b } = entranceSpan(e);
    const outward = outwardOf(side);
    const horizontal = side === 'north' || side === 'south';
    const across = line + outward * (OUTER_T + BAG_OFF + BAG_D / 2);
    for (const dir of [-1, 1]) {
      const from = dir < 0 ? a - BAG_CLEAR : b + BAG_CLEAR;
      for (let row = 0; row < BAG_ROWS; row++)
        for (let i = 0; i < BAGS_LOW - row; i++) {
          const along = from + dir * (step * (i + 0.5 + row / 2));
          const [x, z] = horizontal ? [along, across] : [across, along];
          // the top row settles a little into the bags under it
          bags.push({
            x,
            y: BAG_H / 2 + row * (BAG_H - 0.025),
            z,
            yaw: (hash(along * 10, line * 5 + row) - 0.5) * 0.2 + (horizontal ? 0 : Math.PI / 2),
            shade: hash(line + row, along * 10) < 0.5 ? 0 : 1,
          });
        }
    }
  }
  return bags;
}

/** The two woods of the planks, and the two shades of the sacking. */
const WOODS = [0xc49a62, 0xa47a4a] as const;
const SACKING = [0xb49866, 0x9c8053] as const;

/** Everything a storm prepared for shows: the planks over the outer windows, and the sandbags at the entrances. */
export function stormPreparations(windows: readonly OuterWindow[], fp: Footprint, near: Sides) {
  return { planks: windows.flatMap((w) => windowPlanks(w, !near[w.side])), bags: entranceBags(fp) };
}

/** Build the planks and sandbags into one group, merged into a mesh for each material. */
function buildPreparations(prep: ReturnType<typeof stormPreparations>): THREE.Group {
  const root = new THREE.Group();
  for (const p of prep.planks) {
    const [w, d] = p.horizontal ? [p.len, p.deep] : [p.deep, p.len];
    const [x, z] = p.horizontal ? [p.along, p.across] : [p.across, p.along];
    const plank = put(root, owned(new THREE.BoxGeometry(w, p.h, d)), mat(WOODS[p.shade], 0.85), x, p.y, z);
    // tilted in the face of the wall: about the axis through it
    if (p.horizontal) plank.rotation.z = p.tilt;
    else plank.rotation.x = p.tilt;
  }
  const sack = rbox(BAG_W, BAG_H, BAG_D, 0.07);
  for (const b of prep.bags) put(root, sack, mat(SACKING[b.shade], 0.95), b.x, b.y, b.z).rotation.y = b.yaw;
  mergeStill(root);
  // not there to be clicked: a click goes through to the wall or the floor
  root.traverse((o) => {
    /** Nothing to hit. */
    o.raycast = () => undefined;
  });
  return root;
}

/**
 * The preparations made for the mishap coming or under way, shown from the day they are paid for until it is over,
 * and built again when the camera turns, cutting other walls low, or the windows change.
 */
export class PreparationsLayer {
  private root: THREE.Group | null = null;
  private key = '';
  /** The world's version the windows were last looked at for, and the camera's turn. */
  private seen = -1;
  private turn: Turn = 0;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** Cut low the planks over the windows facing the camera, as the walls they are on are cut. */
  setTurn(turn: Turn) {
    this.turn = turn;
    this.seen = -1;
  }

  /** Show the preparations while a mishap paid for is coming or under way, built again if what they cover changed. */
  update() {
    const storm = paidFor(this.sim.s) === 'storm';
    if (!storm) {
      if (this.root) this.clear();
      return;
    }
    const world = this.sim.world;
    if (this.root && this.seen === world.version) return;
    this.seen = world.version;
    const windows = outerWindows(world.building, this.sim.s.rooms, world.buildingWindows());
    const key = `${this.turn}|${windows.map((w) => `${w.side}${w.line}.${w.a}.${w.b}`).join('|')}|${world.building.entrances.map((e) => `${e.side}${e.x},${e.y}`).join('|')}`;
    if (this.root && key === this.key) return;
    this.clear();
    this.key = key;
    this.root = buildPreparations(stormPreparations(windows, world.building, nearSides(this.turn)));
    this.scene.add(this.root);
  }

  /** Take the preparations away, and free what was built for them alone. */
  private clear() {
    if (!this.root) return;
    this.scene.remove(this.root);
    disposeOwned(this.root);
    this.root = null;
    this.key = '';
  }
}
