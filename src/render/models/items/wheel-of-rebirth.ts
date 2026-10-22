// The Carousel of Rebirth: a carousel with a striped canopy, four horses on brass poles and a lever for the Therapist.
// The guest rides the horse at the front, and comes round as each of their past lives in turn: a Tudor ruff, a toga, a
// goat and a seagull.

import * as THREE from 'three';

import {
  cached,
  capsule,
  CREAM,
  cyl,
  joined,
  LACQUER,
  mat,
  type Piece,
  put,
  soft,
  sph,
  torus,
  WHITE,
  WOOD,
} from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** How far from the middle the horses ride. */
export const RIDE_RADIUS = 1.65;

/** The canopy's soft pink, which the fourth horse wears too, and the brass of the poles and the trim. */
const PINK = 0xeea3bd;
const BRASS = 0xe8c34a;
/** How many stripes go round the canopy, pink and white in turn. */
const STRIPES = 16;
/** Where along a horse its pole stands: through its shoulders, just in front of its rider. */
const POLE_X = 0.16;

/** A carousel horse, side on along x, prancing: a body, a neck and head, four legs and a tail. */
const HORSE = joined('carousel-horse', [
  [capsule(0.15, 0.32), 0, 0.85, 0, 0, 0, Math.PI / 2],
  [capsule(0.07, 0.22), 0.24, 1.02, 0, 0, 0, -0.6],
  [capsule(0.075, 0.12), 0.38, 1.14, 0, 0, 0, 1.15],
  [capsule(0.035, 0.24), 0.27, 0.63, 0.07, 0, 0, 0.54],
  [capsule(0.035, 0.24), 0.27, 0.63, -0.07, 0, 0, 0.54],
  [capsule(0.035, 0.24), -0.26, 0.63, 0.07, 0, 0, -0.45],
  [capsule(0.035, 0.24), -0.26, 0.63, -0.07, 0, 0, -0.45],
  [capsule(0.03, 0.14), -0.36, 0.84, 0, 0, 0, 1.0],
]);

/** One stripe of the canopy, a wedge of its cone. */
const stripe = (i: number) =>
  cached(
    `carousel-stripe${i}`,
    () => new THREE.CylinderGeometry(0.15, 2.4, 0.56, 4, 1, true, (i / STRIPES) * Math.PI * 2, (Math.PI * 2) / STRIPES),
  );

/** The stripes of one color, every other one from the first. */
const stripes = (first: number): Piece[] =>
  Array.from({ length: STRIPES / 2 }, (_, k): Piece => [stripe(first + k * 2), 0, 0.28, 0]);

/** A ring with enough sides to stay round at the carousel's size. */
const hoop = (r: number, t: number) => cached(`carousel-hoop${r}|${t}`, () => new THREE.TorusGeometry(r, t, 8, 96));

/** Build the Carousel of Rebirth. The guest rides the horse at the front. */
export function buildWheelOfRebirth(g: THREE.Group) {
  const lacquer = mat(LACQUER, 0.6);
  const brass = mat(BRASS, 0.4);
  const cream = mat(CREAM, 0.6);
  const white = mat(WHITE, 0.6);
  // the round base, lacquered, with a brass rim
  put(g, cyl(2.3, 2.35, 0.2, 48), lacquer, 0, 0.1, 0);
  put(g, hoop(2.32, 0.04), brass, 0, 0.2, 0).rotation.x = Math.PI / 2;
  // the deck that turns, with the middle column, the horses and their poles on it
  const deck = rig(g, 'deck', new THREE.Group());
  g.add(deck);
  put(
    deck,
    joined('carousel-deck', [
      [cyl(2.1, 2.1, 0.08, 48), 0, 0.24, 0],
      [cyl(0.35, 0.4, 2.3, 24), 0, 1.43, 0],
    ]),
    cream,
  );
  const poles: Piece[] = [
    [hoop(0.4, 0.04), 0, 0.32, 0, Math.PI / 2],
    [hoop(0.36, 0.04), 0, 2.5, 0, Math.PI / 2],
  ];
  const coats = [white, lacquer, mat(WOOD, 0.6), mat(PINK, 0.6)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pole = new THREE.Group();
    pole.position.set(Math.sin(a) * RIDE_RADIUS, 0, Math.cos(a) * RIDE_RADIUS);
    pole.rotation.y = a;
    deck.add(pole);
    // the poles stand still on the deck, all one part, while the horses ride up and down them
    poles.push([
      cyl(0.04, 0.04, 2.21, 12),
      pole.position.x + POLE_X * Math.cos(a),
      1.385,
      pole.position.z - POLE_X * Math.sin(a),
    ]);
    // each horse bobs up and down its pole, the guest's with them on it
    const horse = rig(g, `horse${i}`, new THREE.Group());
    pole.add(horse);
    put(horse, HORSE, coats[i] ?? white);
    if (i === 0) {
      // what the guest wears as each of their past lives comes round
      const ruff = new THREE.Mesh(torus(0.13, 0.05), white);
      ruff.position.set(0, 1.5, 0);
      ruff.rotation.x = Math.PI / 2;
      const toga = new THREE.Mesh(cyl(0.1, 0.24, 0.5, 16), cream);
      toga.position.set(0, 1.25, 0);
      const goat = goatHead(cream, white);
      goat.position.set(0, 1.95, 0);
      const gull = seagull(white, brass);
      gull.position.set(0, 2.05, 0);
      for (const [name, prop] of [
        ['ruff', ruff],
        ['toga', toga],
        ['goat', goat],
        ['gull', gull],
      ] as const) {
        rig(g, name, prop).visible = false;
        horse.add(prop);
      }
    }
  }
  put(deck, joined('carousel-poles', poles), brass);
  // the canopy, striped pink and white, with a brass knob on top and bulbs round its edge, turning with the deck
  const canopy = rig(g, 'canopy', new THREE.Group());
  canopy.position.y = 2.6;
  g.add(canopy);
  put(canopy, joined('carousel-canopy-pink', stripes(0)), mat(PINK, 0.6));
  put(canopy, joined('carousel-canopy-white', [...stripes(1), [cyl(2.42, 2.42, 0.22, 64), 0, 0, 0]]), white);
  put(canopy, sph(0.1, 16), brass, 0, 0.6, 0);
  const bulbs: Piece[] = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    bulbs.push([sph(0.045, 8), Math.sin(a) * 2.43, -0.02, Math.cos(a) * 2.43]);
  }
  put(canopy, joined('carousel-bulbs', bulbs), mat(0xffe08a, 0.3, 1)).castShadow = false;
  // the Therapist's lever at the front left
  put(g, soft(0.3, 0.7, 0.3), lacquer, -2.1, 0.35, 2.2);
  put(
    g,
    joined('carousel-lever', [
      [capsule(0.03, 0.42), -2.18, 0.9, 2.2, 0, 0, 0.4],
      [sph(0.06, 12), -2.27, 1.12, 2.2],
    ]),
    brass,
  );

  wornAndDown(g, [0, 3.4, 0]);
  puffs(g, 'notes', { kind: 'rise', reach: 1.2, spread: 1.6, speed: 0.4 }, [0, 2.2, 0], 6, blob(0.06, 0xffd34a, 0.6));
  puffs(
    g,
    'puff',
    { kind: 'rise', reach: 0.5, spread: 0.2, speed: 0.5 },
    [0, 1.8, RIDE_RADIUS],
    4,
    blob(0.1, 0x8a8a90),
  );
}

/** A goat's horns and beard, worn over a guest's own face. */
function goatHead(horn: THREE.Material, beard: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  put(
    g,
    joined('carousel-goat-horns', [
      [capsule(0.03, 0.16), -0.08, 0.02, 0, 0, 0, 0.5],
      [capsule(0.03, 0.16), 0.08, 0.02, 0, 0, 0, -0.5],
    ]),
    horn,
  );
  put(g, cyl(0.035, 0.012, 0.14, 10), beard, 0, -0.32, 0.1);
  return g;
}

/** A seagull to sit on the guest's head: a white body and a yellow beak. */
function seagull(body: THREE.Material, beak: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  put(g, sph(0.09, 16), body, 0, 0, 0).scale.set(1.3, 0.85, 0.85);
  put(g, cyl(0.012, 0.025, 0.07, 8), beak, 0.14, 0.02, 0).rotation.z = -Math.PI / 2;
  return g;
}
