// What is drawn over the scene for the player's benefit: tile highlights, the preview of an item being
// placed and the way it faces, the door and window marker, floating icons and the ring around whatever is selected.

import * as THREE from 'three';

import type { ItemType, RugPatternId } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { at } from '../core/util';
import { frontOf, itemCenter, itemDims } from '../core/world';
import { placeItemModel } from './items';
import { emojiTexture } from './models/emoji';
import { buildItem } from './models/items';
import type { Marker, OverlayTile } from './overlay-codes';
import type { Selection } from './picking';

/** How far out from an item's front edge the arrow showing its front sits. */
const FRONT_GAP = 0.2;

/** A small flat arrowhead on the floor, pointing along +z. */
function frontArrow(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.13);
  shape.lineTo(0.17, -0.05);
  shape.lineTo(0, 0.01);
  shape.lineTo(-0.17, -0.05);
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
}

const OVERLAY_COLORS = [0x3ddc84, 0xff5d5d, 0x4aa8ff, 0xffc93c, 0x9b6bff, 0xff8a3c].map((c) => new THREE.Color(c));

export interface GhostSpec {
  type: ItemType;
  x: number;
  y: number;
  rot: number;
  ok: boolean;
  /** A rug's pattern. */
  pattern?: RugPatternId | undefined;
}
/** A highlight on one tile's worth of wall, for placing doors and windows. */
export interface DoorSpec {
  door: Room['door'];
  /** Fine to place here, not allowed, or something is already here that a click would remove. */
  tone: 'ok' | 'bad' | 'remove';
}

export class Overlays {
  /** What the player has selected, if anything. */
  selected: Selection | null = null;
  private overlay: THREE.InstancedMesh;
  private ghost: { group: THREE.Group; key: string } | null = null;
  private ghostMats = {
    ok: new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.6, depthWrite: false }),
    bad: new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.6, depthWrite: false }),
    remove: new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.7, depthWrite: false }),
  };
  private markers: THREE.Sprite[] = [];
  private doorMarker: THREE.Mesh;
  private frontMarker: THREE.Mesh;
  private ring: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {
    const tileGeo = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    this.overlay = new THREE.InstancedMesh(
      tileGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
      700,
    );
    this.overlay.count = 0;
    this.overlay.frustumCulled = false;
    this.overlay.renderOrder = 2;
    this.scene.add(this.overlay);

    this.doorMarker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.16), this.ghostMats.ok);
    this.doorMarker.visible = false;
    this.scene.add(this.doorMarker);

    this.frontMarker = new THREE.Mesh(
      frontArrow(),
      new THREE.MeshBasicMaterial({
        // the teal of the notch marking a model's front in the model lab
        color: 0x23827c,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.frontMarker.visible = false;
    this.frontMarker.renderOrder = 3;
    this.scene.add(this.frontMarker);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.52, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);
  }

  /** Show colored tiles on the floor for the current tool. */
  setOverlay(tiles: OverlayTile[]) {
    const m = new THREE.Matrix4();
    const n = Math.min(tiles.length, 700);
    for (const [i, [x, y, c]] of tiles.slice(0, n).entries()) {
      m.makeTranslation(x + 0.5, 0.025, y + 0.5);
      this.overlay.setMatrixAt(i, m);
      this.overlay.setColorAt(i, at(OVERLAY_COLORS, c));
    }
    this.overlay.count = n;
    this.overlay.instanceMatrix.needsUpdate = true;
    if (this.overlay.instanceColor) this.overlay.instanceColor.needsUpdate = true;
  }

  /**
   * Show a see-through preview of an item being placed, green if it fits and red if not, with an arrow on the floor
   * by its front if it has one; or hide it.
   */
  setGhost(spec: GhostSpec | null) {
    const front = spec && frontOf(spec);
    this.frontMarker.visible = !!front;
    if (front) {
      this.frontMarker.position.set(
        front.x + Math.sin(front.face) * FRONT_GAP,
        0.035,
        front.y + Math.cos(front.face) * FRONT_GAP,
      );
      this.frontMarker.rotation.y = front.face;
    }
    if (!spec) {
      if (this.ghost) this.scene.remove(this.ghost.group);
      this.ghost = null;
      return;
    }
    // a rug is built afresh in each pattern
    const key = `${spec.type}:${spec.pattern ?? ''}`;
    if (this.ghost?.key !== key) {
      if (this.ghost) this.scene.remove(this.ghost.group);
      const group = buildItem(spec.type, spec.pattern);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      this.scene.add(group);
      this.ghost = { group, key };
    }
    const m = spec.ok ? this.ghostMats.ok : this.ghostMats.bad;
    this.ghost.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = m;
    });
    placeItemModel(this.ghost.group, spec.type, spec.x, spec.y, spec.rot);
  }

  /** Icons floating over tiles, used to show who each square beside a piece of furniture is for. */
  setMarkers(list: Marker[]) {
    while (this.markers.length < list.length) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.scale.setScalar(0.62);
      sprite.renderOrder = 11;
      this.scene.add(sprite);
      this.markers.push(sprite);
    }
    this.markers.forEach((sprite, i) => {
      const m = list[i];
      sprite.visible = !!m;
      if (!m) return;
      sprite.material.map = emojiTexture(m.icon);
      sprite.material.needsUpdate = true;
      sprite.position.set(m.x + 0.5, 1.15, m.y + 0.5);
    });
  }

  /** Show or hide the highlight on a stretch of wall. */
  setDoor(spec: DoorSpec | null) {
    this.doorMarker.visible = !!spec;
    if (!spec) return;
    const d = spec.door;
    this.doorMarker.material = this.ghostMats[spec.tone];
    this.doorMarker.position.set(d.x + 0.5 + d.dx * 0.5, 0.55, d.y + 0.5 + d.dy * 0.5);
    this.doorMarker.rotation.y = d.dx ? Math.PI / 2 : 0;
  }

  /** Put the ring around whatever is selected, pulsing gently around a person. */
  updateRing(t: number) {
    const sel = this.selected;
    this.ring.visible = false;
    if (sel && (sel.kind === 'guest' || sel.kind === 'staff' || sel.kind === 'visitor')) {
      const c = this.sim.char(sel.id);
      if (c) {
        this.ring.visible = true;
        this.ring.position.set(c.x, 0.04, c.y);
        this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
      }
    } else if (sel?.kind === 'item') {
      const it = this.sim.world.item(sel.id);
      if (it) {
        const [cx, cy] = itemCenter(it);
        const [w, h] = itemDims(it.type, it.rot);
        this.ring.visible = true;
        this.ring.position.set(cx, 0.04, cy);
        this.ring.scale.setScalar(Math.max(w, h) * 1.25);
      }
    }
  }
}
