// What is drawn over the scene for the player's benefit: tile highlights, the preview of an item being
// placed and the way it faces, the door and window marker, floating icons, the ring and marker on whatever is selected
// and the glow on whatever a click would select.

import * as THREE from 'three';

import type { ItemType, RugPatternId } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { at } from '../core/util';
import { frontOf, itemCenter, itemDims, onWall } from '../core/world';
import { hangPlace, placeHung } from './hung';
import { placeItemModel } from './items';
import { iconTexture } from './models/icons';
import { buildItem } from './models/items';
import type { Marker, OverlayTile } from './overlay-codes';
import { type Selection, shown } from './picking';
import { type Turn, turnAngle } from './turn';

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

/** How high over the floor the marker over a selected person floats, clear of a speech bubble (1.72, 0.62 across). */
const MARKER_HEIGHT = 2.35;
/** How high it floats over someone lying down, whose bubble sits at 1.0. */
const MARKER_LYING = 1.6;

/** A small chevron pointing down, wide side up, for the marker over a selected person. */
function chevron(): THREE.BufferGeometry {
  return new THREE.ConeGeometry(0.2, 0.36, 4).rotateX(Math.PI);
}

/** How long, in seconds, the preview of what is in hand shakes as a click with it is turned down, and how far. */
const NUDGE_SECONDS = 0.24;
const NUDGE_REACH = 0.12;
/** Which way across the screen the preview shakes, before the camera is turned. */
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UPRIGHT = new THREE.Vector3(0, 1, 0);

/**
 * How far across the screen the preview of what is in hand is shaken `age` seconds into a refusal: back and forth,
 * dying away.
 */
export function nudgeOffset(age: number): number {
  if (age < 0 || age >= NUDGE_SECONDS) return 0;
  const f = age / NUDGE_SECONDS;
  return Math.sin(f * Math.PI * 6) * NUDGE_REACH * (1 - f);
}

/** Whether a selection is a person. */
const isPerson = (sel: Selection | null): sel is { kind: 'guest' | 'staff' | 'visitor'; id: number } =>
  sel?.kind === 'guest' || sel?.kind === 'staff' || sel?.kind === 'visitor';

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
  /** The preview of what is in hand, its tiles and its door, all shaken together when a click with it is turned down. */
  private preview = new THREE.Group();
  /** When the last refusal's shake started, on the scene's clock, and the time the scene was last drawn at. */
  private nudgedAt = -Infinity;
  private now = 0;
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
  /** The ring again, faint, drawn only where something stands between it and the camera. */
  private ringBehind: THREE.Mesh;
  /** The chevron bobbing over a selected person, drawn over everything. */
  private marker: THREE.Mesh;
  /** What a click would select now, which glows a little, or null. */
  hovered: Selection | null = null;
  /** The model a person or item is drawn with, which the view sets once its layers are made. */
  find: (sel: Selection) => THREE.Object3D | undefined = () => undefined;
  /** Copies of the hovered model's parts, drawn over them to brighten them, and the model they are of. */
  private glow = new THREE.Group();
  private glowOf: THREE.Object3D | undefined;
  private glowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    // drawn at the depth of the parts it covers, nudged toward the camera so they do not flicker through it
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  /** A faint sheet over the floor of a hovered room. */
  private roomGlow: THREE.Mesh;
  /** How far round the camera is, which a wall item's preview is placed against its wall at. */
  turn: Turn = 0;

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
    this.scene.add(this.preview);
    this.preview.add(this.overlay);

    this.doorMarker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.16), this.ghostMats.ok);
    this.doorMarker.visible = false;
    this.preview.add(this.doorMarker);

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
    this.preview.add(this.frontMarker);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.52, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);
    // drawn only where the ring is further away than what is already drawn there, such as a desk in front of it
    this.ringBehind = new THREE.Mesh(
      this.ring.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffd23f,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        depthFunc: THREE.GreaterDepth,
      }),
    );
    this.ringBehind.renderOrder = 3;
    this.ring.add(this.ringBehind);

    this.marker = new THREE.Mesh(
      chevron(),
      new THREE.MeshStandardMaterial({
        color: 0xffd23f,
        emissive: 0x7a5c00,
        roughness: 0.5,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.marker.visible = false;
    // over the speech bubbles (10), which it floats above anyway
    this.marker.renderOrder = 12;
    this.scene.add(this.marker);

    this.glow.renderOrder = 4;
    this.scene.add(this.glow);
    this.roomGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false }),
    );
    this.roomGlow.visible = false;
    this.roomGlow.renderOrder = 2;
    this.scene.add(this.roomGlow);
  }

  /** Shake the preview of what is in hand, to show a click with it was turned down. */
  nudge() {
    this.nudgedAt = this.now;
  }

  /** Whether the marker over a selected person is showing. */
  get markerShown(): boolean {
    return this.marker.visible;
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
      if (this.ghost) this.preview.remove(this.ghost.group);
      this.ghost = null;
      return;
    }
    // a rug is built afresh in each pattern; the preview is see-through already, on a low wall as on a tall one
    const hung = onWall(spec.type) ? hangPlace(this.sim.world, spec, this.turn) : null;
    const key = `${spec.type}:${spec.pattern ?? ''}`;
    if (this.ghost?.key !== key) {
      if (this.ghost) this.preview.remove(this.ghost.group);
      const group = buildItem(spec.type, { pattern: spec.pattern, center: this.sim.s.center });
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      this.preview.add(group);
      this.ghost = { group, key };
    }
    const m = spec.ok ? this.ghostMats.ok : this.ghostMats.bad;
    this.ghost.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = m;
    });
    if (hung) placeHung(this.ghost.group, hung);
    else placeItemModel(this.ghost.group, spec.type, spec.x, spec.y, spec.rot);
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
      sprite.material.map = iconTexture(m.icon, true);
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

  /**
   * Put the ring around whatever is selected, pulsing gently around a person with a chevron bobbing over them, and
   * brighten whatever a click would select.
   */
  updateRing(t: number) {
    this.now = t;
    const sel = this.selected;
    this.ring.visible = false;
    this.marker.visible = false;
    if (sel && isPerson(sel)) {
      const c = this.sim.char(sel.id);
      if (c) {
        this.ring.visible = true;
        this.ring.position.set(c.x, 0.04, c.y);
        this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
        this.marker.visible = true;
        const h = c.pose === 'lie' ? MARKER_LYING : MARKER_HEIGHT;
        this.marker.position.set(c.x, h + Math.sin(t * 3) * 0.06, c.y);
        this.marker.rotation.y = t * 1.5;
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
    this.shake(t);
    this.updateGlow();
  }

  /** Shake the preview across the screen while a refusal's shake lasts, and put it back after. */
  private shake(t: number) {
    const off = nudgeOffset(t - this.nudgedAt);
    if (!off && this.preview.position.lengthSq() === 0) return;
    this.preview.position.copy(SCREEN_RIGHT).applyAxisAngle(UPRIGHT, turnAngle(this.turn)).multiplyScalar(off);
  }

  /** Brighten the person or item a click would select, or lay a faint sheet over the room's floor. */
  private updateGlow() {
    const hov = this.hovered;
    const model = hov && (isPerson(hov) || hov.kind === 'item') ? this.find(hov) : undefined;
    if (model !== this.glowOf) {
      this.glowOf = model;
      this.glow.clear();
      model?.traverse((o) => {
        const part = o as Partial<THREE.InstancedMesh> & THREE.Mesh;
        if (!(o as Partial<THREE.Mesh>).isMesh || part.isInstancedMesh) return;
        if (!(part.material as THREE.Material).visible) return;
        const copy = new THREE.Mesh(part.geometry, this.glowMat);
        copy.matrixAutoUpdate = false;
        copy.frustumCulled = false;
        // a person's parts are posed as the scene is drawn, so the copy takes up where the part is only then
        /** Take up where the part is just as it is drawn. */
        copy.onBeforeRender = function follow() {
          this.matrixWorld.copy(part.matrixWorld);
        };
        copy.userData.part = part;
        this.glow.add(copy);
      });
    }
    for (const copy of this.glow.children) copy.visible = shown(copy.userData.part as THREE.Object3D);
    const room = hov?.kind === 'room' ? this.sim.s.rooms.find((r) => r.id === hov.id) : undefined;
    this.roomGlow.visible = !!room;
    if (room) {
      this.roomGlow.position.set(room.x + room.w / 2, 0.03, room.y + room.h / 2);
      this.roomGlow.scale.set(room.w, 1, room.h);
    }
  }
}
