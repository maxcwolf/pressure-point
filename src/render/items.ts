// Items: their models, the small effects that bring them to life, and the progress bars over busy stations.

import * as THREE from 'three';

import { DIRT_FILTHY, type ItemType } from '../core/data';
import type { Sim } from '../core/sim/sim';
import type { Item } from '../core/state/types';
import { itemCenter } from '../core/world';
import { disposeOwned, owned } from './disposal';
import { emojiTexture } from './models/emoji';
import { buildItem } from './models/items';
import { partsOf } from './models/parts';

/** Position and turn an item's model to match its tile and rotation. */
export function placeItemModel(model: THREE.Object3D, type: ItemType, x: number, y: number, rot: number) {
  const [cx, cy] = itemCenter({ type, x, y, rot });
  model.position.set(cx, 0, cy);
  model.rotation.y = (-rot * Math.PI) / 2;
}

// every progress bar is drawn with the same few pieces, so a bar costs nothing to make or throw away
const BAR_BACK = new THREE.BoxGeometry(1.06, 0.2, 0.05);
const BAR_FILL = new THREE.BoxGeometry(1, 0.14, 0.07);
const BAR_BACK_MAT = new THREE.MeshBasicMaterial({ color: 0x2f4858 });
const BAR_FILL_MAT = new THREE.MeshBasicMaterial({ color: 0x3ddc84 });

export class ItemsLayer {
  private items = new Map<number, { group: THREE.Group; key: string }>();
  private bars = new Map<number, { group: THREE.Group; fill: THREE.Mesh }>();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** Every item's model, for picking. */
  models(): THREE.Object3D[] {
    return [...this.items.values()].map((i) => i.group);
  }

  /** Build a model for any item that is new or has moved, and remove the ones that are gone. */
  sync() {
    const liveItems = new Set<number>();
    for (const it of this.sim.s.items) {
      liveItems.add(it.id);
      const key = `${it.type},${it.x},${it.y},${it.rot}`;
      if (this.items.get(it.id)?.key === key) continue;
      const old = this.items.get(it.id);
      if (old) {
        this.scene.remove(old.group);
        disposeOwned(old.group);
      }
      const group = buildItem(it.type);
      placeItemModel(group, it.type, it.x, it.y, it.rot);
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
      this.marker(model, it, 'flies', '🪰', it.dirt >= DIRT_FILTHY, t);
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

  /** The touches particular to each kind of item: wilting leaves, glowing stones, drifting smoke and so on. */
  private effects(it: Item, model: THREE.Object3D, t: number) {
    const { leaf, glow, ring, orb, session, puffs, led } = partsOf(model);
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
      const scanning = it.serving > 0 && it.progress > 0;
      ring.position.y = scanning ? 0.8 + Math.sin(t * 3.5) * 0.6 : 0.2;
      ring.visible = it.wear < 100;
    }
    if (orb) orb.position.y = 0.9 + Math.sin(t * 3 + it.id) * 0.035;
    // props on the guest during a session, but only when it is being done properly:
    // no hot stones without a hot warmer, no cups from untrained hands
    if (session) {
      const guest = it.progress > 0.04 ? this.sim.guest(it.serving) : undefined;
      const mod = guest?.state === 'served' ? this.sim.modalityOf(guest) : undefined;
      const showing = mod && !this.sim.deliveryProblem(it, this.sim.staff(it.staffId), mod) ? mod.id : '';
      for (const [key, prop] of Object.entries(session)) prop.visible = key === showing;
    }
    // drifting smoke or scent
    puffs?.children.forEach((p, i) => {
      const f = (t * 0.5 + i / 3 + it.id * 0.13) % 1;
      p.position.set(Math.sin(f * 5 + i) * 0.08, f * 0.6, 0);
      p.scale.setScalar(0.4 + f * 0.9);
    });
    if (led) led.emissiveIntensity = Math.sin(t * 5 + it.id) > 0 ? 1.4 : 0.1;
  }

  /** Bob a marker over an item that needs a Janitor: a wrench when broken, flies when filthy. */
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
