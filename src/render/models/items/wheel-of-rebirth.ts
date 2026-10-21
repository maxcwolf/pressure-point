// The Carousel of Rebirth: a carousel with a striped canopy, four horses on brass poles and a lever for the Therapist.
// The guest rides the horse at the front, and comes round as each of their past lives in turn: a Tudor ruff, a toga, a
// goat and a seagull.

import * as THREE from 'three';

import { cyl, joined, mat, put, rbox, sph, torus } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** How far from the middle the horses ride. */
export const RIDE_RADIUS = 1.65;

/** A carousel horse, side on along x, on its pole. */
const HORSE = joined('carousel-horse', [
  [sph(0.16, 12), 0, 0.85, 0],
  [cyl(0.05, 0.06, 0.35, 8), 0.2, 1.0, 0, 0, 0, -0.6],
  [sph(0.09, 10), 0.32, 1.13, 0],
  [cyl(0.03, 0.03, 0.35, 6), -0.1, 0.62, 0.08, 0, 0, 0.3],
  [cyl(0.03, 0.03, 0.35, 6), 0.12, 0.62, -0.08, 0, 0, -0.3],
]);

/** Build the Carousel of Rebirth. The guest rides the horse at the front. */
export function buildWheelOfRebirth(g: THREE.Group) {
  // the round base and the step up to it
  put(g, cyl(2.3, 2.35, 0.2, 40), mat(0x6a2a5a, 0.6), 0, 0.1, 0);
  put(g, torus(2.32, 0.04), mat(0xe8c34a, 0.4), 0, 0.2, 0).rotation.x = Math.PI / 2;
  // the deck that turns, with the middle column, the horses and their poles on it
  const deck = rig(g, 'deck', new THREE.Group());
  g.add(deck);
  put(deck, cyl(2.1, 2.1, 0.08, 40), mat(0xf2e3c8, 0.6), 0, 0.24, 0);
  put(deck, cyl(0.35, 0.4, 2.4, 16), mat(0xe8c34a, 0.4), 0, 1.4, 0);
  const brass = mat(0xe8c34a, 0.35);
  const coats = [0xfafafa, 0x3a3a3a, 0xc98a4a, 0x9fd6f0];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pole = new THREE.Group();
    pole.position.set(Math.sin(a) * RIDE_RADIUS, 0, Math.cos(a) * RIDE_RADIUS);
    pole.rotation.y = a;
    deck.add(pole);
    put(pole, cyl(0.025, 0.025, 2.3, 8), brass, 0, 1.4, 0);
    // each horse bobs up and down its pole, the guest's with them on it
    const horse = rig(g, `horse${i}`, new THREE.Group());
    pole.add(horse);
    put(horse, HORSE, mat(coats[i] ?? 0xfafafa, 0.5));
    if (i === 0) {
      // what the guest wears as each of their past lives comes round
      const ruff = new THREE.Mesh(torus(0.13, 0.05), mat(0xffffff, 0.8));
      ruff.position.set(0, 1.5, 0);
      ruff.rotation.x = Math.PI / 2;
      const toga = new THREE.Mesh(cyl(0.1, 0.24, 0.5, 12), mat(0xf4efe0, 0.8));
      toga.position.set(0, 1.25, 0);
      const goat = goatHead();
      goat.position.set(0, 1.95, 0);
      const gull = new THREE.Mesh(sph(0.09, 10), mat(0xf4f4f0));
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
  // the canopy, striped, with lights round its edge, turning with the deck
  const canopy = rig(g, 'canopy', new THREE.Group());
  canopy.position.y = 2.6;
  g.add(canopy);
  put(canopy, cyl(0.15, 2.4, 0.7, 16), mat(0xff8fc2, 0.6), 0, 0.35, 0);
  put(canopy, cyl(2.42, 2.42, 0.22, 32), mat(0xffffff, 0.6), 0, 0, 0);
  put(canopy, torus(2.43, 0.04), mat(0xffe08a, 0.3, 1), 0, -0.1, 0).rotation.x = Math.PI / 2;
  // the Therapist's lever at the front left
  put(g, rbox(0.3, 0.7, 0.3, 0.05), mat(0x3b3f4a), -2.1, 0.35, 2.2);
  put(g, cyl(0.03, 0.03, 0.5, 8), brass, -2.1, 0.9, 2.2).rotation.z = 0.4;

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
function goatHead(): THREE.Group {
  const g = new THREE.Group();
  const horn = mat(0xd8cbb0, 0.6);
  put(g, cyl(0.02, 0.04, 0.2, 6), horn, -0.07, 0, 0).rotation.z = 0.5;
  put(g, cyl(0.02, 0.04, 0.2, 6), horn, 0.07, 0, 0).rotation.z = -0.5;
  put(g, cyl(0.03, 0.005, 0.12, 6), mat(0xeeeeee, 0.9), 0, -0.32, 0.1);
  return g;
}
