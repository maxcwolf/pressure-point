// Rooms: their walls, painted or papered as chosen, windows, doors and signs, and the windows in the building's tall
// outer walls that make way for them. Which walls stand tall depends on which way the camera has been turned.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { ROOMS } from '../core/data';
import { footprintKey } from '../core/footprint';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { papered, paperUVs, wallMaterial } from './decor-paint';
import { disposeOwned, owned } from './disposal';
import { ghostOf } from './hung';
import { iconTexture } from './models/icons';
import { mergeStill } from './models/merge';
import { mat, put } from './models/parts';
import { roomShape, type WallBox, type WallMaterial } from './room-walls';
import { OUTER_PANE_H, OUTER_PANE_Y0, OUTER_T, SHELL_TRIM } from './shared';
import { nearSides, type Turn } from './turn';
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

export class RoomsLayer {
  private rooms = new Map<number, { group: THREE.Group; key: string }>();
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
  private blueprintMat = new THREE.MeshStandardMaterial({
    color: 0x6fb7ff,
    transparent: true,
    opacity: 0.55,
    roughness: 0.6,
  });

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
      const key = `${building}|${r.x},${r.y},${r.w},${r.h},${r.door.x},${r.door.y},${r.door.dx},${r.door.dy},${r.done},${r.wall ?? ''},${r.windows.map((w) => `${w.x}.${w.y}.${w.dx}.${w.dy}`).join('|')}`;
      const cur = this.rooms.get(r.id);
      if (cur?.key === key) continue;
      if (cur) this.dispose(cur.group);
      const group = this.build(r);
      this.scene.add(group);
      this.rooms.set(r.id, { group, key });
    }
    for (const [id, r] of this.rooms) {
      if (liveRooms.has(id)) continue;
      this.dispose(r.group);
      this.rooms.delete(id);
    }
    this.syncPanes();
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
    const m = this.blueprintMat;
    return { wall: m, trim: m, glass: m, pane: m, frame: m, shell: m };
  }

  /** Every material a wall is drawn in, with the room's trim (or the building's) for the rest. */
  private windowMaterials(trim: THREE.Material, wall: THREE.Material = trim): Record<WallMaterial, THREE.Material> {
    return { wall, trim, glass: this.glass, pane: this.pane, frame: this.frame, shell: this.shell };
  }

  /** Build a room's walls, windows, door and sign, in blueprint blue until it is finished. */
  private build(room: Room): THREE.Group {
    const g = new THREE.Group();
    const def = ROOMS[room.type];
    const plain = !room.done;
    const wall = room.wall ?? 'standard';
    const materials = plain
      ? this.blueprintMaterials()
      : { ...this.windowMaterials(mat(def.trim, 0.6), wallMaterial(wall)) };
    const { boxes, doorway } = roomShape(room, this.sim.world.building, nearSides(this.turn));
    addBoxes(g, boxes, materials, room.done, !plain && papered(wall));
    if (doorway) {
      const { horizontal, fixed, at, tall, wallHeight: hgt, inward } = doorway;
      if (tall) {
        // door leaf, propped open into the room
        const pivot = new THREE.Group();
        const leaf = put(
          pivot,
          owned(new THREE.BoxGeometry(0.8, hgt - 0.14, 0.05)),
          materials.trim,
          0.4,
          (hgt - 0.14) / 2,
          0,
        );
        leaf.castShadow = room.done;
        if (horizontal) {
          pivot.position.set(at + 0.1, 0, fixed);
          pivot.rotation.y = -1.3 * inward;
        } else {
          pivot.position.set(fixed, 0, at + 0.1);
          pivot.rotation.y = -Math.PI / 2 + 1.3 * inward;
        }
        g.add(pivot);
      }
      // the room's sign: its plate on its own, as a sign hangs, rather than in a speech bubble
      const sign = iconTexture(`room-${room.type}`, true);
      const sprite = new THREE.Sprite(
        owned(new THREE.SpriteMaterial({ map: sign, transparent: true, depthTest: false })),
      );
      sprite.scale.setScalar(0.72);
      sprite.renderOrder = 9;
      sprite.position.set(horizontal ? at + 0.5 : fixed, tall ? hgt + 0.55 : 1.0, horizontal ? fixed : at + 0.5);
      g.add(sprite);
    }
    // a finished room's walls and trim are drawn in a call each; the glass, and a blueprint, are see-through and drawn pane by pane
    mergeStill(g);
    return g;
  }

  /** Take a group out of the scene and free its own shapes and sign. */
  private dispose(g: THREE.Object3D) {
    this.scene.remove(g);
    disposeOwned(g);
  }
}
