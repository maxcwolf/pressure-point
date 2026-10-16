// Rooms: their walls, painted or papered as chosen, windows, doors and signs, and the windows in the building's tall
// outer walls that make way for them. Which walls stand tall depends on which way the camera has been turned.

import * as THREE from 'three';

import { ROOMS } from '../core/data';
import { footprintKey } from '../core/footprint';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { papered, paperUVs, wallMaterial } from './decor-paint';
import { disposeOwned, owned } from './disposal';
import { emojiTexture } from './models/emoji';
import { mergeStill } from './models/merge';
import { mat, put } from './models/parts';
import { outerPanes } from './outer-walls';
import { roomShape } from './room-walls';
import { OUTER_PANE_H, OUTER_PANE_Y0 } from './shared';
import { nearSides, type Turn } from './turn';

export class RoomsLayer {
  private rooms = new Map<number, { group: THREE.Group; key: string }>();
  /** The building's own windows, and the rooms they were last laid out around. */
  private panes = new THREE.Group();
  private panesKey = '';
  /** Which way the camera has been turned, so the walls facing it are cut low. */
  private turn: Turn = 0;
  private paneGlass = mat(0xbfe6f5, 0.2, 0.25);
  private glass = new THREE.MeshStandardMaterial({
    color: 0xbfe6f5,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    emissive: 0x9fd8ee,
    emissiveIntensity: 0.25,
  });
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

  /** Lay out the building's own windows again if the rooms they make way for, or the walls standing tall, have changed. */
  private syncPanes() {
    const { building } = this.sim.world;
    const panes = outerPanes(building, this.sim.s.rooms, nearSides(this.turn));
    const key = panes.map((p) => `${p.side}${p.line}.${p.a}`).join('|');
    if (key === this.panesKey) return;
    this.panesKey = key;
    this.dispose(this.panes);
    this.panes = new THREE.Group();
    for (const p of panes) {
      const len = p.b - p.a;
      const mid = (p.a + p.b) / 2;
      const y = OUTER_PANE_Y0 + OUTER_PANE_H / 2;
      // on the inside face of the wall
      const face = p.line + (p.side === 'north' || p.side === 'west' ? 0.02 : -0.02);
      if (p.horizontal)
        put(this.panes, owned(new THREE.BoxGeometry(len, OUTER_PANE_H, 0.04)), this.paneGlass, mid, y, face);
      else put(this.panes, owned(new THREE.BoxGeometry(0.04, OUTER_PANE_H, len)), this.paneGlass, face, y, mid);
    }
    mergeStill(this.panes);
    this.scene.add(this.panes);
  }

  /** Build a room's walls, windows, door and sign, in blueprint blue until it is finished. */
  private build(room: Room): THREE.Group {
    const g = new THREE.Group();
    const def = ROOMS[room.type];
    const plain = !room.done;
    const wall = room.wall ?? 'standard';
    const materials = {
      wall: plain ? this.blueprintMat : wallMaterial(wall),
      trim: plain ? this.blueprintMat : mat(def.trim, 0.6),
      glass: plain ? this.blueprintMat : this.glass,
    };
    const { boxes, doorway } = roomShape(room, this.sim.world.building, nearSides(this.turn));
    for (const b of boxes) {
      const len = b.b - b.a;
      const geo = owned(
        b.horizontal ? new THREE.BoxGeometry(len, b.h, b.thick) : new THREE.BoxGeometry(b.thick, b.h, len),
      );
      const mid = (b.a + b.b) / 2;
      if (!plain && b.material === 'wall' && papered(wall)) paperUVs(geo, b.horizontal, mid, b.y0 + b.h / 2);
      const mesh = put(
        g,
        geo,
        materials[b.material],
        b.horizontal ? mid : b.fixed,
        b.y0 + b.h / 2,
        b.horizontal ? b.fixed : mid,
      );
      mesh.castShadow = room.done;
    }
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
      const sprite = new THREE.Sprite(
        owned(new THREE.SpriteMaterial({ map: emojiTexture(def.icon), transparent: true, depthTest: false })),
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
