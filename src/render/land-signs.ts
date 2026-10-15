// For Sale signs over the land next to the building, while the Land tab is open. They stand tall, so a plot behind
// one of the building's high back walls still shows.

import * as THREE from 'three';

import { must } from '../core/util';

/** How high above the ground a sign floats, and how big it is. */
const SIGN_Y = 2.7;
const SIGN_W = 2.2;
const SIGN_H = 0.75;

/** The sign's picture: FOR SALE on an amber board. */
function forSaleTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 88;
  const ctx = must(c.getContext('2d'), '2D canvas');
  ctx.fillStyle = '#2f4858';
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 88, 18);
  ctx.fill();
  ctx.fillStyle = '#f5b83d';
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 76, 14);
  ctx.fill();
  ctx.fillStyle = '#2f4858';
  ctx.font = '700 42px Fredoka, "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FOR SALE', 128, 47);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class LandSigns {
  private group = new THREE.Group();
  private material: THREE.SpriteMaterial | null = null;
  /** The spots the signs stand on now, as a key, so they are only laid out again when that changes. */
  private key = '';

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Stand a sign on each of these spots on the ground, or take them all down. */
  set(spots: readonly { x: number; z: number }[] | null) {
    const list = spots ?? [];
    const key = list.map((s) => `${s.x},${s.z}`).join('|');
    if (key === this.key) return;
    this.key = key;
    this.group.clear();
    if (!list.length) return;
    this.material ??= new THREE.SpriteMaterial({ map: forSaleTexture(), depthTest: false });
    for (const s of list) {
      const sprite = new THREE.Sprite(this.material);
      sprite.scale.set(SIGN_W, SIGN_H, 1);
      sprite.position.set(s.x, SIGN_Y, s.z);
      sprite.renderOrder = 2;
      this.group.add(sprite);
    }
  }
}
