// Rooms: their walls, windows, doors and signs.

import * as THREE from 'three';

import { ROOMS } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { emojiTexture } from './models/emoji';
import { mat, put } from './models/parts';
import { roomShape } from './room-walls';

export class RoomsLayer {
  private rooms = new Map<number, { group: THREE.Group; key: string }>();
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
  ) {}

  /** Rebuild any room that has changed, and remove the ones that are gone. */
  sync() {
    const liveRooms = new Set<number>();
    for (const r of this.sim.s.rooms) {
      liveRooms.add(r.id);
      const key = `${r.x},${r.y},${r.w},${r.h},${r.door.x},${r.door.y},${r.door.dx},${r.door.dy},${r.done},${r.windows.map((w) => `${w.x}.${w.y}.${w.dx}.${w.dy}`).join('|')}`;
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
  }

  /** Build a room's walls, windows, door and sign, in blueprint blue until it is finished. */
  private build(room: Room): THREE.Group {
    const g = new THREE.Group();
    const def = ROOMS[room.type];
    const plain = !room.done;
    const materials = {
      wall: plain ? this.blueprintMat : mat(0xf7f1e5, 0.85),
      trim: plain ? this.blueprintMat : mat(def.trim, 0.6),
      glass: plain ? this.blueprintMat : this.glass,
    };
    const { boxes, doorway } = roomShape(room);
    for (const b of boxes) {
      const len = b.b - b.a;
      const geo = b.horizontal ? new THREE.BoxGeometry(len, b.h, b.thick) : new THREE.BoxGeometry(b.thick, b.h, len);
      const mid = (b.a + b.b) / 2;
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
        const leaf = put(pivot, new THREE.BoxGeometry(0.8, hgt - 0.14, 0.05), materials.trim, 0.4, (hgt - 0.14) / 2, 0);
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
        new THREE.SpriteMaterial({ map: emojiTexture(def.icon), transparent: true, depthTest: false }),
      );
      sprite.scale.setScalar(0.72);
      sprite.renderOrder = 9;
      sprite.position.set(horizontal ? at + 0.5 : fixed, tall ? hgt + 0.55 : 1.0, horizontal ? fixed : at + 0.5);
      g.add(sprite);
    }
    return g;
  }

  /** Take a group out of the scene and free its box geometry. */
  private dispose(g: THREE.Object3D) {
    this.scene.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) o.geometry.dispose();
    });
  }
}
