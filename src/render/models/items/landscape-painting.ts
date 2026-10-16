// The Landscape Painting model, of each center's own view.

import type * as THREE from 'three';

import type { CenterId } from '../../../core/data';
import { cyl, mat, put, rbox, sph } from '../parts';
import { HANG_Y } from './wall';

/** The canvas: how wide and tall it is, and how far out from the wall its face is. */
const W = 0.64;
const H = 0.46;
const FACE = 0.042;

/** Paint a flat patch on the canvas, centered at x, y on it, a little further out for each layer up. */
function patch(g: THREE.Group, w: number, h: number, color: number, x: number, y: number, layer = 1) {
  return put(g, rbox(w, h, 0.004, 0.002), mat(color, 0.95), x, HANG_Y + y, FACE + layer * 0.002);
}

/** A tree, `s` times the usual size: a trunk and a round crown, or a pine's cone, standing on the canvas at x, y. */
function tree(g: THREE.Group, x: number, y: number, s: number, color: number, pine = false) {
  patch(g, 0.02 * s, 0.06 * s, 0x6b4a2e, x, y + 0.03 * s, 3);
  const crown = pine
    ? put(g, cyl(0, 0.045 * s, 0.13 * s, 3), mat(color, 0.95), x, HANG_Y + y + 0.11 * s, FACE + 0.008)
    : put(g, sph(0.045 * s, 10), mat(color, 0.95), x, HANG_Y + y + 0.08 * s, FACE + 0.008);
  crown.scale.z = pine ? 0.08 : 0.12;
}

/** Each center's view: the sky, the land, and what stands on it. */
const VIEWS: Record<CenterId, (g: THREE.Group) => void> = {
  /** Rolling green hills under a summer sun. */
  sandbox: (g) => {
    patch(g, W, H * 0.6, 0x9fd3ec, 0, H * 0.2, 1);
    patch(g, W, H * 0.4, 0x8cc26a, 0, -H * 0.3, 2);
    patch(g, W * 0.6, H * 0.22, 0x6faa52, -W * 0.18, -H * 0.12, 2);
    put(g, sph(0.035, 10), mat(0xffd65a, 0.6), W * 0.3, HANG_Y + H * 0.3, FACE + 0.006).scale.z = 0.12;
  },
  /** A weeping willow over a pond. */
  willow: (g) => {
    patch(g, W, H * 0.55, 0xb9dff0, 0, H * 0.22, 1);
    patch(g, W, H * 0.45, 0x7fb069, 0, -H * 0.27, 2);
    patch(g, W * 0.5, H * 0.14, 0x5b9bc4, W * 0.15, -H * 0.3, 3);
    tree(g, -W * 0.22, -H * 0.15, 2.2, 0x9cc15a);
    patch(g, 0.12, 0.1, 0x8db552, -W * 0.22, -H * 0.02, 3);
  },
  /** The city's towers at dusk. */
  exchange: (g) => {
    patch(g, W, H * 0.6, 0xf0a27a, 0, H * 0.2, 1);
    patch(g, W, H * 0.4, 0x8b6f9c, 0, -H * 0.3, 1);
    const towers = [
      [-0.21, 0.16],
      [-0.12, 0.26],
      [-0.03, 0.2],
      [0.06, 0.3],
      [0.15, 0.18],
      [0.22, 0.23],
    ] as const;
    for (const [x, h] of towers) patch(g, 0.07, h, 0x4a4560, x, -H / 2 + h / 2, 2);
  },
  /** The pier running out over the sea. */
  boardwalk: (g) => {
    patch(g, W, H * 0.55, 0xa8daf0, 0, H * 0.22, 1);
    patch(g, W, H * 0.3, 0x3f8fc0, 0, -H * 0.07, 2);
    patch(g, W, H * 0.15, 0xe9d3a0, 0, -H * 0.42, 2);
    patch(g, W * 0.55, 0.02, 0x8a6440, W * 0.2, -H * 0.12, 3);
    for (const x of [0.02, 0.1, 0.18, 0.26]) patch(g, 0.012, 0.05, 0x6b4a2e, x, -H * 0.17, 3);
  },
  /** Pines below a snowy peak. */
  highpines: (g) => {
    patch(g, W, H * 0.6, 0xc4e2f2, 0, H * 0.2, 1);
    const peak = put(g, cyl(0, 0.2, 0.26, 3), mat(0x8a96a8, 0.95), -0.02, HANG_Y + 0.02, FACE + 0.004);
    peak.scale.z = 0.05;
    patch(g, W, H * 0.3, 0x5c8a5a, 0, -H * 0.35, 2);
    for (const [x, s] of [
      [-0.2, 1],
      [-0.1, 1.2],
      [0.12, 1.1],
      [0.21, 0.9],
    ] as const)
      tree(g, x, -H * 0.3, s, 0x2f6b46, true);
  },
  /** Rows of apple trees in blossom. */
  orchard: (g) => {
    patch(g, W, H * 0.55, 0xb4dcef, 0, H * 0.22, 1);
    patch(g, W, H * 0.45, 0x9cc46e, 0, -H * 0.27, 2);
    for (const x of [-0.2, -0.07, 0.06, 0.19]) tree(g, x, -H * 0.3, 0.9, 0x77ae4e);
    for (const x of [-0.2, -0.07, 0.06, 0.19]) patch(g, 0.02, 0.02, 0xf4a8b8, x + 0.015, -H * 0.3 + 0.09, 5);
  },
};

/** Build the Landscape Painting model: a gilt frame round a view of the center it hangs in. */
export function buildLandscapePainting(g: THREE.Group, center: CenterId = 'sandbox') {
  const gilt = mat(0xc9a24a, 0.4);
  // a board behind, the canvas on it, and the frame's rim standing proud of the canvas all round
  put(g, rbox(W + 0.1, H + 0.1, 0.03, 0.01), gilt, 0, HANG_Y, 0.015);
  put(g, rbox(W, H, 0.01, 0.003), mat(0xf5ecdb, 0.9), 0, HANG_Y, 0.035);
  for (const y of [-1, 1]) put(g, rbox(W + 0.1, 0.05, 0.03, 0.008), gilt, 0, HANG_Y + y * (H / 2 + 0.025), 0.045);
  for (const x of [-1, 1]) put(g, rbox(0.05, H, 0.03, 0.008), gilt, x * (W / 2 + 0.025), HANG_Y, 0.045);
  VIEWS[center](g);
}
