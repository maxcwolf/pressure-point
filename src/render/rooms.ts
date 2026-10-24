// Rooms: their walls, painted or papered as chosen, windows, doors and signs, and the windows in the building's tall
// outer walls that make way for them. Which walls stand tall depends on which way the camera has been turned.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { ROOMS } from '../core/data';
import { type Footprint, footprintKey } from '../core/footprint';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { papered, paperUVs, wallMaterial } from './decor-paint';
import { disposeOwned, owned } from './disposal';
import { ghostOf } from './hung';
import { mergeStill } from './models/merge';
import { mat, put, sph } from './models/parts';
import { buildSignPlaque, type LampState, pulseLamps, setLamp, type SignPlaque } from './models/sign-plaque';
import { lampStates } from './room-lamp';
import { type Doorway, roomShape, type WallBox, walledBeyondDoor, type WallMaterial } from './room-walls';
import { OUTER_PANE_H, OUTER_PANE_Y0, OUTER_T, SHELL_TRIM } from './shared';
import { nearSides, type Sides, type Turn } from './turn';
import { windowBoxes } from './windows';

/**
 * The look of window glass, shared by every pane: sky at the top fading deeper below, and a pale glint slanting
 * across. Each pane shows it whole, so it costs nothing more to draw.
 */
function glassTexture(): THREE.DataTexture {
  const W = 16;
  const H = 16;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const up = y / (H - 1);
      // a band of glint running up and to the right, a little way in from the left
      const glint = Math.max(0, 1 - Math.abs(x - y * 0.6 - 3) / 1.6) * 0.5;
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, 150 + 80 * up + 90 * glint);
      data[i + 1] = Math.min(255, 200 + 45 * up + 55 * glint);
      data[i + 2] = Math.min(255, 225 + 25 * up + 30 * glint);
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, W, H);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Make a mesh for each box of a wall. A finished room's plain wall boxes take its wallpaper, when it has one. The ghosts
 * of windows in walls cut low are see-through, so they are never merged with the rest: they are joined here instead,
 * into one mesh for each material, rather than costing a draw each.
 */
function addBoxes(
  g: THREE.Group,
  boxes: readonly WallBox[],
  materials: Record<WallMaterial, THREE.Material>,
  shadows: boolean,
  paper = false,
) {
  const ghosts = new Map<WallMaterial, THREE.BufferGeometry[]>();
  for (const b of boxes) {
    const len = b.b - b.a;
    const geo = b.horizontal ? new THREE.BoxGeometry(len, b.h, b.thick) : new THREE.BoxGeometry(b.thick, b.h, len);
    const mid = (b.a + b.b) / 2;
    const [x, y, z] = [b.horizontal ? mid : b.fixed, b.y0 + b.h / 2, b.horizontal ? b.fixed : mid];
    if (b.ghost) {
      ghosts.set(b.material, [...(ghosts.get(b.material) ?? []), geo.translate(x, y, z)]);
      continue;
    }
    if (paper && b.material === 'wall') paperUVs(geo, b.horizontal, mid, y);
    const mesh = put(g, owned(geo), materials[b.material], x, y, z);
    mesh.castShadow = shadows && b.material !== 'pane' && b.material !== 'glass';
  }
  for (const [material, parts] of ghosts) {
    // every part is a plain box, so they always join; null only if they could not
    const joined = mergeGeometries(parts, false) as THREE.BufferGeometry | null;
    for (const part of parts) part.dispose();
    if (joined) g.add(new THREE.Mesh(owned(joined), ghostOf(materials[material])));
  }
}

/** How tall a door is, below the head of its frame, and how wide its leaf, which hangs inside the jambs. */
const LEAF_GAP = 0.14;
const LEAF_W = 0.78;
/** How far a door stands open into its room: wide enough to see it is a door from any side. */
const LEAF_OPEN = 1.15;

/**
 * A door's leaf, hinged at the origin and running along x: a pale panelled door in the room's trim, with a knob on
 * each face, so it reads as a door from any side and any distance.
 */
function doorLeaf(height: number, body: THREE.Material, trim: THREE.Material, shadows: boolean): THREE.Group {
  const pivot = new THREE.Group();
  const T = 0.05;
  const mid = LEAF_W / 2 + 0.01;
  put(pivot, owned(new THREE.BoxGeometry(LEAF_W, height, T)), body, mid, height / 2, 0).castShadow = shadows;
  const panelW = LEAF_W - 0.22;
  const upper = owned(new THREE.BoxGeometry(panelW, height * 0.34, 0.014));
  const lower = owned(new THREE.BoxGeometry(panelW, height * 0.3, 0.014));
  // the panels and knobs share the walls' trim and its shadows, so they are drawn with it in the same call
  const knob = sph(0.035, 10);
  for (const out of [1, -1]) {
    const z = out * (T / 2 + 0.005);
    put(pivot, upper, trim, mid, height * 0.72, z).castShadow = shadows;
    put(pivot, lower, trim, mid, height * 0.27, z).castShadow = shadows;
    put(pivot, knob, trim, LEAF_W - 0.08, height * 0.48, out * (T / 2 + 0.025)).castShadow = shadows;
  }
  return pivot;
}

/** A door propped open into its room, hung inside the frame of a doorway in a tall wall. */
function leafIn(doorway: Doorway, materials: Record<WallMaterial, THREE.Material>, shadows: boolean): THREE.Group {
  const { horizontal, fixed, at, wallHeight, inward } = doorway;
  const pivot = doorLeaf(wallHeight - LEAF_GAP, materials.frame, materials.trim, shadows);
  if (horizontal) {
    pivot.position.set(at + 0.1, 0, fixed);
    pivot.rotation.y = -LEAF_OPEN * inward;
  } else {
    pivot.position.set(fixed, 0, at + 0.1);
    pivot.rotation.y = -Math.PI / 2 + LEAF_OPEN * inward;
  }
  return pivot;
}

/** A room's sign, standing where its doorway puts it, its faces looking either way across the wall. */
function signAt(room: Room, doorway: Doorway, board: THREE.Material): SignPlaque {
  const { horizontal, fixed, sign: spot } = doorway;
  // on a post, it stands on the top of the wall cut low beside the door
  const post = spot.post ? spot.base - (doorway.wallHeight + 0.07) : 0;
  const sign = buildSignPlaque(room.type, board, post);
  const { root } = sign;
  root.position.set(horizontal ? spot.along : fixed, spot.base, horizontal ? fixed : spot.along);
  if (!horizontal) root.rotation.y = Math.PI / 2;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow &&= room.done;
  });
  return sign;
}

/** The see-through blue every part of a blueprint is drawn in. */
export const BLUEPRINT = new THREE.MeshStandardMaterial({
  color: 0x6fb7ff,
  transparent: true,
  opacity: 0.55,
  roughness: 0.6,
});

/**
 * Build a room's walls, windows, door and sign in a building, with the walls facing the camera cut low, in the
 * materials given. A finished room's walls, trim, door and the board of its sign are then drawn in a call each; the
 * glass, and a blueprint, are see-through and drawn part by part; the sign's lamp is left out, to change with the room.
 * `walled` is the tiles along the door's wall with another room beyond them, whose tall wall the sign keeps clear of.
 */
export function buildRoom(
  room: Room,
  fp: Footprint,
  near: Sides,
  materials: Record<WallMaterial, THREE.Material>,
  walled: readonly number[] = [],
): { group: THREE.Group; sign: SignPlaque | null } {
  const g = new THREE.Group();
  const wall = room.wall ?? 'standard';
  const { boxes, doorway } = roomShape(room, fp, near, walled);
  addBoxes(g, boxes, materials, room.done, room.done && papered(wall));
  let sign: SignPlaque | null = null;
  if (doorway) {
    if (doorway.tall) g.add(leafIn(doorway, materials, room.done));
    sign = signAt(room, doorway, materials.trim);
    g.add(sign.root);
  }
  mergeStill(g);
  return { group: g, sign };
}

/** A room as drawn: its group, what it was built from, and its sign, if it has a door to hang one by. */
interface Drawn {
  group: THREE.Group;
  key: string;
  sign: SignPlaque | null;
}

export class RoomsLayer {
  private rooms = new Map<number, Drawn>();
  /** What each room's lamp showed when last looked at, by room id. */
  private lamps = new Map<number, LampState>();
  /** The building's own windows, and the rooms they were last laid out around. */
  private panes = new THREE.Group();
  private panesKey = '';
  /** Which way the camera has been turned, so the walls facing it are cut low. */
  private turn: Turn = 0;
  private glassMap = glassTexture();
  /** The glass in the building's wall, which there is nothing to see through to. */
  private pane = new THREE.MeshStandardMaterial({
    map: this.glassMap,
    roughness: 0.15,
    emissive: 0x9fd8ee,
    emissiveIntensity: 0.18,
  });
  /** The glass in a room's own walls, which you can see through. */
  private glass = new THREE.MeshStandardMaterial({
    map: this.glassMap,
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
    emissive: 0x9fd8ee,
    emissiveIntensity: 0.2,
  });
  /** A window's white frame, and the building's teal trim on the ledges of its own windows. */
  private frame = mat(0xfbfaf6, 0.5);
  private shell = mat(SHELL_TRIM, 0.6);

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {
    scene.add(this.panes);
  }

  /** Cut the walls facing the camera low for a turn, rebuilding the rooms if it has changed. */
  setTurn(turn: Turn) {
    if (turn === this.turn) return;
    this.turn = turn;
    this.sync();
  }

  /** Rebuild any room that has changed, and remove the ones that are gone. */
  sync() {
    const liveRooms = new Set<number>();
    // a room along the building's outer wall leaves that wall to it, until the building grows past, and every wall
    // changes height as the camera turns
    const building = `${footprintKey(this.sim.world.building)}|${this.turn}`;
    for (const r of this.sim.s.rooms) {
      liveRooms.add(r.id);
      // its sign moves for a room built or taken away beyond its door's wall
      const walled = walledBeyondDoor(r, (x, y) => {
        const other = this.sim.world.roomAt(x, y);
        return !!other && other.id !== r.id;
      });
      const key = `${building}|${r.x},${r.y},${r.w},${r.h},${r.door.x},${r.door.y},${r.door.dx},${r.door.dy},${r.done},${r.wall ?? ''},${r.windows.map((w) => `${w.x}.${w.y}.${w.dx}.${w.dy}`).join('|')}|${walled.join('.')}`;
      const cur = this.rooms.get(r.id);
      if (cur?.key === key) continue;
      if (cur) this.dispose(cur.group);
      const drawn = this.build(r, walled);
      this.scene.add(drawn.group);
      // a new sign starts as the lamp last showed, until the next frame looks again
      const lamp = this.lamps.get(r.id);
      if (drawn.sign && lamp) setLamp(drawn.sign, lamp);
      this.rooms.set(r.id, { ...drawn, key });
    }
    for (const [id, r] of this.rooms) {
      if (liveRooms.has(id)) continue;
      this.dispose(r.group);
      this.rooms.delete(id);
    }
    this.syncPanes();
  }

  /**
   * Light each room's lamp for how it is doing this frame, and pulse those that want seeing to. Only the lamps change:
   * nothing is rebuilt.
   */
  update(t: number) {
    this.lamps = lampStates(this.sim);
    for (const [id, drawn] of this.rooms) {
      const lamp = this.lamps.get(id);
      if (drawn.sign && lamp) setLamp(drawn.sign, lamp);
    }
    pulseLamps(t);
  }

  /** What a room's lamp shows, as last looked at. */
  lampOf(roomId: number): LampState | undefined {
    return this.lamps.get(roomId);
  }

  /**
   * Lay out the building's own windows again if the rooms and wall items they make way for, or the way the camera
   * faces, have changed.
   */
  private syncPanes() {
    const near = nearSides(this.turn);
    const windows = this.sim.world.buildingWindows();
    const key = `${this.turn}|${windows.map((w) => `${w.side}${w.line}.${w.a}`).join('|')}`;
    if (key === this.panesKey) return;
    this.panesKey = key;
    this.dispose(this.panes);
    this.panes = new THREE.Group();
    const materials = this.windowMaterials(this.shell);
    const boxes: WallBox[] = [];
    for (const w of windows) {
      const outward = w.side === 'south' || w.side === 'east' ? 1 : -1;
      boxes.push(
        ...windowBoxes({
          horizontal: w.horizontal,
          fixed: w.line + (outward * OUTER_T) / 2,
          thick: OUTER_T,
          inward: -outward,
          a: w.a,
          b: w.b,
          tall: !near[w.side],
          sill: OUTER_PANE_Y0,
          pane: OUTER_PANE_H,
          inset: false,
          frame: 'frame',
          ledge: 'shell',
          glass: 'pane',
        }),
      );
    }
    addBoxes(this.panes, boxes, materials, true);
    mergeStill(this.panes);
    this.scene.add(this.panes);
  }

  /** A blueprint is drawn all in see-through blue. */
  private blueprintMaterials(): Record<WallMaterial, THREE.Material> {
    const m = BLUEPRINT;
    return { wall: m, trim: m, glass: m, pane: m, frame: m, shell: m };
  }

  /** Every material a wall is drawn in, with the room's trim (or the building's) for the rest. */
  private windowMaterials(trim: THREE.Material, wall: THREE.Material = trim): Record<WallMaterial, THREE.Material> {
    return { wall, trim, glass: this.glass, pane: this.pane, frame: this.frame, shell: this.shell };
  }

  /** Build a room's walls, windows, door and sign, in blueprint blue until it is finished. */
  private build(room: Room, walled: readonly number[]): Omit<Drawn, 'key'> {
    const wall = room.wall ?? 'standard';
    const materials = room.done
      ? this.windowMaterials(mat(ROOMS[room.type].trim, 0.6), wallMaterial(wall))
      : this.blueprintMaterials();
    return buildRoom(room, this.sim.world.building, nearSides(this.turn), materials, walled);
  }

  /** Take a group out of the scene and free its own shapes and sign. */
  private dispose(g: THREE.Object3D) {
    this.scene.remove(g);
    disposeOwned(g);
  }
}
