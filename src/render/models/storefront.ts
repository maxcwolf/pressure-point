// The rival's storefront across the street: a one-story shop with a flat plum roof behind a low parapet, units on the
// roof, its name on a franchise-purple fascia over the windows, striped awnings, a paved forecourt, and a banner for
// its sales. The brand's purple is kept to the fascia and the awnings, so from the game's high camera the shop reads as
// a building across the street and not as a purple slab; in the mountains its roof is under snow, as everything is.

import * as THREE from 'three';

import { RIVAL_NAME, SALE_DISCOUNT } from '../../core/data';
import { must } from '../../core/util';
import { mergeStill } from './merge';
import { cyl, joined, mat, put, rbox, soft, trimShadows } from './parts';

/** The shop's width, height and depth, in tiles. */
export const SHOP_W = 6;
export const SHOP_H = 2.3;
export const SHOP_D = 2.4;

/** The franchise's purple, on the fascia, the awnings and the base along the front. */
const PURPLE = 0x7b4bb3;
/** The roof inside the parapet: a muted plum, the brand's color greyed down. */
const PLUM = 0x7d6c86;
/** The walls, the parapet and the units on the roof: a pale lilac render. */
const RENDER = 0xefeaf1;
/** Snow lying on the roof, as on the pines. */
const SNOW = 0xf4f8fb;
const GLAZING = 0x9cc4d6;

/** How far the forecourt reaches out in front of the shop, and past each end of it. */
const COURT_OUT = 1.7;
const COURT_END = 0.5;
/** How tall the parapet stands above the roof, and how thick it is. */
const PARAPET_H = 0.26;
const PARAPET_T = 0.14;

/** The storefront, and the banner that shows while a sale is on. */
export interface Storefront {
  root: THREE.Group;
  sale: THREE.Object3D;
}

let pavingMaterial: THREE.MeshStandardMaterial | undefined;

/**
 * The forecourt's paving: pale stone slabs half a meter square with darker joints between, one material shared by
 * every storefront, so the forecourt reads as laid paving on grass, sand, snow or the downtown's own grey paving.
 */
function paving(): THREE.MeshStandardMaterial {
  if (pavingMaterial) return pavingMaterial;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = must(c.getContext('2d'), '2D canvas');
  // four slabs to a meter's square, in two shades of stone, with joints round each
  const shades = ['#dcd4c6', '#d3cabb'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = shades[(i + (i >> 1)) % 2] ?? '#dcd4c6';
    ctx.fillRect((i % 2) * 32, (i >> 1) * 32, 32, 32);
  }
  ctx.fillStyle = '#b3aa9b';
  for (const at of [0, 32]) {
    ctx.fillRect(at, 0, 2, 64);
    ctx.fillRect(0, at, 64, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  pavingMaterial = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78 });
  return pavingMaterial;
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

/**
 * The rival's shop, its front facing the street toward -z, centered on its footprint, on its forecourt. `snowy` lays
 * snow on its roof, for a center in the mountains.
 */
export function buildStorefront(snowy = false): Storefront {
  const root = new THREE.Group();
  const wall = mat(RENDER, 0.85);
  const brand = mat(PURPLE);
  const W = SHOP_W;
  const D = SHOP_D;
  const front = -D / 2;
  // the forecourt: flat paving out in front and a little past each end, drawn without a shadow of its own
  const courtW = W + 2 * COURT_END;
  const courtD = D + COURT_OUT + 0.3;
  const court = put(root, rbox(courtW, 0.06, courtD, 0.02), paving(), 0, 0.01, (0.3 - COURT_OUT) / 2);
  court.castShadow = false;
  // a meter of the texture to each meter of the forecourt
  must(paving().map, 'paving texture').repeat.set(courtW, courtD);
  // the shop itself, its roof inside a parapet that runs round the top
  put(root, soft(W, SHOP_H, D), wall, 0, SHOP_H / 2, 0);
  put(
    root,
    rbox(W - 2 * PARAPET_T, 0.04, D - 2 * PARAPET_T, 0.012),
    snowy ? mat(SNOW, 0.6) : mat(PLUM, 0.75),
    0,
    SHOP_H + 0.01,
    0,
  );
  const top = SHOP_H + PARAPET_H / 2 - 0.02;
  for (const z of [-1, 1]) put(root, soft(W, PARAPET_H, PARAPET_T), wall, 0, top, z * (D / 2 - PARAPET_T / 2));
  for (const x of [-1, 1])
    put(root, soft(PARAPET_T, PARAPET_H, D - 2 * PARAPET_T), wall, x * (W / 2 - PARAPET_T / 2), top, 0);
  // the units on the roof: a big air handler toward the back and a smaller one beside it, in the render of the walls
  put(root, soft(1.1, 0.42, 0.75), wall, 1.3, SHOP_H + 0.21, 0.3);
  put(root, soft(0.6, 0.32, 0.55), wall, -1.5, SHOP_H + 0.16, 0.35);
  // the fascia across the top of the front, in the brand's purple, with the name on it, and a purple base below
  put(root, soft(W + 0.04, 0.62, 0.12), brand, 0, SHOP_H - 0.06, front - 0.03);
  put(root, soft(W + 0.02, 0.14, 0.08), brand, 0, 0.07, front - 0.02);
  // two big windows either side of a glass door, solid from across the street so they draw as one, each with a sill
  const glass = mat(GLAZING, 0.15);
  for (const x of [-1.75, 1.75]) {
    put(root, rbox(1.9, 1.05, 0.05, 0.015), glass, x, 1.0, front - 0.01);
    put(root, soft(2.0, 0.07, 0.14), wall, x, 0.44, front - 0.05);
    put(root, soft(0.07, 1.05, 0.08), wall, x, 1.0, front - 0.03);
  }
  put(root, rbox(0.9, 1.55, 0.05, 0.015), glass, 0, 0.78, front - 0.01);
  /** A striped awning from x0 to x1 across the front, in n stripes, purple and white in turn. */
  const stripe = (x0: number, x1: number, n: number) => {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const awning = put(
        root,
        rbox(w, 0.05, 0.62, 0.012),
        i % 2 ? wall : brand,
        x0 + (i + 0.5) * w,
        1.72,
        front - 0.29,
      );
      awning.rotation.x = -0.38;
    }
  };
  stripe(-2.75, -0.75, 5);
  stripe(-0.5, 0.5, 3);
  stripe(0.75, 2.75, 5);
  // the name across the fascia
  const sign = board(3.6, 0.46, (ctx, cw, ch) => {
    ctx.fillStyle = '#7b4bb3';
    ctx.fillRect(0, 0, cw, ch);
    words(ctx, RIVAL_NAME.toUpperCase(), cw, ch, '#f4ffd0');
  });
  sign.position.set(0, SHOP_H - 0.06, front - 0.1);
  root.add(sign);
  mergeStill(root, snowy ? 'storefront-snowy' : 'storefront');
  // a banner on the forecourt in front, out only while a sale is on
  const sale = board(2.2, 0.55, (ctx, cw, ch) => {
    ctx.fillStyle = '#e5564d';
    ctx.fillRect(0, 0, cw, ch);
    words(ctx, `SALE ${Math.round(SALE_DISCOUNT * 100)}% OFF`, cw, ch, '#ffffff');
  });
  sale.position.set(0, 0.75, front - 1.1);
  const pole = cyl(0.04, 0.04, 0.75);
  put(
    sale,
    joined('sale-poles', [
      [pole, -0.95, 0, 0],
      [pole, 0.95, 0, 0],
    ]),
    mat(0x6b6b6b),
    0,
    -0.37,
    0,
  );
  sale.visible = false;
  root.add(sale);
  root.userData = { sale };
  trimShadows(root);
  return { root, sale };
}
