// The Fortune Teller model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { LACQUER, mat, partsOf, put, rbox, soft, sph } from '../parts';

/** Build the Fortune Teller model: a carnival cabinet with a turbaned mystic in a gilt window, hands over a crystal ball. */
export function buildFortuneTeller(g: THREE.Group) {
  const wood = mat(LACQUER, 0.5);
  const gold = mat(0xd4a94a, 0.35);
  const robe = mat(0x6d2f7a, 0.8);
  const skin = mat(0xd9a07a, 0.7);
  put(g, soft(0.8, 0.8, 0.66), wood, 0, 0.4, -0.08);
  put(g, soft(0.84, 0.05, 0.7), gold, 0, 0.82, -0.08);
  // the booth's sides and its top, a person and a half tall in all, and a backdrop lit like the sign over the window,
  // which the mystic shows up against in the shade of the top
  const lit = mat(0xf2c14e, 0.4, 0.6);
  put(g, rbox(0.72, 0.6, 0.04, 0.02), lit, 0, 1.14, -0.36);
  put(g, rbox(0.8, 0.62, 0.06, 0.02), wood, 0, 1.14, -0.4);
  for (const x of [-0.38, 0.38]) put(g, rbox(0.06, 0.62, 0.66, 0.02), wood, x, 1.14, -0.08);
  put(g, soft(0.86, 0.17, 0.72), wood, 0, 1.51, -0.08);
  put(g, soft(0.6, 0.1, 0.04), lit, 0, 1.51, 0.29);
  // the mystic, sat near the front so the top does not hide their face from the game's camera: a robe, a face, a
  // turban with a jewel, and two hands held out over the ball
  put(g, rbox(0.38, 0.32, 0.22, 0.1), robe, 0, 1.0, -0.1);
  put(g, sph(0.1, 16), skin, 0, 1.22, -0.06);
  put(g, sph(0.12, 16), robe, 0, 1.31, -0.08).scale.set(1, 0.72, 1);
  put(g, sph(0.025, 8), mat(0xe5484d, 0.3, 0.8), 0, 1.31, 0.04);
  for (const x of [-0.12, 0.12]) put(g, sph(0.042, 12), skin, x, 0.99, 0.08);
  // the crystal ball, which glows and floats a little on its stand
  put(g, soft(0.12, 0.04, 0.12), gold, 0, 0.86, 0.1);
  // each ball glows with its own light, so it can flicker as the booth wears and go dark when it breaks
  const glow = owned(
    new THREE.MeshStandardMaterial({ color: 0x9b7ae0, roughness: 0.15, emissive: 0x9b7ae0, emissiveIntensity: 1.1 }),
  );
  const ball = put(g, sph(0.09, 18), glow, 0, 0.9, 0.1);
  ball.castShadow = false;
  partsOf(g).orb = ball;
  partsOf(g).lamp = glow;
  // a gilt frame round the window, and the coin slot below it
  for (const x of [-0.33, 0.33]) put(g, soft(0.06, 0.6, 0.06), gold, x, 1.14, 0.24);
  put(g, soft(0.08, 0.12, 0.02), gold, 0.22, 0.6, 0.26);
}
