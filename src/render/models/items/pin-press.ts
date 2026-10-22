// The Pin Press: a pin-art desk toy the size of a garage door, in an oak frame on two feet. The guest presses into the front, their
// outline rises on the back, and the Acupuncturist taps back in the one pin that sticks out.

import * as THREE from 'three';

import { cached, capsule, CHROME, cyl, DARK, joined, mat, put, soft, sph, WOOD } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** The pins across and down, and the gap between them. */
const ACROSS = 16;
const DOWN = 12;
const PITCH = 0.16;

/** A field of pin heads in one part: one shape, drawn once for every pin. */
function pinField(): THREE.InstancedMesh {
  const head = cached('pin-head', () => new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12).rotateX(Math.PI / 2));
  const field = new THREE.InstancedMesh(head, mat(CHROME, 0.3), ACROSS * DOWN);
  const m = new THREE.Matrix4();
  for (let i = 0; i < ACROSS; i++)
    for (let j = 0; j < DOWN; j++) {
      m.makeTranslation((i - (ACROSS - 1) / 2) * PITCH, 0.35 + j * PITCH, 0);
      field.setMatrixAt(i * DOWN + j, m);
    }
  return field;
}

/** An outline in pins, standing proud of the back: a person, or Brent, who is broader and has a quiff and a tie. */
function outline(brent: boolean) {
  return joined(brent ? 'pin-brent' : 'pin-outline', [
    [capsule(brent ? 0.27 : 0.21, 0.55), 0, 0.95, 0],
    [sph(brent ? 0.15 : 0.13, 12), 0, 1.6, 0],
    ...(brent
      ? ([
          [soft(0.22, 0.1, 0.16), 0.04, 1.76, 0],
          [soft(0.07, 0.36, 0.06), 0, 1.15, 0.12],
        ] as const)
      : []),
    [capsule(0.07, 0.5), -0.3, 1.0, 0, 0, 0, 0.25],
    [capsule(0.07, 0.5), 0.3, 1.0, 0, 0, 0, -0.25],
  ]);
}

/** Build the Pin Press. The guest stands at the front, facing in; the Acupuncturist stands behind. */
export function buildPinPress(g: THREE.Group) {
  // the oak frame, like the desk toy's: two posts on feet that stand it up, a beam at the top and a sill at the bottom
  const oak = mat(WOOD, 0.6);
  put(
    g,
    joined('pin-press-frame', [
      [soft(0.14, 2.45, 0.42), -1.42, 1.22, 0],
      [soft(0.14, 2.45, 0.42), 1.42, 1.22, 0],
      [soft(2.98, 0.16, 0.42), 0, 2.38, 0],
      [soft(2.98, 0.3, 0.42), 0, 0.15, 0],
      [soft(0.2, 0.12, 0.8), -1.42, 0.06, 0],
      [soft(0.2, 0.12, 0.8), 1.42, 0.06, 0],
    ]),
    oak,
  );
  // the dark backing board the pins slide through, so the steel pins stand out against it
  put(g, soft(2.7, 2.02, 0.08), mat(DARK, 0.6), 0, 1.33, 0);
  // the pins face the guest, and bow in a little where they are pressed
  const field = rig(g, 'field', pinField());
  field.position.z = 0.08;
  g.add(field);
  // their outline rising on the back, and Brent's, when it is Brent's
  const person = rig(g, 'outline', new THREE.Group());
  person.position.z = -0.06;
  person.visible = false;
  g.add(person);
  put(person, outline(false), mat(CHROME, 0.3), 0, 0, 0).scale.z = 0.35;
  const brent = rig(g, 'brent', new THREE.Group());
  brent.position.z = -0.06;
  brent.visible = false;
  g.add(brent);
  put(brent, outline(true), mat(CHROME, 0.3), 0, 0, 0).scale.z = 0.35;
  // the one pin that will not go back in, and the little hammer that sees to it
  const stuck = rig(g, 'stuck', new THREE.Group());
  stuck.position.set(0.16, 1.47, -0.1);
  g.add(stuck);
  put(stuck, cyl(0.03, 0.03, 0.3, 12), mat(CHROME, 0.3), 0, 0, -0.1).rotation.x = Math.PI / 2;
  put(stuck, sph(0.055, 14), mat(0xe03a3a, 0.4), 0, 0, -0.25);
  const hammer = rig(g, 'hammer', new THREE.Group());
  hammer.position.set(0.32, 1.25, -0.62);
  g.add(hammer);
  put(
    hammer,
    joined('pin-hammer', [
      [capsule(0.022, 0.3), 0, 0.16, 0],
      [cyl(0.055, 0.055, 0.15, 14), 0, 0.33, 0, 0, 0, Math.PI / 2],
    ]),
    oak,
  );
  hammer.visible = false;

  wornAndDown(g, [0, 2.5, 0]);
  puffs(
    g,
    'sparkle',
    { kind: 'spray', reach: 0.6, spread: 0.3, speed: 1.1 },
    [0, 1.5, -0.2],
    6,
    blob(0.04, 0x9fe8ff, 1),
  );
  puffs(g, 'puff', { kind: 'rise', reach: 0.5, spread: 0.2, speed: 0.5 }, [0, 1.6, 0.3], 4, blob(0.1, 0x8a8a90));
}
