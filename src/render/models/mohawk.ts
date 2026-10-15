// Amanda Jablonsky's mohawk: the sides buzzed short, a wide strip of round tufts over the top, and the long hair
// gathered at the back of the crown in a pink scrunchie, sprouting up in a short spray like a pineapple's top.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { must } from '../../core/util';
import { cached, cyl, mat, put, sph, torus } from './parts';

/** The scalp's radius, just over the head's, so hair laid on it shows. */
const SCALP = 0.218;
/** How far forward the strip starts at the hairline, and how far back it reaches before the tie, as angles from the top. */
const FRONT = 0.72;
const BACK = -0.62;
/** Where the scrunchie gathers the strip, just behind its last tuft. */
const TIE = BACK - 0.08;

/** The pink scrunchie that holds the ponytail. */
const SCRUNCHIE = 0xef6f9a;

/** The spikes of the ponytail: how far each leans to one side and back from upright, and how long it is. */
const SPIKES: readonly (readonly [side: number, back: number, len: number])[] = [
  [0, -0.25, 0.17],
  [0.38, -0.45, 0.14],
  [-0.38, -0.45, 0.14],
  [0, -0.75, 0.13],
  [0.22, 0.05, 0.11],
  [-0.22, 0.05, 0.11],
];

/** A point on the scalp's middle line, an angle forward of the top and lifted off it by some way. */
const onScalp = (angle: number, lift: number) =>
  new THREE.Vector3(0, (SCALP + lift) * Math.cos(angle), (SCALP + lift) * Math.sin(angle));

/** Add the mohawk to a head, in a person's own hair color. */
export function buildMohawk(head: THREE.Object3D, skin: number, hairColor: number) {
  const hair = mat(hairColor, 0.85);
  // the buzzed sides: a thin layer of hair, a shade lighter where the skin shows through
  const buzz = mat(new THREE.Color(skin).lerp(new THREE.Color(hairColor), 0.85).getHex(), 0.95);
  const cap = cached('buzz', () => new THREE.SphereGeometry(0.228, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.47));
  put(head, cap, buzz, 0, 0.012, -0.018).rotation.x = -0.28;

  put(head, hairShape(), hair);

  // the scrunchie, ringed around the ponytail as it leaves the head
  const ring = put(head, torus(0.052, 0.017), mat(SCRUNCHIE, 0.6));
  ring.position.copy(onScalp(TIE, 0.045));
  ring.rotation.x = -Math.PI / 2;
}

/**
 * The strip and the ponytail's spikes as one shape, made once and shared, so the hair is a single part to draw
 * rather than one for every tuft and spike.
 */
const hairShape = () =>
  cached('mohawk', () => {
    const pieces: THREE.BufferGeometry[] = [];
    /** Add a copy of a shape, placed, turned and stretched. */
    const add = (shape: THREE.BufferGeometry, at: THREE.Vector3, turn: THREE.Euler, stretch: THREE.Vector3) =>
      pieces.push(
        shape.clone().applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(turn), stretch)),
      );
    // the strip, wider than it is tall, from the hairline back to the crown
    for (let i = 0; i < 8; i++) {
      const at = onScalp(FRONT + ((BACK - FRONT) * i) / 7, 0.03);
      add(sph(0.068, 12), at, new THREE.Euler(), new THREE.Vector3(1.5, 1, 1));
    }
    // the ponytail, sprouting from the scrunchie
    const base = onScalp(TIE, 0.05);
    for (const [side, back, len] of SPIKES) {
      const turn = new THREE.Euler(back, 0, side);
      add(
        cyl(0.008, 0.042, len, 8),
        base.clone().add(new THREE.Vector3(0, len / 2, 0).applyEuler(turn)),
        turn,
        new THREE.Vector3(1, 1, 1),
      );
    }
    return must(mergeGeometries(pieces, false) as THREE.BufferGeometry | null, 'the mohawk merged');
  });
