// The fire brigade's truck, called out whenever something in the center catches fire: a red cab and body on four
// black wheels, a white band along its sides, a chrome ladder lying along the roof, a hose reel on the back, and a
// blue and a red lamp on the cab roof that flash in turn while it is out. The red is the truck, as a fire truck is;
// the chrome and the lamps are its fifth of brighter things.

import * as THREE from 'three';

import { owned } from '../disposal';
import { mergeStill } from './merge';
import { CHROME, CREAM, cyl, DARK, joined, mat, type Piece, put, rbox, soft, torus, trimShadows } from './parts';

/** How long the truck is, nose to tail along x, how wide across z, and how high to the top of its lamps, in tiles. */
export const TRUCK_L = 2.6;
export const TRUCK_W = 1.1;
export const TRUCK_H = 1.4;

/** The truck's red, and the dark glass of its windows. */
const RED = 0xc8322b;
const GLASS = 0x2c3440;

/** The lamps' colors, and how bright each glows when it is lit and between flashes. */
const LAMP_BLUE = 0x3f7fe8;
const LAMP_RED = 0xf0402f;
export const LAMP_ON = 2.2;
export const LAMP_OFF = 0.15;

/** How big the wheels are, and where along and across the truck they stand. */
const WHEEL_R = 0.23;
const WHEEL_T = 0.16;
const AXLES = [-0.78, 0.82] as const;

/** The truck, and its two lamps, blue then red, whose glow the brigade's layer flashes. */
export interface FireTruck {
  root: THREE.Group;
  lamps: THREE.MeshStandardMaterial[];
}

/** A lamp's own material, glowing in its color, so each can flash on its own. */
const lampMaterial = (color: number) =>
  owned(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: LAMP_ON, roughness: 0.3 }));

/** Build the fire truck, its nose toward +x, the way it drives, standing on the ground about its middle. */
export function buildFireTruck(): FireTruck {
  const root = new THREE.Group();
  const red = mat(RED, 0.45);
  const dark = mat(DARK, 0.7);
  const chrome = mat(CHROME, 0.3);
  const half = TRUCK_W / 2;
  // the chassis between the wheels, and the four wheels, each with a chrome hub on its outer face
  put(root, soft(TRUCK_L - 0.1, 0.14, TRUCK_W - 0.24), dark, 0, 0.3, 0);
  for (const x of AXLES)
    for (const side of [-1, 1]) {
      const wheel = put(root, cyl(WHEEL_R, WHEEL_R, WHEEL_T, 20), dark, x, WHEEL_R, side * (half - WHEEL_T / 2));
      wheel.rotation.x = Math.PI / 2;
      const hub = put(root, cyl(0.1, 0.1, 0.03, 16), chrome, x, WHEEL_R, side * (half + 0.005));
      hub.rotation.x = Math.PI / 2;
    }
  // the body behind, and the cab in front, a little taller, with mudguards over the wheels
  const bodyL = 1.75;
  const cabL = TRUCK_L - bodyL - 0.04;
  const bodyX = -TRUCK_L / 2 + bodyL / 2;
  const cabX = TRUCK_L / 2 - cabL / 2;
  put(root, soft(bodyL, 0.78, TRUCK_W - 0.06), red, bodyX, 0.36 + 0.39, 0);
  put(root, soft(cabL, 0.88, TRUCK_W - 0.1), red, cabX, 0.36 + 0.44, 0);
  for (const x of AXLES)
    for (const side of [-1, 1]) put(root, rbox(0.6, 0.07, 0.2, 0.025), red, x, 2 * WHEEL_R + 0.04, side * (half - 0.1));
  // a white band all the way round, along the body and the cab
  const band = put(root, rbox(TRUCK_L - 0.03, 0.09, TRUCK_W - 0.03, 0.03), mat(CREAM, 0.5), 0, 0.62, 0);
  band.castShadow = false;
  // the windscreen across the front of the cab, and a window in each door
  const glass = put(
    root,
    joined('fire truck glass', [
      [rbox(0.04, 0.32, TRUCK_W - 0.3, 0.015), cabL / 2, 0, 0],
      [rbox(cabL - 0.2, 0.28, 0.04, 0.015), 0, 0, half - 0.05],
      [rbox(cabL - 0.2, 0.28, 0.04, 0.015), 0, 0, -(half - 0.05)],
    ]),
    mat(GLASS, 0.15),
    cabX,
    0.98,
    0,
  );
  glass.castShadow = false;
  // a dark grille under the windscreen, and chrome bumpers at each end
  put(root, rbox(0.04, 0.2, 0.62, 0.015), dark, TRUCK_L / 2 + 0.005, 0.55, 0).castShadow = false;
  for (const end of [-1, 1]) put(root, soft(0.08, 0.1, TRUCK_W - 0.08), chrome, end * (TRUCK_L / 2 + 0.01), 0.36, 0);
  // a chrome ladder lying along the roof on two posts, its front end out over the cab
  const ladder: Piece[] = [];
  const ladderL = 2.0;
  const ladderX = -0.25;
  const rail = rbox(ladderL, 0.06, 0.06, 0.02);
  for (const z of [-0.24, 0.24]) ladder.push([rail, 0, 0, z]);
  const rung = rbox(0.06, 0.06, 0.48, 0.02);
  for (let i = 0; i < 8; i++) ladder.push([rung, -ladderL / 2 + 0.12 + i * ((ladderL - 0.24) / 7), 0, 0]);
  const post = rbox(0.06, 0.12, 0.06, 0.02);
  for (const x of [-0.8, 0.35]) for (const z of [-0.24, 0.24]) ladder.push([post, x, -0.08, z]);
  put(root, joined('fire truck ladder', ladder), chrome, ladderX, 1.27, 0);
  // the hose reel on the back, coiled on its drum
  const reel = put(root, torus(0.2, 0.065), mat(CREAM, 0.7), -TRUCK_L / 2 - 0.02, 0.78, 0);
  reel.rotation.y = Math.PI / 2;
  reel.castShadow = false;
  put(root, cyl(0.12, 0.12, 0.1, 16), chrome, -TRUCK_L / 2 - 0.02, 0.78, 0).rotation.z = Math.PI / 2;
  trimShadows(root);
  mergeStill(root, 'fire-truck');
  // the lamps on the front of the cab roof, blue on the left and red on the right, kept apart so they can flash
  const lamps = [lampMaterial(LAMP_BLUE), lampMaterial(LAMP_RED)];
  lamps.forEach((m, i) => {
    const lamp = put(root, rbox(0.16, 0.12, 0.22, 0.04), m, cabX + 0.12, 1.3, (i ? -1 : 1) * 0.3);
    lamp.castShadow = false;
  });
  root.userData = { lamps };
  return { root, lamps };
}

/** Light the truck's lamps at a moment, in turn twice a second, or both steadily for anyone who has motion reduced. */
export function flashLamps(truck: FireTruck, t: number, steady = false) {
  const blue = steady || Math.floor(t * 4) % 2 === 0;
  const [a, b] = truck.lamps;
  if (a) a.emissiveIntensity = blue ? LAMP_ON : LAMP_OFF;
  if (b) b.emissiveIntensity = steady || !blue ? LAMP_ON : LAMP_OFF;
}
