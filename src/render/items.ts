// Items: their models, the small effects that bring them to life, and the progress bars over busy stations.

import * as THREE from 'three';

import type { SceneIconId } from '../core/data';
import { DIRT_FILTHY, HAMPER_SIZE, ITEMS, type ItemType } from '../core/data';
import type { Sim } from '../core/sim/sim';
import { itemHeat } from '../core/sim/warmth';
import type { Item } from '../core/state/types';
import { itemCenter, onWall } from '../core/world';
import { animateCeremony } from './ceremony';
import { disposeOwned, owned } from './disposal';
import { applyGag } from './gags/apply';
import { gagFrame } from './gags/beats';
import { GagClock } from './gags/clock';
import { GAGS } from './gags/scripts';
import { ghostHung, hangPlace, placeHung } from './hung';
import { animateCues, type CueCondition, NOISE_CUE, usedNoise, wearLight } from './item-cues';
import { iconTexture } from './models/icons';
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
 * What an item's moving parts follow: how watered or hot it is (or how full, for a hamper), how dirty it is or its
 * linens, whether it is scanning, how worn, whether a guest is using it and how hard it is heating or cooling.
 */
export interface ItemCondition extends CueCondition {
  water: number;
  scanning: boolean;
  /** How many trophies the center has won, each shown as a cup in a trophy cabinet. */
  trophies: number;
}

/** The green of a plant's leaves and of a living wall's moss when watered, as red, green and blue. */
const LEAF = [0.34, 0.66, 0.35] as const;
const MOSS = [0.37, 0.62, 0.29] as const;
/** The brown they dry out to. */
const DRY = [0.62, 0.5, 0.25] as const;

/** The color of something living, from its own green when watered toward brown as it dries out. */
function dryColor(water: number, green: readonly [number, number, number]): THREE.Color {
  const k = Math.min(1, water / 40);
  return new THREE.Color().setRGB(
    green[0] * k + DRY[0] * (1 - k),
    green[1] * k + DRY[1] * (1 - k),
    green[2] * k + DRY[2] * (1 - k),
    THREE.SRGBColorSpace,
  );
}

/**
 * Wilting leaves, glowing stones, a sweeping scanner ring, drifting smoke, blinking lights, grubby linens, chimes and
 * a clock's hands, fluttering flags and browning moss; and the cues of wear, dirt, noise and warmth (see item-cues.ts).
 */
export function animateItemParts(model: THREE.Object3D, it: ItemCondition, t: number) {
  const { leaf, glow, ring, orb, puffs, led, cups, linens, heap, flames, chimes, hands, flags, moss } = partsOf(model);
  if (leaf) {
    // a plant browns and droops as it dries out
    leaf.color.copy(dryColor(it.water, LEAF));
    model.scale.y = 0.82 + 0.18 * Math.min(1, it.water / 40);
  }
  if (glow) glow.emissiveIntensity = (it.water / 100) * 1.4;
  if (ring) {
    ring.position.y = it.scanning ? 0.8 + Math.sin(t * 3.5) * 0.6 : 0.2;
    ring.visible = it.wear < 100;
  }
  if (orb) orb.position.y = 0.9 + Math.sin(t * 3 + it.id) * 0.035;
  // drifting smoke or scent
  puffs?.children.forEach((p, i) => {
    const f = (t * 0.5 + i / 3 + it.id * 0.13) % 1;
    p.position.set(Math.sin(f * 5 + i) * 0.08, f * 0.6, 0);
    p.scale.setScalar(0.4 + f * 0.9);
  });
  if (led) wearLight(led, it.wear, it.id, Math.sin(t * 5 + it.id) > 0 ? 1.4 : 0.1, t);
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
  // prayer flags lift and settle in turn, as a breeze runs along the string
  flags?.forEach((f, i) => (f.rotation.x = -0.25 - Math.sin(t * 2.2 - i * 0.7 + it.id) * 0.2));
  // a living wall browns as it dries out, as a plant does, but stays where it hangs
  if (moss) moss.color.copy(dryColor(it.water, MOSS));
  animateCues(model, it, t);
}

// every progress bar is drawn with the same few pieces, so a bar costs nothing to make or throw away
const BAR_BACK = new THREE.BoxGeometry(1.06, 0.2, 0.05);
const BAR_FILL = new THREE.BoxGeometry(1, 0.14, 0.07);
const BAR_BACK_MAT = new THREE.MeshBasicMaterial({ color: 0x2f4858 });
const BAR_FILL_MAT = new THREE.MeshBasicMaterial({ color: 0x3ddc84 });

/** How high a progress bar sits over most stations, and the most a marker over an item bobs below it. */
const BAR_Y = 2.1;
const MARKER_Y = 1.9;

export class ItemsLayer {
  private items = new Map<number, { group: THREE.Group; key: string; top: number }>();
  private bars = new Map<number, { group: THREE.Group; fill: THREE.Mesh }>();
  /** How far round the camera is, which says which walls stand tall for what hangs on them. */
  private turn: Turn = 0;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
    private gags: GagClock = new GagClock(),
  ) {}

  /** Every item's model, for picking. */
  models(): THREE.Object3D[] {
    return [...this.items.values()].map((i) => i.group);
  }

  /** Turn the camera: what hangs on a wall shows as a ghost of itself on the walls now cut low, and solid on the rest. */
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
      const key = `${it.type},${it.x},${it.y},${it.rot},${it.level},${it.pattern ?? ''},${hung ? hung.tall : ''}`;
      if (this.items.get(it.id)?.key === key) continue;
      const old = this.items.get(it.id);
      if (old) {
        this.scene.remove(old.group);
        disposeOwned(old.group);
      }
      const model = buildItem(it.type, { pattern: it.pattern, center: this.sim.s.center });
      const group = hung && !hung.tall ? ghostHung(model) : model;
      const plate = upgradePlate(it.type, it.level);
      if (plate) group.add(plate);
      if (hung) placeHung(group, hung);
      else placeItemModel(group, it.type, it.x, it.y, it.rot);
      group.traverse((o) => (o.userData.itemId = it.id));
      this.scene.add(group);
      // a machine stands taller than anything else, so its bar and markers go over the top of it
      const top = new THREE.Box3().setFromObject(model).max.y;
      this.items.set(it.id, { group, key, top });
    }
    for (const [id, it] of this.items) {
      if (liveItems.has(id)) continue;
      this.scene.remove(it.group);
      disposeOwned(it.group);
      this.items.delete(id);
      // and its bar, in case it was taken away mid-session
      const bar = this.bars.get(id);
      if (bar) this.scene.remove(bar.group);
      this.bars.delete(id);
    }
    this.gags.prune(liveItems);
  }

  /** Update what changes from frame to frame: effects, progress bars and markers for broken or filthy items. */
  animate(t: number) {
    const busy = new Set<number>();
    for (const it of this.sim.s.items) {
      const model = this.items.get(it.id)?.group;
      if (!model) continue;
      this.effects(it, model, t);
      this.marker(model, it, 'wrench', 'marker-broken', it.wear >= 100, t);
      // stale linens show on the table itself, not as flies over it
      this.marker(model, it, 'flies', 'marker-filthy', it.dirt >= DIRT_FILTHY && !ITEMS[it.type].linens, t);
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
        type: it.type,
        water: it.water,
        dirt: it.dirt,
        wear: it.wear,
        scanning: it.serving > 0 && it.progress > 0,
        inUse: this.guestUsing(it),
        running: this.running(it),
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
    // a machine plays its gag, in step with the guest inside it
    const script = GAGS[it.type];
    const input = script && this.gags.input(this.sim, it, t);
    if (script && input) applyGag(model, gagFrame(script, input), t);
  }

  /** How high over an item its bar and markers go: as usual, or clear of the top of a machine, which stands taller. */
  private over(it: Item, usual: number): number {
    if (!ITEMS[it.type].machine) return usual;
    return Math.max(usual, (this.items.get(it.id)?.top ?? 0) + 0.35);
  }

  /**
   * Whether a guest is using something loud: at its station or in one of its places, or, for something that sounds in
   * a group session, while the session plays. Quiet things are not asked.
   */
  private guestUsing(it: Item): boolean {
    if (usedNoise(it.type) < NOISE_CUE) return false;
    if (ITEMS[it.type].sessionNoise) return this.sim.sessionPlaying(it);
    if (it.serving && this.sim.guest(it.serving)) return true;
    return it.users.some((id) => id > 0 && !!this.sim.guest(id));
  }

  /**
   * How hard a heater or air conditioner is warming or cooling the air, from 0 to 1: not at all once broken, in a power
   * cut or a freeze, or with the weather switched off, and on a thermostat only as hard as the weather calls for.
   */
  private running(it: Item): number {
    if (!this.sim.s.weatherOn || !itemHeat(it) || this.sim.world.stoppedByMishap(it)) return 0;
    return this.sim.thermostatShare(it);
  }

  /** Bob a marker over an item that needs a Caretaker: a wrench when broken, flies when filthy. */
  private marker(
    model: THREE.Object3D,
    it: Item,
    key: 'wrench' | 'flies',
    icon: SceneIconId,
    show: boolean,
    t: number,
  ) {
    const parts = partsOf(model);
    let sprite = parts[key];
    if (show && !sprite) {
      sprite = new THREE.Sprite(
        owned(new THREE.SpriteMaterial({ map: iconTexture(icon, true), transparent: true, depthTest: false })),
      );
      sprite.scale.setScalar(0.7);
      sprite.renderOrder = 9;
      sprite.userData.itemId = it.id;
      model.add(sprite);
      parts[key] = sprite;
    }
    if (sprite) {
      sprite.visible = show;
      sprite.position.y = this.over(it, MARKER_Y) + Math.sin(t * 4 + it.id) * 0.06;
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
      group.position.set(cx, this.over(it, BAR_Y), cy);
      this.scene.add(group);
      bar = { group, fill };
      this.bars.set(it.id, bar);
    }
    const p = Math.min(1, it.progress);
    bar.fill.scale.x = Math.max(0.02, p);
    bar.fill.position.x = -(1 - p) / 2;
  }
}
