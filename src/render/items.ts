// Items: their models, the small effects that bring them to life, and the progress bars over busy stations.

import * as THREE from 'three';

import { DIRT_FILTHY, HAMPER_SIZE, ITEMS, type ItemType } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Item } from '../core/state/types';
import { itemCenter, onWall } from '../core/world';
import { animateCeremony } from './ceremony';
import { disposeOwned, owned } from './disposal';
import { buildHungChip, hangPlace, placeHung } from './hung';
import { emojiTexture } from './models/emoji';
import { buildItem } from './models/items';
import { soilLinens } from './models/linens';
import { partsOf } from './models/parts';
import { upgradePlate } from './models/plate';
import type { Turn } from './turn';

/** Position and turn an item's model to match its tile and rotation. */
export function placeItemModel(model: THREE.Object3D, type: ItemType, x: number, y: number, rot: number) {
  const [cx, cy] = itemCenter({ type, x, y, rot });
  model.position.set(cx, 0, cy);
  model.rotation.y = (-rot * Math.PI) / 2;
}

/**
 * What an item's moving parts follow: how watered or hot it is (or how full, for a hamper), how soiled its linens,
 * whether it is scanning, whether it has broken.
 */
export interface ItemCondition {
  id: number;
  water: number;
  dirt: number;
  scanning: boolean;
  broken: boolean;
  /** How many trophies the center has won, each shown as a cup in a trophy cabinet. */
  trophies: number;
}

/**
 * Wilting leaves, glowing stones, a sweeping scanner ring, drifting smoke, blinking lights, grubby linens, chimes and
 * a clock's hands.
 */
export function animateItemParts(model: THREE.Object3D, it: ItemCondition, t: number) {
  const { leaf, glow, ring, orb, puffs, led, cups, linens, heap, flames, chimes, hands } = partsOf(model);
  if (leaf) {
    // a plant browns and droops as it dries out
    const k = Math.min(1, it.water / 40);
    leaf.color.setRGB(
      0.34 * k + 0.62 * (1 - k),
      0.66 * k + 0.5 * (1 - k),
      0.35 * k + 0.25 * (1 - k),
      THREE.SRGBColorSpace,
    );
    model.scale.y = 0.82 + 0.18 * k;
  }
  if (glow) glow.emissiveIntensity = (it.water / 100) * 1.4;
  if (ring) {
    ring.position.y = it.scanning ? 0.8 + Math.sin(t * 3.5) * 0.6 : 0.2;
    ring.visible = !it.broken;
  }
  if (orb) orb.position.y = 0.9 + Math.sin(t * 3 + it.id) * 0.035;
  // drifting smoke or scent
  puffs?.children.forEach((p, i) => {
    const f = (t * 0.5 + i / 3 + it.id * 0.13) % 1;
    p.position.set(Math.sin(f * 5 + i) * 0.08, f * 0.6, 0);
    p.scale.setScalar(0.4 + f * 0.9);
  });
  if (led) led.emissiveIntensity = Math.sin(t * 5 + it.id) > 0 ? 1.4 : 0.1;
  cups?.forEach((cup, i) => (cup.visible = i < it.trophies));
  if (linens) soilLinens(linens, it.dirt);
  if (heap) {
    // the soiled linens rise up the basket as it fills
    const full = Math.min(1, it.water / HAMPER_SIZE);
    heap.visible = full > 0;
    heap.position.y = 0.45 + full * 0.27;
  }
  // each flame leaps and dies back on its own beat
  flames?.forEach((f, i) => {
    f.scale.y = 0.8 + Math.sin(t * (7 + i * 1.7) + i * 2 + it.id) * 0.2 + Math.sin(t * 13 + i) * 0.08;
  });
  // chimes sway in a breeze nobody else can feel, each tube a little out of step
  chimes?.forEach((c, i) => {
    c.rotation.z = Math.sin(t * 1.6 + i * 1.3 + it.id) * 0.12;
    c.rotation.x = Math.sin(t * 1.1 + i * 0.7) * 0.08;
  });
  // a clock's hands go round faster than the real thing, so it can be seen to be going
  hands?.forEach((h, i) => (h.rotation.z = -(t + it.id * 7) * (i ? 0.01 : 0.12)));
}

// every progress bar is drawn with the same few pieces, so a bar costs nothing to make or throw away
const BAR_BACK = new THREE.BoxGeometry(1.06, 0.2, 0.05);
const BAR_FILL = new THREE.BoxGeometry(1, 0.14, 0.07);
const BAR_BACK_MAT = new THREE.MeshBasicMaterial({ color: 0x2f4858 });
const BAR_FILL_MAT = new THREE.MeshBasicMaterial({ color: 0x3ddc84 });

export class ItemsLayer {
  private items = new Map<number, { group: THREE.Group; key: string }>();
  private bars = new Map<number, { group: THREE.Group; fill: THREE.Mesh }>();
  /** How far round the camera is, which says which walls stand tall for what hangs on them. */
  private turn: Turn = 0;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** Every item's model, for picking. */
  models(): THREE.Object3D[] {
    return [...this.items.values()].map((i) => i.group);
  }

  /** Turn the camera: what hangs on a wall shows as a chip on the walls now cut low, and its model on the rest. */
  setTurn(turn: Turn) {
    this.turn = turn;
    this.sync();
  }

  /** Build a model for any item that is new, has moved or been upgraded, and remove the ones that are gone. */
  sync() {
    const liveItems = new Set<number>();
    for (const it of this.sim.s.items) {
      liveItems.add(it.id);
      const hung = onWall(it.type) ? hangPlace(this.sim.world, it, this.turn) : null;
      const key = `${it.type},${it.x},${it.y},${it.rot},${it.level},${it.pattern ?? ''},${hung ? `${hung.tall}${hung.thick}` : ''}`;
      if (this.items.get(it.id)?.key === key) continue;
      const old = this.items.get(it.id);
      if (old) {
        this.scene.remove(old.group);
        disposeOwned(old.group);
      }
      const group =
        hung && !hung.tall
          ? buildHungChip(it.type, hung)
          : buildItem(it.type, { pattern: it.pattern, center: this.sim.s.center });
      const plate = upgradePlate(it.type, it.level);
      if (plate) group.add(plate);
      if (hung) placeHung(group, hung);
      else placeItemModel(group, it.type, it.x, it.y, it.rot);
      group.traverse((o) => (o.userData.itemId = it.id));
      this.scene.add(group);
      this.items.set(it.id, { group, key });
    }
    for (const [id, it] of this.items) {
      if (liveItems.has(id)) continue;
      this.scene.remove(it.group);
      disposeOwned(it.group);
      this.items.delete(id);
    }
  }

  /** Update what changes from frame to frame: effects, progress bars and markers for broken or filthy items. */
  animate(t: number) {
    const busy = new Set<number>();
    for (const it of this.sim.s.items) {
      const model = this.items.get(it.id)?.group;
      if (!model) continue;
      this.effects(it, model, t);
      this.marker(model, it, 'wrench', '🔧', it.wear >= 100, t);
      // stale linens show on the table itself, not as flies over it
      this.marker(model, it, 'flies', '🪰', it.dirt >= DIRT_FILTHY && !ITEMS[it.type].linens, t);
      if (it.serving && it.progress > 0) {
        busy.add(it.id);
        this.bar(it);
      }
    }
    for (const [id, bar] of this.bars) {
      if (busy.has(id)) continue;
      this.scene.remove(bar.group);
      this.bars.delete(id);
    }
  }

  /** The touches particular to each kind of item, and the props laid on a guest during a session. */
  private effects(it: Item, model: THREE.Object3D, t: number) {
    animateItemParts(
      model,
      {
        id: it.id,
        water: it.water,
        dirt: it.dirt,
        scanning: it.serving > 0 && it.progress > 0,
        broken: it.wear >= 100,
        trophies: this.sim.s.trophies.length,
      },
      t,
    );
    const { session, ceremony } = partsOf(model);
    // props on the guest during a session, but only when it is being done properly:
    // no hot stones without a hot warmer, no cups from untrained hands
    if (session) {
      const guest = it.progress > 0.04 ? this.sim.guest(it.serving) : undefined;
      const mod = guest?.state === 'served' ? this.sim.modalityOf(guest) : undefined;
      const showing = mod && !this.sim.deliveryProblem(it, this.sim.staff(it.staffId), mod) ? mod.id : '';
      for (const [key, prop] of Object.entries(session)) prop.visible = key === showing;
    }
    if (ceremony) animateCeremony(ceremony, it.progress, t, it.id);
  }

  /** Bob a marker over an item that needs a Caretaker: a wrench when broken, flies when filthy. */
  private marker(model: THREE.Object3D, it: Item, key: 'wrench' | 'flies', emoji: string, show: boolean, t: number) {
    const parts = partsOf(model);
    let sprite = parts[key];
    if (show && !sprite) {
      sprite = new THREE.Sprite(
        owned(new THREE.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthTest: false })),
      );
      sprite.scale.setScalar(0.7);
      sprite.renderOrder = 9;
      sprite.userData.itemId = it.id;
      model.add(sprite);
      parts[key] = sprite;
    }
    if (sprite) {
      sprite.visible = show;
      sprite.position.y = 1.9 + Math.sin(t * 4 + it.id) * 0.06;
    }
  }

  /** Show how far along the service at a station is. */
  private bar(it: Item) {
    let bar = this.bars.get(it.id);
    if (!bar) {
      const group = new THREE.Group();
      const back = new THREE.Mesh(BAR_BACK, BAR_BACK_MAT);
      const fill = new THREE.Mesh(BAR_FILL, BAR_FILL_MAT);
      group.add(back, fill);
      group.rotation.y = Math.PI / 4;
      const [cx, cy] = itemCenter(it);
      group.position.set(cx, 2.1, cy);
      this.scene.add(group);
      bar = { group, fill };
      this.bars.set(it.id, bar);
    }
    const p = Math.min(1, it.progress);
    bar.fill.scale.x = Math.max(0.02, p);
    bar.fill.position.x = -(1 - p) / 2;
  }
}
