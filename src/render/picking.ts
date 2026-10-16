// Finding what is under the cursor, and where a point in the world is on screen.

import * as THREE from 'three';

import { plotAt } from '../core/land';
import type { Sim } from '../core/sim/sim';
import type { ItemsLayer } from './items';
import type { PeopleLayer } from './people';

/** What a clickable object stands for, kept in its three.js userData. */
interface PickData {
  charKind?: 'guest' | 'staff';
  charId?: number;
  itemId?: number;
}
/** Read what a clickable object stands for. */
const pickData = (o: THREE.Object3D) => o.userData as PickData;

/** Whether an object is actually drawn: it and everything it hangs from are visible. Rays hit hidden objects too. */
export function shown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/** What the player has selected: a person, an item or a room by its number, or a plot of land by its id. */
export type Selection =
  | { kind: 'guest' | 'staff' | 'visitor' | 'item' | 'room'; id: number }
  /** A plot of land, by its id. */
  | { kind: 'plot'; id: string };

export class Picker {
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private camera: THREE.Camera,
    private people: PeopleLayer,
    private items: ItemsLayer,
    private sim: Sim,
  ) {}

  /** Aim the picking ray through a point on the screen. */
  private setRay(clientX: number, clientY: number) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }
  /** Continuous ground coordinates under the cursor. */
  groundAt(clientX: number, clientY: number): { x: number; y: number } | null {
    this.setRay(clientX, clientY);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return null;
    return { x: p.x, y: p.z };
  }
  /** What is under the cursor: a person first, then an item, then a room. */
  pick(clientX: number, clientY: number): Selection | null {
    this.setRay(clientX, clientY);
    const hit = this.raycaster.intersectObjects(this.people.picks(), false).find((h) => shown(h.object));
    const char = hit && pickData(hit.object);
    if (char?.charKind && char.charId !== undefined) return { kind: char.charKind, id: char.charId };
    const itemHit = this.raycaster.intersectObjects(this.items.models(), true).find((h) => shown(h.object));
    const itemId = itemHit && pickData(itemHit.object).itemId;
    if (itemId) return { kind: 'item', id: itemId };
    const g = this.groundAt(clientX, clientY);
    if (g) {
      const room = this.sim.world.roomAt(Math.floor(g.x), Math.floor(g.y));
      if (room) return { kind: 'room', id: room.id };
      // a plot the builders are at, behind its fence: a finished one is the building's floor, and is picked with Expand
      const site = this.sim
        .landOffers()
        .find((o) => o.state === 'building' && plotAt([o.def], Math.floor(g.x), Math.floor(g.y)));
      if (site) return { kind: 'plot', id: site.def.id };
    }
    return null;
  }
  /** Screen position of a point in the world. */
  project(x: number, y: number, h = 0): { x: number; y: number } {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }
}
