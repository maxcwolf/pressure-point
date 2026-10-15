// The rival's storefront across the street: a one-story shop in franchise purple, with its name over the windows, a
// striped awning, and a banner for its sales.

import * as THREE from 'three';

import { RIVAL_NAME, SALE_DISCOUNT } from '../../core/data';
import { must } from '../../core/util';
import { mergeStill } from './merge';
import { mat, put, rbox, trimShadows } from './parts';

/** The shop's width, height and depth, in tiles. */
export const SHOP_W = 6;
export const SHOP_H = 2.3;
export const SHOP_D = 2.4;

const PURPLE = 0x7b4bb3;
const LIME = 0xb5d334;

/** The storefront, and the banner that shows while a sale is on. */
export interface Storefront {
  root: THREE.Group;
  sale: THREE.Object3D;
}

/** A board with words painted on its front, facing -z like the shop, from a canvas. */
function board(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * 128);
  c.height = Math.round(h * 128);
  const ctx = must(c.getContext('2d'), '2D canvas');
  paint(ctx, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const edge = mat(PURPLE);
  // a box's faces go +x, -x, +y, -y, +z, -z: the words go on the -z face, the front
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [
    edge,
    edge,
    edge,
    edge,
    edge,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
  ]);
}

/** Words centered on a canvas, as large as fit. */
function words(ctx: CanvasRenderingContext2D, text: string, cw: number, ch: number, color: string, weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${Math.round(ch * 0.6)}px Fredoka, "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cw / 2, ch / 2, cw * 0.92);
}

/** The rival's shop, its front facing the street toward -z, centered on its footprint. */
export function buildStorefront(): Storefront {
  const root = new THREE.Group();
  const wall = mat(0xf3eef8, 0.85);
  const trim = mat(PURPLE, 0.6);
  // the shop itself, with a flat roof and a purple band round the top
  put(root, rbox(SHOP_W, SHOP_H, SHOP_D, 0.04), wall, 0, SHOP_H / 2, 0);
  put(root, rbox(SHOP_W + 0.12, 0.22, SHOP_D + 0.12, 0.03), trim, 0, SHOP_H + 0.05, 0);
  const front = -SHOP_D / 2 - 0.03;
  // two big windows either side of a glass door, solid from across the street so they draw as one
  const glass = mat(0x9cc4d6, 0.15);
  for (const x of [-1.75, 1.75]) put(root, new THREE.BoxGeometry(1.9, 1.1, 0.04), glass, x, 1.05, front);
  put(root, new THREE.BoxGeometry(0.9, 1.6, 0.04), glass, 0, 0.8, front);
  put(root, new THREE.BoxGeometry(SHOP_W, 0.12, 0.08), trim, 0, 0.06, front);
  // a striped awning over the front, in alternating purple and lime
  const stripes = 8;
  const colors = [mat(PURPLE, 0.7), mat(LIME, 0.7)];
  for (let i = 0; i < stripes; i++) {
    const awning = put(
      root,
      new THREE.BoxGeometry(SHOP_W / stripes, 0.05, 0.7),
      colors[i % 2] ?? trim,
      -SHOP_W / 2 + (i + 0.5) * (SHOP_W / stripes),
      1.78,
      front - 0.32,
    );
    awning.rotation.x = -0.35;
  }
  // the name across the top of the front
  const sign = board(4.2, 0.5, (ctx, cw, ch) => {
    ctx.fillStyle = '#7b4bb3';
    ctx.fillRect(0, 0, cw, ch);
    words(ctx, RIVAL_NAME.toUpperCase(), cw, ch, '#f4ffd0');
  });
  sign.position.set(0, 2.08, front - 0.05);
  root.add(sign);
  mergeStill(root, 'storefront');
  // a banner on the lawn in front, out only while a sale is on
  const sale = board(2.2, 0.55, (ctx, cw, ch) => {
    ctx.fillStyle = '#e5564d';
    ctx.fillRect(0, 0, cw, ch);
    words(ctx, `SALE ${Math.round(SALE_DISCOUNT * 100)}% OFF`, cw, ch, '#ffffff');
  });
  sale.position.set(0, 0.75, front - 1.1);
  for (const x of [-0.95, 0.95]) put(sale, new THREE.CylinderGeometry(0.04, 0.04, 0.75), mat(0x6b6b6b), x, -0.37, 0);
  sale.visible = false;
  root.add(sale);
  root.userData = { sale };
  trimShadows(root);
  return { root, sale };
}
