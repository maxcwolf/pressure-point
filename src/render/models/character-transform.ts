// Prototypes for symptoms that read from the game's usual distance (see `SYMPTOM_OPTION`): under `body`, the head or
// the whole body becomes the joke (a kettle for a stress head, a bottle for someone bottled up, an egg for a scrambled
// noggin); under `color`, the whole person wears it (a ghost for someone out of their body, frosted for a cold
// shoulder, pond green for stagnant vibes). Each is put back halfway through the cure, as the skin is.

import * as THREE from 'three';

import type { Visual } from '../../core/data';
import type { Viewpoint } from '../crowd';
import { owned } from '../disposal';
import { pixelsPerMeter } from '../readable';
import { GROW, GROW_START, SYMPTOM_OPTION, variantOf } from '../symptom-options';
import type { CharRig } from './character';
import { hideUntilCured, named, props, swell } from './character-heads';
import { cyl, mat, put, sph, torus } from './parts';
import { kettle } from './symptom-heads';
import { cactus } from './symptom-proposals';

/**
 * Recolor every part of a person, each shared material swapped for the shared one of its new color so the crowd still
 * draws them in batches, and put each back halfway through the cure.
 */
function recolor(rig: CharRig, to: (c: THREE.Color) => THREE.Color, skip: Set<THREE.Object3D>) {
  rig.body.traverse((o) => {
    const m = o as THREE.Mesh;
    const was = m.material;
    if (skip.has(o) || !(was instanceof THREE.MeshStandardMaterial) || was.emissive.getHex() !== 0) return;
    m.material = mat(to(was.color.clone()).getHex(), was.roughness);
    (rig.restore ??= []).push(() => (m.material = was));
  });
}

/** Everything under the symptom's props, which keep their own colors. */
function propParts(rig: CharRig) {
  const parts = new Set<THREE.Object3D>();
  for (const p of rig.props) p.traverse((o) => parts.add(o));
  return parts;
}

/** The whole body as the symptom, for the ailments prototyped under `body`. */
function bodySymptom(rig: CharRig, visual: Visual) {
  const { head } = rig;
  if (visual === 'steam' && variantOf('steam')) kettle(rig, variantOf('steam'));
  else if (visual === 'cactus' && variantOf('cactus')) cactus(rig, variantOf('cactus'));
  else if (visual === 'steam') {
    // the head a whistling kettle: red enamel where the skin was, a steel lid for hair, a black handle arching over the
    // top, and a spout the steam comes out of, the face still on it to show how they feel
    rig.headMesh.material = mat(0xd9452f, 0.4);
    hideUntilCured(rig, named(head, 'hair', 'moustache', 'beard', 'glasses'));
    const kettle = new THREE.Group();
    const steel = mat(0xc9ced6, 0.3);
    const black = mat(0x1d1f24, 0.4);
    put(kettle, cyl(0.15, 0.2, 0.06, 20), steel, 0, 0.2, 0);
    put(kettle, sph(0.045, 10), black, 0, 0.26, 0);
    put(kettle, torus(0.19, 0.03), black, 0, 0.2, -0.02);
    const spout = put(kettle, cyl(0.035, 0.065, 0.24, 12), steel, 0.27, 0.03, 0.04);
    spout.rotation.z = -0.85;
    put(kettle, sph(0.045, 10), black, 0.36, 0.12, 0.04);
    props(rig, kettle);
    head.add(kettle);
    rig.steam?.position.set(0.38, 0.14, 0.04);
    swell(rig, 1.25, 1.2);
  }
}

/** The whole person wearing the symptom as color, for the ailments prototyped under `color`. */
function colorSymptom(rig: CharRig, visual: Visual) {
  const skip = propParts(rig);
  if (visual === 'pale') {
    // half there: see-through and faintly glowing, as a ghost of themselves
    rig.body.traverse((o) => {
      const m = o as THREE.Mesh;
      const was = m.material;
      if (!(was instanceof THREE.MeshStandardMaterial)) return;
      const ghost = owned(was.clone());
      ghost.color.lerp(new THREE.Color(0xdfe9ff), 0.6);
      ghost.transparent = true;
      ghost.opacity = 0.42;
      ghost.depthWrite = false;
      ghost.emissive = new THREE.Color(0x9fb8ff);
      ghost.emissiveIntensity = 0.35;
      m.material = ghost;
      m.castShadow = false;
      (rig.restore ??= []).push(() => {
        m.material = was;
        m.castShadow = true;
      });
    });
  } else if (visual === 'frost') {
    // frosted all over, clothes, skin and hair, as if just in from a blizzard
    const ice = new THREE.Color(0xa8d8f4);
    recolor(rig, (c) => c.lerp(ice, 0.72), skip);
  } else if (visual === 'aura') {
    // gone the murky green of a pond nobody cleans, with flies about them
    const pond = new THREE.Color(0x7a8a3a);
    recolor(rig, (c) => c.lerp(pond, 0.68), skip);
    const flies = new THREE.Group();
    const black = mat(0x1d1f24, 0.4);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      put(flies, sph(0.022, 6), black, Math.cos(a) * 0.32, (i % 2) * 0.12, Math.sin(a) * 0.32);
    }
    flies.position.y = 0.3;
    rig.head.add(flies);
    props(rig, flies);
    rig.orbit = flies;
  }
}

/**
 * Hang a symptom's props from a mount on the head, `at` up it, which grows from afar to keep them `meters` across at
 * least `GROW.px` pixels on screen: the props rise as they grow, clear of the head.
 */
function mount(rig: CharRig, at: number, meters: number, parts: THREE.Object3D[]) {
  const grower = new THREE.Group();
  grower.position.y = at;
  grower.scale.setScalar(GROW_START);
  grower.userData.meters = meters;
  for (const p of parts) {
    p.position.y -= at;
    if (p === rig.bob) rig.bobAt -= at;
    grower.add(p);
  }
  rig.head.add(grower);
  (rig.grow ??= []).push(grower);
}

/** The props of the ailments prototyped under `grow`, set to grow from afar. */
function growSymptom(rig: CharRig, visual: Visual) {
  if (visual === 'glass' && rig.bob) {
    rig.bobAt = rig.bob.position.y;
    mount(rig, 0.24, 0.14, [rig.bob]);
  }
}

/** Grow each mounted symptom to stay readable from a viewpoint, as speech bubbles do, up to `GROW.most` times its size. */
export function growProps(rig: CharRig, view: Viewpoint) {
  if (!rig.grow || rig.cured) return;
  const { camera, height } = view;
  if (!(camera instanceof THREE.PerspectiveCamera)) return;
  for (const g of rig.grow) {
    const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const at = new THREE.Vector3().setFromMatrixPosition(g.matrixWorld);
    const perMeter = pixelsPerMeter(camera.fov, eye.distanceTo(at), height);
    const across = (g.userData.meters as number) * (g.parent?.matrixWorld.getMaxScaleOnAxis() ?? 1);
    g.scale.setScalar(Math.min(GROW.most, Math.max(1, GROW.px / (across * perMeter))));
    g.updateMatrixWorld(true);
  }
}

/** Draw a symptom as the prototype option asked for in the address does, for the ailments it has been tried on. */
export function transformSymptom(rig: CharRig, visual: Visual | undefined) {
  if (!visual) return;
  if (SYMPTOM_OPTION === 'body') bodySymptom(rig, visual);
  else if (SYMPTOM_OPTION === 'color') colorSymptom(rig, visual);
  else if (SYMPTOM_OPTION === 'grow') growSymptom(rig, visual);
}
