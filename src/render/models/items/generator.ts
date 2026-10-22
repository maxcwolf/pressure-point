// The Generator model.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { capsule, CHROME, cyl, DARK, mat, partsOf, put, rbox, soft } from '../parts';

/** The sage the housing is painted, and the shade of its lid. */
const HOUSING = 0xa7b79c;
const LID = 0x8fa184;

/**
 * Build the Generator model: a long sage housing on a dark skid, a louvered grille and a control panel with its
 * running light on the front, a lightning bolt between them, and the exhaust standing up from the roof.
 */
export function buildGenerator(g: THREE.Group) {
  put(g, rbox(1.84, 0.1, 0.8, 0.03), mat(DARK), 0, 0.05, 0);
  put(g, soft(1.72, 0.72, 0.7), mat(HOUSING), 0, 0.46, 0);
  put(g, soft(1.8, 0.08, 0.78), mat(LID), 0, 0.85, 0);
  // the grille the engine breathes through
  for (let i = 0; i < 5; i++) put(g, rbox(0.56, 0.035, 0.03, 0.012), mat(DARK), 0.48, 0.3 + i * 0.09, 0.355);
  // the control panel: a dial, and the light that shows it is running, flickering as it wears and dark once broken
  put(g, soft(0.4, 0.34, 0.04), mat(0xf5ecdb), -0.52, 0.5, 0.355);
  put(g, cyl(0.07, 0.07, 0.03), mat(DARK), -0.6, 0.52, 0.38).rotation.x = Math.PI / 2;
  const light = owned(new THREE.MeshStandardMaterial({ color: 0x7ee08f, emissive: 0x3bd06a, emissiveIntensity: 1.1 }));
  put(g, cyl(0.035, 0.035, 0.03), light, -0.42, 0.56, 0.38).rotation.x = Math.PI / 2;
  partsOf(g).lamp = light;
  // a lightning bolt painted on the housing, in two strokes
  const bolt = mat(0xf2c14e, 0.5);
  put(g, rbox(0.05, 0.2, 0.02, 0.008), bolt, -0.03, 0.56, 0.36).rotation.z = -0.45;
  put(g, rbox(0.05, 0.2, 0.02, 0.008), bolt, 0.03, 0.4, 0.36).rotation.z = -0.45;
  // the exhaust stack, up from the roof at the back, with its cap tipped over it
  put(g, cyl(0.07, 0.07, 0.42), mat(CHROME, 0.35), 0.66, 1.08, -0.2);
  put(g, capsule(0.075, 0.1), mat(DARK, 0.4), 0.66, 1.31, -0.2).rotation.z = Math.PI / 2;
  // the filler cap on the roof
  put(g, cyl(0.08, 0.08, 0.06), mat(DARK, 0.4), -0.6, 0.92, -0.15);
}
