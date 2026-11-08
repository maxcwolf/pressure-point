// What preparing for a mishap looks like in the center, from the day it is paid for until the mishap is over: before a
// storm, planks nailed across every window in the building's outer walls and sandbags banked either side of each
// entrance; before a power cut, a hired generator outside the door with its cable run in; before a freeze, lagging on
// the pipes and a tarp over the koi pond; before the wasps, traps beside the snacks and drinks, mesh over the bins and
// the pest control van at the curb. Each sits on what the mishap would stop, so the player sees what they protected. A
// Shaman's ward shows as a chalk sigil inside the door, smeared if it fails. The pure parts, where each piece goes,
// are worked out apart from the drawing, so they can be tested without a renderer.

import * as THREE from 'three';

import { ITEMS, type ItemType, type MishapId, MISHAPS, ROAD_Y } from '../core/data';
import { entranceSpan, type Footprint, inFootprint, type Side, spotInWall } from '../core/footprint';
import { mishapOn, paidFor } from '../core/sim/mishaps';
import type { Sim } from '../core/sim/sim';
import type { GameState, Item, Room } from '../core/state/types';
import { must } from '../core/util';
import { itemCenter, itemDims, type Placed, rotVec } from '../core/world';
import { disposeOwned, owned } from './disposal';
import { buildItem } from './models/items';
import { mergeStill } from './models/merge';
import { mat, put, rbox } from './models/parts';
import {
  buildCable,
  buildCableRamp,
  buildHiredGenerator,
  buildLagging,
  buildMeshLid,
  buildPestVan,
  buildSigil,
  buildTarp,
  buildWallSocket,
  buildWaspTrap,
  EXHAUST,
  puffExhaust,
} from './models/preparations';
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

/** Which way a side of the building faces out, as a turn about the upright of something built facing +z. */
const yawOut = (side: Side) => ({ south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 })[side];

/** The front entrance: its span along its wall, which way is out, and whether the wall runs along x. */
export function frontDoor(fp: Pick<Footprint, 'entrances'>) {
  const span = entranceSpan(must(fp.entrances[0], 'front entrance'));
  return { ...span, outward: outwardOf(span.side), horizontal: span.side === 'north' || span.side === 'south' };
}
type Door = ReturnType<typeof frontDoor>;

/** A point by a door, in the scene: `along` its wall, `out` from the wall's inside face (negative inside), `y` up. */
export const byDoor = (d: Door, along: number, out: number, y = 0): [number, number, number] =>
  d.horizontal ? [along, y, d.line + d.outward * out] : [d.line + d.outward * out, y, along];

/** Put a model by a door, turned so its front faces `face` (a turn about the upright) from facing out. */
function placeByDoor(root: THREE.Object3D, model: THREE.Object3D, d: Door, along: number, out: number, face = 0) {
  model.position.set(...byDoor(d, along, out));
  model.rotation.y = yawOut(d.side) + face;
  root.add(model);
  return model;
}

/**
 * Where the hired generator stands, by the front door: its middle along the wall, past the right-hand pillar and clear
 * of it, and out from the wall's inside face, on the paving outside. It is 2.4 m long with its tow bar, the socket end
 * toward the door, and 1 m wide with its wheels.
 */
export const generatorSpot = (d: Door) => ({ along: d.b + 1.65, out: OUTER_T + 0.72 });

/** Where the pest control van parks: at the curb, in the lane nearer the center, past the door from the fire engine's spot. */
export const vanSpot = (door: readonly [number, number]) => ({ x: door[0] + 4.5, z: ROAD_Y[0] + 0.55 });

/** Where a ward's sigil is chalked: on the floor in the middle of the doorway, a tile and a half inside. */
export const sigilSpot = (d: Door) => ({ along: (d.a + d.b) / 2, out: -1.7 });

/** What a mishap prepared for puts on one of the things it would stop. */
export type Covering = 'lagging' | 'tarp' | 'trap' | 'lid';

/**
 * What preparing for a mishap puts on an item of a kind it would stop: lagging on the pipes for a freeze, or a tarp
 * over a koi pond; a wasp trap beside a snack or drink, or a mesh lid on a bin. Nothing for anything else.
 */
export function coveringOf(kind: MishapId, type: ItemType): Covering | undefined {
  if (!MISHAPS[kind].stops?.includes(type)) return undefined;
  if (kind === 'freeze') return type === 'koi_pond' ? 'tarp' : 'lagging';
  if (kind === 'wasps') return ITEMS[type].bin ? 'lid' : 'trap';
  return undefined;
}

/**
 * Which side of an item its wasp trap stands, in the item's own frame: its right (1) if the tile there is free, else
 * its left (-1), else 0, tucked in at its right on its own tile. `free` says whether a tile is open floor in the same
 * room or corridor as the item, with nothing on it.
 */
export function trapSide(it: Placed, free: (x: number, y: number) => boolean): 1 | -1 | 0 {
  const [w, h] = itemDims(it.type, it.rot);
  const [cx, cy] = itemCenter(it);
  for (const side of [1, -1] as const) {
    const [dx, dy] = rotVec(it.rot, side, 0);
    const reach = (dx ? w : h) / 2 + 0.5;
    if (free(Math.floor(cx + dx * reach), Math.floor(cy + dy * reach))) return side;
  }
  return 0;
}

/** Each item's model's bounds in its own frame, its front toward +z, worked out once for each kind. */
const bounds = new Map<ItemType, THREE.Box3>();
/** An item's model's bounds, from the cache or measured now. */
function boundsOf(type: ItemType): THREE.Box3 {
  let b = bounds.get(type);
  if (!b) {
    b = new THREE.Box3().setFromObject(buildItem(type));
    bounds.set(type, b);
  }
  return b;
}

/** Put a model where an item stands, in the item's own frame, as the items layer places the item. */
function placeOnItem(root: THREE.Object3D, model: THREE.Object3D, it: Item) {
  const [cx, cy] = itemCenter(it);
  model.position.set(cx, 0, cy);
  model.rotation.y = (-it.rot * Math.PI) / 2;
  root.add(model);
}

/** A power cut: the hired generator outside the door, its cable in through the doorway under a ramp to a socket. */
function buildPowerPrep(fp: Footprint): THREE.Group {
  const root = new THREE.Group();
  const d = frontDoor(fp);
  const T = OUTER_T;
  const gen = generatorSpot(d);
  placeByDoor(root, buildHiredGenerator(), d, gen.along, gen.out, Math.PI);
  const socket = gen.along - 0.72;
  // in through the doorway, close by its right-hand side, under a ramp, then along the inside of the wall to a socket
  const lane = d.b - 0.42;
  root.add(
    buildCable([
      byDoor(d, socket, gen.out, 0.6),
      byDoor(d, socket - 0.1, gen.out, 0.3),
      byDoor(d, socket - 0.2, gen.out - 0.05, 0.03),
      byDoor(d, lane + 0.1, T + 0.45, 0.03),
      byDoor(d, lane, T + 0.25, 0.02),
      byDoor(d, lane, -0.15, 0.02),
      byDoor(d, lane + 0.15, -0.3, 0.03),
      byDoor(d, d.b + 0.35, -0.3, 0.03),
      byDoor(d, d.b + 0.52, -0.1, 0.08),
      byDoor(d, d.b + 0.55, -0.05, 0.18),
    ]),
  );
  placeByDoor(root, buildCableRamp(0.9), d, lane, T / 2 + 0.05, Math.PI / 2);
  const plug = placeByDoor(root, buildWallSocket(), d, d.b + 0.55, 0, Math.PI);
  plug.position.y = 0.2;
  return root;
}

/** A big freeze: lagging on the pipes of everything the freeze would stop, and a tarp over each koi pond. */
function buildFreezePrep(items: readonly Item[]): THREE.Group {
  const root = new THREE.Group();
  for (const it of items) {
    const covering = coveringOf('freeze', it.type);
    if (!covering) continue;
    const b = boundsOf(it.type);
    if (covering === 'tarp') placeOnItem(root, buildTarp(ITEMS[it.type].w - 0.1, ITEMS[it.type].h - 0.1, b.max.y), it);
    // a toilet's pipes run up inside its stall, between the bowl and the partitions
    else placeOnItem(root, buildLagging(b.min.z, b.max.x - b.min.x, b.max.y, it.type === 'toilet' ? 0.24 : 0), it);
  }
  return root;
}

/** Wasps: a trap beside each snack and drink, a mesh lid on each bin, and the pest control van at the curb. */
function buildWaspPrep(fp: Footprint, items: readonly Item[], free: (it: Item, x: number, y: number) => boolean) {
  const root = new THREE.Group();
  for (const it of items) {
    const covering = coveringOf('wasps', it.type);
    if (!covering) continue;
    const b = boundsOf(it.type);
    const holder = new THREE.Group();
    if (covering === 'lid') holder.add(buildMeshLid(Math.min(b.max.x - b.min.x, b.max.z - b.min.z) / 2, b.max.y));
    else {
      const side = trapSide(it, (x, y) => free(it, x, y));
      const trap = buildWaspTrap();
      const half = ITEMS[it.type].w / 2;
      if (side === 1) trap.position.set(b.max.x + 0.12, 0, b.max.z - 0.1);
      else if (side === -1) trap.position.set(b.min.x - 0.12, 0, b.max.z - 0.1);
      else trap.position.set(half - 0.04, 0, b.max.z - 0.02);
      // the jar hangs away from the item, or out in front of it when tucked in on its own tile
      trap.rotation.y = side === -1 ? Math.PI : side === 0 ? -Math.PI / 2 : 0;
      holder.add(trap);
    }
    placeOnItem(root, holder, it);
  }
  const van = buildPestVan();
  const spot = vanSpot(fp.door);
  van.position.set(spot.x, 0, spot.z);
  root.add(van);
  return root;
}

/** A Shaman's ward: the sigil chalked on the floor just inside the door, held or smeared. */
function buildWardPrep(fp: Footprint, smeared: boolean): THREE.Group {
  const root = new THREE.Group();
  const d = frontDoor(fp);
  const spot = sigilSpot(d);
  placeByDoor(root, buildSigil(smeared), d, spot.along, spot.out);
  return root;
}

/**
 * What a mishap prepared for shows now: the mishap paid for, if any, and a Shaman's ward once it is performed, held,
 * or smeared once it has failed. Nothing for a ward only asked for.
 */
export function preparationsShown(s: GameState): { paid: MishapId | undefined; ward: 'held' | 'smeared' | undefined } {
  const m = s.mishap;
  const ward = m?.ward === 'done' ? (m.started && !m.prepared ? 'smeared' : 'held') : undefined;
  return { paid: paidFor(s), ward };
}

/**
 * The preparations made for the mishap coming or under way, shown from the day they are paid for until it is over,
 * and built again when the camera turns, cutting other walls low, or the windows or the things they cover change.
 */
export class PreparationsLayer {
  private root: THREE.Group | null = null;
  private key = '';
  /** The world's version the windows were last looked at for, and what was shown. */
  private seen = -1;
  private showing = '';
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

  /**
   * Show the preparations while a mishap paid for is coming or under way, built again if what they cover changed, and
   * puff the hired generator's exhaust while it carries the center through the cut.
   */
  update(t: number) {
    this.sync();
    const exhaust = this.root?.getObjectByName(EXHAUST);
    if (!exhaust) return;
    exhaust.visible = mishapOn(this.sim.s)?.id === 'power';
    if (exhaust.visible) puffExhaust(exhaust, t);
  }

  /** Build the preparations again if what they show, or what they stand on, has changed. */
  private sync() {
    const s = this.sim.s;
    const show = preparationsShown(s);
    const showing = `${show.paid ?? ''}|${show.ward ?? ''}`;
    if (!show.paid && !show.ward) {
      if (this.root) this.clear();
      return;
    }
    const world = this.sim.world;
    if (this.root && this.seen === world.version && this.showing === showing) return;
    this.seen = world.version;
    this.showing = showing;
    const windows = outerWindows(world.building, s.rooms, world.buildingWindows());
    const covers = show.paid === 'freeze' || show.paid === 'wasps';
    const key = [
      showing,
      this.turn,
      windows.map((w) => `${w.side}${w.line}.${w.a}.${w.b}`).join('|'),
      world.building.entrances.map((e) => `${e.side}${e.x},${e.y}`).join('|'),
      covers ? s.items.map((it) => `${it.type}${it.x},${it.y},${it.rot}`).join('|') : '',
    ].join('#');
    if (this.root && key === this.key) return;
    this.clear();
    this.key = key;
    const fp = world.building;
    /** Whether a tile beside an item is open floor on its side of any wall, with nothing standing on it. */
    const free = (it: Item, x: number, y: number) =>
      world.walkable(x, y) && !world.itemAt(x, y) && world.zoneAt(x, y) === world.zoneAt(it.x, it.y);
    const root = new THREE.Group();
    if (show.paid === 'storm') root.add(buildPreparations(stormPreparations(windows, fp, nearSides(this.turn))));
    if (show.paid === 'power') root.add(buildPowerPrep(fp));
    if (show.paid === 'freeze') root.add(buildFreezePrep(s.items));
    if (show.paid === 'wasps') root.add(buildWaspPrep(fp, s.items, free));
    if (show.ward) root.add(buildWardPrep(fp, show.ward === 'smeared'));
    root.traverse((o) => {
      /** Not there to be clicked: a click goes through to what is under it. */
      o.raycast = () => undefined;
    });
    this.root = root;
    this.scene.add(root);
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
