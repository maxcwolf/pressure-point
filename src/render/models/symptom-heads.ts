// Kettles for a stress head, for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by
// number in the address (`&steam=1`). The face stays on every one, so how the guest feels still shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, swell } from './character-heads';
import { cached, cyl, mat, put, sph } from './parts';

/** The black of handles and knobs, and the steel of lids and spouts. */
const BLACK = 0x1d1f24;
const STEEL = 0xc9ced6;

/** An arch over the top of the head from one side to the other, standing in the head's left-right plane. */
const arch = (r: number, tube: number) =>
  cached(`arch ${r}|${tube}`, () => new THREE.TorusGeometry(r, tube, 10, 28, Math.PI));

/**
 * A thin wire handle over the top of the head from one side to the other, `across` between its feet and `up` high,
 * standing in the head's left-right plane: an arch drawn out tall without growing thicker at the top, as a stretched
 * ring would.
 */
const bail = (across: number, up: number, tube: number) =>
  cached(`bail ${across}|${up}|${tube}`, () => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      points.push(new THREE.Vector3((Math.cos(a) * across) / 2, Math.sin(a) * up, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, tube, 8);
  });

/**
 * A spout from the side of the head, `length` long, its root at `root` and leaning out from upright by `lean`, with a
 * whistle in a color on its tip; the steam is moved to puff out of the whistle.
 */
function spout(
  rig: CharRig,
  kettle: THREE.Group,
  root: [number, number],
  lean: number,
  length: number,
  body: number,
  cap = BLACK,
) {
  const dir = new THREE.Vector2(Math.sin(lean), Math.cos(lean));
  const mid = new THREE.Vector2(...root).addScaledVector(dir, length / 2);
  const tip = new THREE.Vector2(...root).addScaledVector(dir, length);
  const pipe = put(kettle, cyl(0.032, 0.068, length, 14), mat(body, 0.35), mid.x, mid.y, 0.03);
  pipe.rotation.z = -lean;
  const whistle = put(kettle, cyl(0.04, 0.034, 0.06, 12), mat(cap, 0.4), tip.x, tip.y, 0.03);
  whistle.rotation.z = -lean;
  rig.steam?.position.set(tip.x + dir.x * 0.05, tip.y + dir.y * 0.05, 0.03);
}

/**
 * A stress head's kettle: 1, the head itself in red enamel, round, under a steel lid, with a tall thin dark wire handle
 * and a black grip across its top, and a thick spout growing out of the cheek; 4, the same in steel wire with a wooden
 * grip; 2, a tapering blue enamel stovetop kettle in place of the head, a long steel spout
 * and a black handle; 3, the same stovetop kettle in polished chrome with a red knob and whistle.
 */
export function kettle(rig: CharRig, variant: number) {
  const { head } = rig;
  hideUntilCured(rig, named(head, 'hair', 'moustache', 'beard', 'glasses'));
  const kettle = new THREE.Group();
  const black = mat(BLACK, 0.4);
  if (variant === 1 || variant === 4) {
    const enamel = 0xd23c2a;
    rig.headMesh.material = mat(enamel, 0.35);
    const lid = put(kettle, sph(0.15, 20), mat(STEEL, 0.25), 0, 0.19, 0);
    lid.scale.y = 0.4;
    put(kettle, sph(0.04, 12), black, 0, 0.26, 0);
    // a tall thin wire handle, its feet in the head, with a grip across its top: 1, dark wire and a black grip; 4,
    // steel wire and a wooden grip
    const wire = variant === 1 ? 0x3a3f47 : STEEL;
    put(kettle, bail(0.3, 0.25, 0.012), mat(wire, 0.3), 0, 0.12, -0.02);
    const grip = put(kettle, cyl(0.028, 0.028, 0.13, 14), variant === 1 ? black : mat(0xa86f3c, 0.6), 0, 0.37, -0.02);
    grip.rotation.z = Math.PI / 2;
    // the spout rooted deep in the head, so it grows out of the side without a seam
    spout(rig, kettle, [0.03, -0.1], 0.88, 0.44, enamel);
    swell(rig, 1.2, 1.2);
  } else {
    const chrome = variant === 3;
    const body = chrome ? 0xd8dde3 : 0x2f5fb3;
    const shine = chrome ? 0.18 : 0.35;
    hideUntilCured(rig, [rig.headMesh]);
    put(kettle, cyl(0.13, 0.26, 0.36, 32), mat(body, shine), 0, -0.02, 0);
    put(kettle, cyl(0.268, 0.268, 0.035, 32), black, 0, -0.2, 0);
    put(kettle, cyl(0.11, 0.135, 0.04, 24), mat(STEEL, 0.25), 0, 0.18, 0);
    put(kettle, sph(0.038, 12), chrome ? mat(0xd9362f, 0.4) : black, 0, 0.215, 0);
    const handle = put(kettle, arch(0.15, 0.028), black, 0, 0.12, -0.01);
    handle.scale.y = 1.4;
    spout(rig, kettle, [0.17, -0.11], 0.72, 0.36, chrome ? body : STEEL, chrome ? 0xd9362f : BLACK);
    // the face on the kettle's tapering front: the mouth further out where it is wider, the brows in where it narrows
    faceOut(rig, { eyes: 0, brows: -0.012, mouth: 0.032 });
    swell(rig, 1.15, 1.15);
  }
  props(rig, kettle);
  head.add(kettle);
}
