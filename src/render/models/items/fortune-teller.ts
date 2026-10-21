// The Fortune Teller model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { GLASS, LACQUER, mat, partsOf, put, rbox, sph } from '../parts';

/** Build the Fortune Teller model: a carnival cabinet with a turbaned mystic behind glass, hands over a crystal ball. */
export function buildFortuneTeller(g: THREE.Group) {
  const wood = mat(LACQUER, 0.5);
  const gold = mat(0xd4a94a, 0.35);
  put(g, rbox(0.8, 0.8, 0.66, 0.04), wood, 0, 0.4, -0.08);
  put(g, rbox(0.84, 0.05, 0.7, 0.02), gold, 0, 0.82, -0.08);
  // the back and sides of the booth, and its arched top
  put(g, rbox(0.8, 0.95, 0.06, 0.02), wood, 0, 1.3, -0.38);
  for (const x of [-0.38, 0.38]) put(g, rbox(0.06, 0.95, 0.66, 0.02), wood, x, 1.3, -0.08);
  put(g, rbox(0.86, 0.22, 0.72, 0.05), wood, 0, 1.88, -0.08);
  put(g, rbox(0.6, 0.12, 0.04, 0.03), mat(0xf2c14e, 0.4, 0.6), 0, 1.88, 0.29);
  // the mystic: a robe, a face, a turban with a jewel, and two hands held out over the ball
  put(g, rbox(0.4, 0.42, 0.24, 0.1), mat(0x6d2f7a, 0.8), 0, 1.04, -0.22);
  put(g, sph(0.11, 14), mat(0xd9a07a, 0.7), 0, 1.36, -0.2);
  put(g, sph(0.13, 14), mat(0xe9c46a, 0.6), 0, 1.47, -0.22).scale.set(1, 0.75, 1);
  put(g, sph(0.025, 8), mat(0xe5484d, 0.3, 0.8), 0, 1.47, -0.09);
  for (const x of [-0.12, 0.12]) put(g, sph(0.04, 10), mat(0xd9a07a, 0.7), x, 1.0, -0.02);
  // the crystal ball, which glows and floats a little on its stand
  put(g, rbox(0.12, 0.04, 0.12, 0.02), gold, 0, 0.86, -0.02);
  // each ball glows with its own light, so it can flicker as the booth wears and go dark when it breaks
  const glow = owned(
    new THREE.MeshStandardMaterial({ color: 0x9b7ae0, roughness: 0.15, emissive: 0x9b7ae0, emissiveIntensity: 1.1 }),
  );
  const ball = put(g, sph(0.09, 18), glow, 0, 0.9, -0.02);
  ball.castShadow = false;
  partsOf(g).orb = ball;
  partsOf(g).lamp = glow;
  // the glass front, and the coin slot below it
  const glass = put(g, rbox(0.7, 0.9, 0.01, 0.004), GLASS, 0, 1.3, 0.24);
  glass.castShadow = false;
  put(g, rbox(0.08, 0.12, 0.02, 0.01), gold, 0.22, 0.6, 0.26);
}
