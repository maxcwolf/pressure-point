// Kettles for a stress head, for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by
// number in the address (`&steam=1`). The face stays on every one, so how the guest feels still shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, swell } from './character-heads';
import { props } from './character-transform';
import { cached, cyl, mat, put, sph } from './parts';

/** The black of handles and knobs, and the steel of lids and spouts. */
const BLACK = 0x1d1f24;
const STEEL = 0xc9ced6;

/** An arch over the top of the head from one side to the other, standing in the head's left-right plane. */
const arch = (r: number, tube: number) =>
  cached(`arch ${r}|${tube}`, () => new THREE.TorusGeometry(r, tube, 10, 28, Math.PI));

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
 * A stress head's kettle: 1, the head itself in red enamel, round, under a steel lid, with a black handle arching over
 * and a thick spout from the cheek; 2, a tapering blue enamel stovetop kettle in place of the head, a long steel spout
 * and a black handle; 3, the same stovetop kettle in polished chrome with a red knob and whistle.
 */
export function kettle(rig: CharRig, variant: number) {
  const { head } = rig;
  hideUntilCured(rig, named(head, 'hair', 'moustache', 'beard', 'glasses'));
  const kettle = new THREE.Group();
  const black = mat(BLACK, 0.4);
  if (variant === 1) {
    const enamel = 0xd23c2a;
    rig.headMesh.material = mat(enamel, 0.35);
    const lid = put(kettle, sph(0.15, 20), mat(STEEL, 0.25), 0, 0.19, 0);
    lid.scale.y = 0.4;
    put(kettle, sph(0.04, 12), black, 0, 0.26, 0);
    const handle = put(kettle, arch(0.17, 0.03), black, 0, 0.1, -0.02);
    handle.scale.y = 1.5;
    spout(rig, kettle, [0.17, -0.07], 0.8, 0.3, enamel);
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
