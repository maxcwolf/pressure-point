// The little clay people: guests and staff, and what their symptoms look like.
import * as THREE from 'three';

import { type Role, ROLES, type Visual } from '../../core/data';
import type { Look } from '../../core/state/types';
import { owned } from '../disposal';
import { cached, capsule, cyl, ico, mat, put, rbox, sph, torus } from './parts';

export interface CharRig {
  group: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  headMesh: THREE.Mesh;
  pick: THREE.Mesh;
  bubble: THREE.Sprite;
  knot?: THREE.Mesh;
  steam?: THREE.Group;
  band?: THREE.Mesh;
  orbit?: THREE.Group;
  /** Something that hovers over the head and bobs gently. */
  bob?: THREE.Object3D;
  /** A material whose glow pulses. */
  blink?: THREE.MeshStandardMaterial;
  /** Everything that only exists to show the symptom, hidden once healed. */
  props: THREE.Object3D[];
  visual: Visual | undefined;
  cured: boolean;
  scale: number;
  bubbleKey: string;
}

const pickMat = new THREE.MeshBasicMaterial({ visible: false });

/** Build a person: a uniformed member of staff, or a guest showing their symptom. */
export function buildCharacter(look: Look, role?: Role, visual?: Visual): CharRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(look.scale);
  group.add(body);
  const skin = mat(look.skin, 0.65);
  const topColor = role ? ROLES[role].uniform : look.top;
  const top = mat(topColor, 0.7);
  const bottom = mat(role === 'caretaker' ? 0x5c6b33 : look.bottom, 0.8);
  const accent = role ? mat(ROLES[role].accent, 0.6) : top;

  /** Add a leg with its shoe, hinged at the hip. */
  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.42, 0);
    put(leg, cyl(0.078, 0.07, 0.36, 12), bottom, 0, -0.18, 0);
    put(leg, rbox(0.15, 0.09, 0.24, 0.04), mat(0x3a302b), 0, -0.375, 0.035);
    body.add(leg);
    return leg;
  };
  const legL = makeLeg(-0.095);
  const legR = makeLeg(0.095);

  // torso group pivots at the hips so slumps and leans bend in the right place
  const torso = new THREE.Group();
  torso.position.set(0, 0.42, 0);
  body.add(torso);
  const chest = put(torso, capsule(0.17, 0.2), top, 0, 0.2, 0);
  chest.scale.set(1.12, 1, 0.9);
  if (role === 'consultant') put(torso, cyl(0.2, 0.22, 0.24, 14), top, 0, -0.04, 0);
  if (role === 'acupuncturist') put(torso, rbox(0.09, 0.1, 0.03, 0.01), accent, -0.08, 0.26, 0.15);
  if (role === 'receptionist' || role === 'acupuncturist') {
    const scarf = put(torso, torus(0.11, 0.035), accent, 0, 0.42, 0);
    scarf.rotation.x = Math.PI / 2;
  }
  if (role === 'consultant') put(torso, rbox(0.08, 0.14, 0.03, 0.01), accent, 0.08, 0.26, 0.15);
  if (role === 'caretaker') put(torso, rbox(0.2, 0.16, 0.03, 0.01), accent, 0, 0.2, 0.155);
  if (role === 'practitioner') {
    const chain = put(torso, torus(0.13, 0.012), mat(0xc9963f, 0.3), 0, 0.36, 0.03);
    chain.rotation.x = Math.PI / 2 - 0.5;
    put(torso, sph(0.04, 10), accent, 0, 0.27, 0.17);
  }

  /** Add an arm with its hand, hinged at the shoulder. */
  const makeArm = (x: number) => {
    const arm = new THREE.Group();
    arm.position.set(x, 0.37, 0);
    put(arm, capsule(0.055, 0.17), top, 0, -0.13, 0);
    put(arm, sph(0.062, 10), skin, 0, -0.29, 0);
    torso.add(arm);
    return arm;
  };
  const armL = makeArm(-0.245);
  const armR = makeArm(0.245);

  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  torso.add(head);
  const headMesh = put(head, sph(0.215, 20), skin, 0, 0, 0);
  for (const x of [-0.075, 0.075]) put(head, sph(0.027, 8), mat(0x2a2422, 0.3), x, 0.02, 0.19);
  put(head, sph(0.03, 8), skin, 0, -0.035, 0.21);
  const hair = mat(look.hair, 0.85);
  /** The shared half-sphere cap of hair. */
  const cap = () => cached('haircap', () => new THREE.SphereGeometry(0.228, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52));
  const style = role === 'caretaker' ? 0 : look.hairStyle;
  if (style !== 3) {
    const c = put(head, cap(), hair, 0, 0.012, -0.018);
    c.rotation.x = -0.28;
  }
  if (style === 1) put(head, sph(0.1, 12), hair, 0, 0.22, -0.1);
  if (style === 2) put(head, rbox(0.4, 0.34, 0.16, 0.07), hair, 0, -0.08, -0.15);
  if (style === 4) put(head, sph(0.25, 14), hair, 0, 0.06, -0.06);
  if (role === 'caretaker') {
    put(head, cyl(0.2, 0.22, 0.1, 16), accent, 0, 0.18, 0);
    put(head, rbox(0.3, 0.03, 0.2, 0.01), accent, 0, 0.14, 0.2);
  }
  if (role === 'therapist') {
    const band = put(head, torus(0.212, 0.03), accent, 0, 0.07, 0);
    band.rotation.x = Math.PI / 2 - 0.2;
  }

  const rig: CharRig = {
    group,
    body,
    torso,
    legL,
    legR,
    armL,
    armR,
    head,
    headMesh,
    pick: new THREE.Mesh(cyl(0.34, 0.34, 1.4, 8), pickMat),
    bubble: new THREE.Sprite(owned(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))),
    props: [],
    visual,
    cured: false,
    scale: look.scale,
    bubbleKey: '',
  };
  rig.pick.position.y = 0.7;
  group.add(rig.pick);
  rig.bubble.scale.setScalar(0.62);
  rig.bubble.position.y = 1.72;
  rig.bubble.visible = false;
  rig.bubble.renderOrder = 10;
  group.add(rig.bubble);

  if (visual === 'knot') {
    rig.knot = put(
      torso,
      cached('knot', () => new THREE.TorusKnotGeometry(0.1, 0.038, 56, 8)),
      mat(0xd9584a, 0.5),
      0,
      0.46,
      -0.19,
    );
  } else if (visual === 'steam') {
    headMesh.material = mat(0xe8836f, 0.65);
    rig.steam = new THREE.Group();
    for (let i = 0; i < 3; i++)
      put(rig.steam, sph(0.06, 8), mat(0xffffff, 0.9, 0.3), (i - 1) * 0.12, 0, 0).castShadow = false;
    rig.steam.position.y = 0.3;
    head.add(rig.steam);
  } else if (visual === 'band') {
    rig.band = put(head, torus(0.226, 0.038), mat(0xe5484d, 0.4, 0.7), 0, 0.07, 0);
    rig.band.rotation.x = Math.PI / 2;
  } else if (visual === 'flex') {
    for (const arm of [armL, armR]) rig.props.push(put(arm, sph(0.092, 12), top, 0, -0.1, 0.02));
  } else if (visual === 'frost') {
    const ice = mat(0xcdeeff, 0.15, 0.25);
    rig.props.push(put(torso, ico(0.135), ice, 0.21, 0.4, 0));
    const icicle = put(torso, cyl(0.035, 0.001, 0.16, 6), ice, 0.3, 0.26, 0.02);
    rig.props.push(icicle, put(torso, cyl(0.03, 0.001, 0.11, 6), ice, 0.2, 0.25, 0.1));
  } else if (visual === 'dizzy') {
    rig.orbit = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const star = put(
        rig.orbit,
        cached('dizzystar', () => new THREE.OctahedronGeometry(0.055)),
        mat(0xffd23f, 0.3, 0.8),
        Math.cos(a) * 0.27,
        0,
        Math.sin(a) * 0.27,
      );
      star.castShadow = false;
    }
    rig.orbit.position.y = 0.3;
    head.add(rig.orbit);
  } else if (visual === 'cloud') {
    const cloud = new THREE.Group();
    for (const [x, y, r] of [
      [-0.12, 0, 0.11],
      [0.02, 0.05, 0.14],
      [0.14, 0, 0.1],
    ] as const)
      put(cloud, sph(r, 10), mat(0x7d8894, 0.95), x, y, 0).castShadow = false;
    cloud.position.y = 0.4;
    head.add(cloud);
    rig.bob = cloud;
  } else if (visual === 'aura') {
    rig.orbit = new THREE.Group();
    const ring = put(rig.orbit, torus(0.36, 0.035), mat(0x7a4f9a, 0.5, 0.5), 0, 0, 0);
    ring.rotation.x = Math.PI / 2 + 0.3;
    ring.castShadow = false;
    rig.orbit.position.y = 0.22;
    torso.add(rig.orbit);
  } else if (visual === 'cork') {
    rig.props.push(put(head, cyl(0.07, 0.09, 0.15, 12), mat(0xc9a56a, 0.95), 0, 0.26, 0));
    const neck = put(head, torus(0.095, 0.025), mat(0x3f6b52, 0.3), 0, 0.2, 0);
    neck.rotation.x = Math.PI / 2;
    rig.props.push(neck);
  } else if (visual === 'coldfeet') {
    const ice = mat(0xcdeeff, 0.15, 0.25);
    for (const leg of [legL, legR]) rig.props.push(put(leg, rbox(0.21, 0.15, 0.3, 0.03), ice, 0, -0.36, 0.035));
  } else if (visual === 'blanket') {
    const wool = mat(0x4d7ea8, 0.95);
    rig.props.push(put(torso, rbox(0.52, 0.1, 0.38, 0.04), wool, 0, 0.4, -0.01));
    for (const x of [-0.25, 0.25]) rig.props.push(put(torso, rbox(0.1, 0.3, 0.36, 0.04), wool, x, 0.26, -0.01));
    for (const [x, y] of [
      [-0.25, 0.08],
      [0.25, 0.05],
      [0.1, 0.02],
    ])
      rig.props.push(put(torso, sph(0.03, 8), mat(0x6ec6e6, 0.2), x, y, 0.12));
  } else if (visual === 'battery') {
    const cell = new THREE.Group();
    put(cell, rbox(0.26, 0.13, 0.09, 0.02), mat(0x2f3136, 0.6), 0, 0, 0).castShadow = false;
    put(cell, rbox(0.03, 0.06, 0.05, 0.01), mat(0x2f3136, 0.6), 0.145, 0, 0).castShadow = false;
    rig.blink = owned(new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff3b30, emissiveIntensity: 1 }));
    put(cell, rbox(0.05, 0.09, 0.1, 0.01), rig.blink, -0.085, 0, 0).castShadow = false;
    cell.position.y = 0.4;
    head.add(cell);
    rig.bob = cell;
  } else if (visual === 'wires') {
    const tangle = new THREE.Group();
    const knot = cached('knot', () => new THREE.TorusKnotGeometry(0.1, 0.038, 56, 8));
    put(tangle, knot, mat(0xe5484d, 0.5), 0, 0, 0).scale.setScalar(0.85);
    const second = put(tangle, knot, mat(0x4a9fe0, 0.5), 0, 0, 0);
    second.scale.setScalar(0.85);
    second.rotation.set(1.2, 0.6, 0);
    tangle.position.y = 0.3;
    head.add(tangle);
    rig.knot = tangle as unknown as THREE.Mesh;
  } else if (visual === 'pale') {
    headMesh.material = mat(0xd3cfcb, 0.65);
  } else if (visual === 'static') {
    // hair standing on end, with a spark or two
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const spike = put(head, cyl(0.002, 0.024, 0.14, 5), hair, Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12 - 0.02);
      spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      rig.props.push(spike);
    }
    rig.orbit = new THREE.Group();
    for (const a of [0, Math.PI]) {
      const spark = put(
        rig.orbit,
        cached('spark', () => new THREE.OctahedronGeometry(0.035)),
        mat(0xfff27a, 0.3, 1.2),
      );
      spark.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      spark.castShadow = false;
    }
    rig.orbit.position.y = 0.2;
    head.add(rig.orbit);
  } else if (visual === 'shards') {
    // pieces of them, drifting round
    rig.orbit = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const shard = put(
        rig.orbit,
        ico(0.045),
        mat(i % 2 ? 0xb9a7d9 : 0x9aa4b0, 0.4),
        Math.cos(a) * 0.36,
        0,
        Math.sin(a) * 0.36,
      );
      shard.scale.y = 1.6;
      shard.castShadow = false;
    }
    rig.orbit.position.y = 0.25;
    torso.add(rig.orbit);
  } else if (visual === 'bulb') {
    // a dim light bulb that keeps flickering
    const lamp = new THREE.Group();
    rig.blink = owned(new THREE.MeshStandardMaterial({ color: 0x8f8a6a, emissive: 0xfff0a0, emissiveIntensity: 0.4 }));
    put(lamp, sph(0.075, 14), rig.blink, 0, 0, 0).castShadow = false;
    put(lamp, cyl(0.035, 0.035, 0.06, 10), mat(0x9aa4b0, 0.4), 0, -0.08, 0).castShadow = false;
    lamp.position.y = 0.42;
    head.add(lamp);
    rig.bob = lamp;
  } else if (visual === 'notes') {
    // a few sour notes going round the head
    rig.orbit = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const note = new THREE.Group();
      put(note, sph(0.032, 8), mat(0x2a2422, 0.4), 0, 0, 0).scale.set(1.2, 0.85, 1);
      put(note, cyl(0.007, 0.007, 0.1, 5), mat(0x2a2422, 0.4), 0.032, 0.05, 0);
      note.position.set(Math.cos(a) * 0.3, (i - 1) * 0.04, Math.sin(a) * 0.3);
      rig.orbit.add(note);
    }
    rig.orbit.position.y = 0.25;
    head.add(rig.orbit);
  } else if (visual === 'gears') {
    // a cog turning over the head
    rig.orbit = new THREE.Group();
    const steel = mat(0x8c939c, 0.35);
    put(rig.orbit, torus(0.07, 0.025), steel, 0, 0, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tooth = put(rig.orbit, rbox(0.04, 0.03, 0.04, 0.005), steel, Math.cos(a) * 0.105, 0, Math.sin(a) * 0.105);
      tooth.rotation.y = -a;
    }
    rig.orbit.position.y = 0.36;
    head.add(rig.orbit);
  } else if (visual === 'chakra') {
    // seven glowing centers down the front, the third gone dark
    const colors = [0x9b6fd1, 0x5b5fc7, 0x4a9fe0, 0x3bb273, 0xf2c14e, 0xf08a4b, 0xe5484d];
    colors.forEach((color, i) => {
      const blocked = i === 4;
      const dot = put(
        torso,
        sph(0.028, 8),
        mat(blocked ? 0x4a4a4a : color, 0.3, blocked ? 0 : 0.8),
        0,
        0.46 - i * 0.065,
        0.165,
      );
      dot.castShadow = false;
      rig.props.push(dot);
    });
  } else if (visual === 'gull') {
    // a seagull, settled in for the day
    const bird = new THREE.Group();
    const white = mat(0xf7f7f2, 0.6);
    put(bird, sph(0.075, 10), white, 0, 0, 0).scale.set(1.5, 0.85, 1);
    put(bird, sph(0.045, 10), white, 0.1, 0.05, 0);
    put(bird, cyl(0.001, 0.018, 0.06, 6), mat(0xf2a33a, 0.4), 0.15, 0.045, 0).rotation.z = -Math.PI / 2;
    for (const z of [-0.06, 0.06]) put(bird, rbox(0.13, 0.025, 0.06, 0.01), mat(0x6f7884, 0.6), -0.02, 0.035, z);
    put(bird, sph(0.012, 6), mat(0x1d1f24, 0.3), 0.13, 0.065, 0.03);
    bird.scale.setScalar(1.7);
    bird.position.y = 0.3;
    bird.rotation.y = 0.6;
    for (const o of bird.children) o.castShadow = false;
    head.add(bird);
    rig.props.push(bird);
  } else if (visual === 'sunburn') {
    // lobster red, behind a pair of sunglasses
    headMesh.material = mat(0xe8604c, 0.6);
    const shades = mat(0x1d1f24, 0.2);
    for (const x of [-0.075, 0.075]) rig.props.push(put(head, rbox(0.1, 0.06, 0.02, 0.01), shades, x, 0.025, 0.2));
    rig.props.push(put(head, rbox(0.06, 0.012, 0.012, 0.004), shades, 0, 0.04, 0.205));
  }
  for (const o of [rig.knot, rig.steam, rig.band, rig.orbit, rig.bob]) if (o) rig.props.push(o);
  return rig;
}

/** Undo the visible symptoms once a guest has been healed. */
export function cureRig(rig: CharRig, look: Look) {
  if (rig.cured) return;
  rig.cured = true;
  for (const o of rig.props) o.visible = false;
  rig.headMesh.material = mat(look.skin, 0.65);
}
