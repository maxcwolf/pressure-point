// Rooms: their walls, windows, doors and signs.

import * as THREE from 'three';

import { ROOMS } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { emojiTexture } from './models/emoji';
import { mat, put } from './models/parts';
import { H_LOW, H_TALL, WALL_T } from './shared';

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
    const wallM = room.done ? mat(0xf7f1e5, 0.85) : this.blueprintMat;
    const trimM = room.done ? mat(def.trim, 0.6) : this.blueprintMat;
    const T = WALL_T;
    /** Add a box running along a wall from a to b, or nothing if it has no length. */
    const box = (
      horizontal: boolean,
      fixed: number,
      a: number,
      b: number,
      y0: number,
      h: number,
      thick: number,
      m: THREE.Material,
    ) => {
      const len = b - a;
      if (len <= 0.001) return;
      const geo = horizontal ? new THREE.BoxGeometry(len, h, thick) : new THREE.BoxGeometry(thick, h, len);
      const mesh = put(g, geo, m, horizontal ? (a + b) / 2 : fixed, y0 + h / 2, horizontal ? fixed : (a + b) / 2);
      mesh.castShadow = room.done;
    };
    const glass = room.done ? this.glass : this.blueprintMat;
    /** Build one wall of the room, with its door and windows. */
    const side = (
      horizontal: boolean,
      fixed: number,
      a: number,
      b: number,
      tall: boolean,
      doorAt: number | null,
      windowsAt: number[],
      inward: number,
    ) => {
      const hgt = tall ? H_TALL : H_LOW;
      /** Build one plain run of wall between openings, as a single box plus its trim. */
      const plain = (p: number, q: number) => {
        box(horizontal, fixed, p, q, 0, hgt, T, wallM);
        box(horizontal, fixed, p, q, hgt, 0.07, T + 0.05, trimM);
      };
      let runStart = a;
      for (let t = a; t < b; t++) {
        const isDoor = t === doorAt;
        const isWindow = windowsAt.includes(t);
        if (!isDoor && !isWindow) continue;
        plain(runStart, t);
        runStart = t + 1;
        if (!isWindow) continue;
        if (tall) {
          // a sill, a pane and a header
          box(horizontal, fixed, t, t + 1, 0, 0.42, T, wallM);
          box(horizontal, fixed, t + 0.06, t + 0.94, 0.42, 0.56, 0.04, glass);
          box(horizontal, fixed, t, t + 1, 0.98, hgt - 0.98, T, wallM);
          box(horizontal, fixed, t, t + 1, hgt, 0.07, T + 0.05, trimM);
          box(horizontal, fixed, t, t + 1, 0.4, 0.05, T + 0.08, trimM);
          for (const p of [t, t + 0.94]) box(horizontal, fixed, p, p + 0.06, 0.42, 0.56, T + 0.03, trimM);
        } else {
          // the near walls are cut low so you can see in, so a window there is a pane standing on the low wall
          box(horizontal, fixed, t, t + 1, 0, hgt, T, wallM);
          box(horizontal, fixed, t + 0.06, t + 0.94, hgt, 0.5, 0.04, glass);
          box(horizontal, fixed, t, t + 1, hgt + 0.5, 0.05, T + 0.03, trimM);
          for (const p of [t, t + 0.94]) box(horizontal, fixed, p, p + 0.06, hgt, 0.5, T + 0.03, trimM);
        }
      }
      plain(runStart, b);
      if (doorAt === null) return;
      for (const p of [doorAt, doorAt + 0.9]) box(horizontal, fixed, p, p + 0.1, 0, hgt + 0.07, T + 0.07, trimM);
      if (tall) {
        box(horizontal, fixed, doorAt, doorAt + 1, hgt - 0.12, 0.19, T + 0.07, trimM);
        // door leaf, propped open into the room
        const pivot = new THREE.Group();
        const leaf = put(pivot, new THREE.BoxGeometry(0.8, hgt - 0.14, 0.05), trimM, 0.4, (hgt - 0.14) / 2, 0);
        leaf.castShadow = room.done;
        if (horizontal) {
          pivot.position.set(doorAt + 0.1, 0, fixed);
          pivot.rotation.y = -1.3 * inward;
        } else {
          pivot.position.set(fixed, 0, doorAt + 0.1);
          pivot.rotation.y = -Math.PI / 2 + 1.3 * inward;
        }
        g.add(pivot);
      }
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: emojiTexture(def.icon), transparent: true, depthTest: false }),
      );
      sprite.scale.setScalar(0.72);
      sprite.renderOrder = 9;
      sprite.position.set(
        horizontal ? doorAt + 0.5 : fixed,
        tall ? hgt + 0.55 : 1.0,
        horizontal ? fixed : doorAt + 0.5,
      );
      g.add(sprite);
    };
    const d = room.door;
    /** Which tiles along one wall have a window. */
    const wins = (dx: number, dy: number) =>
      room.windows.filter((w) => w.dx === dx && w.dy === dy).map((w) => (dx ? w.y : w.x));
    side(true, room.y + T / 2, room.x, room.x + room.w, true, d.dy === -1 ? d.x : null, wins(0, -1), 1);
    side(true, room.y + room.h - T / 2, room.x, room.x + room.w, false, d.dy === 1 ? d.x : null, wins(0, 1), -1);
    side(false, room.x + T / 2, room.y, room.y + room.h, true, d.dx === -1 ? d.y : null, wins(-1, 0), 1);
    side(false, room.x + room.w - T / 2, room.y, room.y + room.h, false, d.dx === 1 ? d.y : null, wins(1, 0), -1);
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
