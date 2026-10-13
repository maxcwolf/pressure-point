// Procedural models: furniture and the little clay people.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ITEMS, ROLES, type ItemType, type Role, type Visual } from '../data';
import type { Look } from '../state';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, rough = 0.72, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}
const rbox = (w: number, h: number, d: number, r = 0.05) =>
  cached(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));
const cyl = (rt: number, rb: number, h: number, seg = 18) =>
  cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sph = (r: number, seg = 18) => cached(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)));
const ico = (r: number) => cached(`i${r}`, () => new THREE.IcosahedronGeometry(r, 1));
const torus = (r: number, t: number) => cached(`t${r}|${t}`, () => new THREE.TorusGeometry(r, t, 10, 24));
const capsule = (r: number, len: number) => cached(`k${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));

function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const WOOD = 0xb9834f;
const WOOD_DARK = 0x8f5f38;
const CREAM = 0xf5ecdb;
const CHROME = 0xc5cbd3;
const DARK = 0x3b3f4a;
const WHITE = 0xfbfaf6;

function chair(g: THREE.Object3D, x: number, z: number, backSign: number, color: number) {
  put(g, cyl(0.04, 0.04, 0.32), mat(DARK), x, 0.16, z);
  put(g, cyl(0.2, 0.22, 0.04), mat(DARK), x, 0.02, z);
  put(g, rbox(0.46, 0.1, 0.46, 0.04), mat(color), x, 0.36, z);
  put(g, rbox(0.46, 0.5, 0.09, 0.04), mat(color), x, 0.66, z + backSign * 0.23);
}

/** Build an item in its local frame: origin at the footprint centre, +z is the front. */
export function buildItem(type: ItemType): THREE.Group {
  const g = new THREE.Group();
  switch (type) {
    case 'reception_desk': {
      put(g, rbox(2.8, 0.84, 0.66, 0.08), mat(CREAM), 0, 0.42, 0);
      put(g, rbox(2.92, 0.09, 0.8, 0.04), mat(0x2fa8a0), 0, 0.88, 0);
      put(g, rbox(2.3, 0.26, 0.04, 0.02), mat(0x2fa8a0), 0, 0.46, 0.33);
      const logo = put(g, cyl(0.19, 0.19, 0.05, 24), mat(0xf2c14e, 0.5), 0, 0.46, 0.35);
      logo.rotation.x = Math.PI / 2;
      put(g, rbox(0.42, 0.3, 0.05, 0.02), mat(DARK), -0.75, 1.14, -0.12);
      put(g, cyl(0.03, 0.05, 0.1), mat(DARK), -0.75, 0.97, -0.12);
      put(g, sph(0.07), mat(0xf2c14e, 0.35), 0.55, 0.96, 0.18);
      put(g, cyl(0.09, 0.07, 0.14), mat(0xc8744f), 1.12, 1.0, 0);
      put(g, ico(0.15), mat(0x5fae5a), 1.12, 1.2, 0);
      break;
    }
    case 'consult_desk': {
      put(g, rbox(1.8, 0.66, 0.72, 0.06), mat(WOOD_DARK), 0, 0.33, 0);
      put(g, rbox(1.9, 0.08, 0.82, 0.04), mat(WOOD), 0, 0.7, 0);
      put(g, rbox(0.5, 0.34, 0.05, 0.02), mat(DARK), 0.45, 1.0, -0.05);
      put(g, cyl(0.03, 0.06, 0.12), mat(DARK), 0.45, 0.8, -0.05);
      put(g, rbox(0.3, 0.02, 0.4, 0.01), mat(WHITE), -0.5, 0.75, 0.05);
      put(g, cyl(0.05, 0.04, 0.12), mat(0xe76f51), 0.05, 0.8, 0.2);
      chair(g, -0.5, -0.88, -1, 0x3f7fb5);
      chair(g, -0.5, 0.88, 1, 0xe9a23b);
      break;
    }
    case 'cabinet': {
      put(g, rbox(0.8, 1.1, 0.6, 0.05), mat(0x7fa0b8), 0, 0.55, -0.1);
      for (let i = 0; i < 3; i++) {
        put(g, rbox(0.66, 0.28, 0.04, 0.02), mat(0x9bb9cf), 0, 0.2 + i * 0.34, 0.2);
        put(g, rbox(0.2, 0.04, 0.04, 0.01), mat(CHROME, 0.4), 0, 0.2 + i * 0.34, 0.23);
      }
      const roll = put(g, cyl(0.05, 0.05, 0.6), mat(WHITE), 0, 1.15, -0.1);
      roll.rotation.z = Math.PI / 2;
      break;
    }
    case 'massage_table': {
      for (const [x, z] of [[-0.3, -0.75], [0.3, -0.75], [-0.3, 0.75], [0.3, 0.75]])
        put(g, cyl(0.045, 0.045, 0.5), mat(WOOD_DARK), x, 0.25, z);
      put(g, rbox(0.78, 0.06, 1.8, 0.03), mat(WOOD), 0, 0.5, 0);
      put(g, rbox(0.74, 0.12, 1.76, 0.06), mat(CREAM), 0, 0.58, 0);
      put(g, rbox(0.76, 0.03, 0.6, 0.015), mat(0xb9a1e0), 0, 0.645, 0.5);
      const cradle = put(g, torus(0.13, 0.055), mat(CREAM), 0, 0.58, -1.0);
      cradle.rotation.x = Math.PI / 2;
      break;
    }
    case 'oil_trolley': {
      for (const [x, z] of [[-0.26, -0.18], [0.26, -0.18], [-0.26, 0.18], [0.26, 0.18]]) {
        put(g, cyl(0.02, 0.02, 0.66), mat(CHROME, 0.35), x, 0.4, z);
        put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
      }
      put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(CHROME, 0.35), 0, 0.3, 0);
      put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(CHROME, 0.35), 0, 0.72, 0);
      const colors = [0xd98e3a, 0x6fae6b, 0xe58fb0, 0x7fb6d9];
      colors.forEach((c, i) => {
        put(g, cyl(0.05, 0.06, 0.2), mat(c, 0.35), -0.2 + i * 0.13, 0.84, -0.06 + (i % 2) * 0.12);
        put(g, cyl(0.025, 0.025, 0.06), mat(DARK), -0.2 + i * 0.13, 0.97, -0.06 + (i % 2) * 0.12);
      });
      for (let i = 0; i < 3; i++) {
        const towel = put(g, cyl(0.07, 0.07, 0.36), mat(WHITE), -0.16 + i * 0.16, 0.39, 0);
        towel.rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'sofa': {
      put(g, rbox(1.9, 0.3, 0.84, 0.08), mat(0xd9634c), 0, 0.2, 0);
      put(g, rbox(1.9, 0.6, 0.24, 0.1), mat(0xd9634c), 0, 0.56, -0.3);
      for (const x of [-0.86, 0.86]) put(g, rbox(0.22, 0.44, 0.84, 0.09), mat(0xc9553f), x, 0.38, 0);
      for (const x of [-0.38, 0.38]) put(g, rbox(0.72, 0.12, 0.56, 0.05), mat(0xee8a72), x, 0.37, 0.1);
      break;
    }
    case 'bench': {
      put(g, rbox(1.9, 0.07, 0.5, 0.03), mat(WOOD), 0, 0.37, 0.05);
      put(g, rbox(1.9, 0.26, 0.06, 0.03), mat(WOOD), 0, 0.7, -0.2);
      for (const x of [-0.8, 0.8]) {
        put(g, rbox(0.08, 0.36, 0.5, 0.02), mat(DARK), x, 0.18, 0.05);
        put(g, rbox(0.08, 0.5, 0.06, 0.02), mat(DARK), x, 0.6, -0.2);
      }
      break;
    }
    case 'toilet': {
      const wall = mat(0x8fd3c1);
      put(g, rbox(1.0, 1.2, 0.06, 0.02), wall, 0, 0.6, -0.46);
      for (const x of [-0.47, 0.47]) put(g, rbox(0.06, 1.2, 0.96, 0.02), wall, x, 0.6, 0);
      put(g, cyl(0.19, 0.15, 0.34), mat(WHITE, 0.3), 0, 0.17, -0.02);
      const seat = put(g, torus(0.17, 0.045), mat(WHITE, 0.3), 0, 0.35, -0.02);
      seat.rotation.x = Math.PI / 2;
      put(g, rbox(0.44, 0.34, 0.16, 0.04), mat(WHITE, 0.3), 0, 0.5, -0.33);
      break;
    }
    case 'sink': {
      put(g, rbox(0.8, 1.7, 0.06, 0.02), mat(0x8fd3c1), 0, 0.85, -0.45);
      put(g, rbox(0.5, 0.56, 0.03, 0.02), mat(0xcfeaf5, 0.15), 0, 1.3, -0.41);
      put(g, cyl(0.09, 0.12, 0.7), mat(WHITE, 0.3), 0, 0.35, -0.18);
      put(g, rbox(0.62, 0.16, 0.46, 0.06), mat(WHITE, 0.3), 0, 0.78, -0.16);
      put(g, cyl(0.02, 0.02, 0.16), mat(CHROME, 0.3), 0, 0.92, -0.34);
      break;
    }
    case 'plant': {
      put(g, cyl(0.25, 0.18, 0.36), mat(0xc8744f), 0, 0.18, 0);
      put(g, cyl(0.22, 0.22, 0.03), mat(0x5a4332), 0, 0.36, 0);
      put(g, cyl(0.035, 0.045, 0.4), mat(0x6b4f33), 0, 0.55, 0);
      // each plant owns its leaf material so it can wilt independently
      const leaf = new THREE.MeshStandardMaterial({ color: 0x57a85a, roughness: 0.8, flatShading: true });
      g.userData.leaf = leaf;
      const blobs: [number, number, number, number][] = [
        [0, 0.95, 0, 0.26], [0.2, 0.78, 0.05, 0.2], [-0.19, 0.8, -0.04, 0.2], [0.02, 0.76, -0.2, 0.18], [-0.03, 0.75, 0.2, 0.18],
      ];
      for (const [x, y, z, r] of blobs) put(g, ico(r), leaf, x, y, z);
      break;
    }
    case 'tea_station': {
      put(g, rbox(0.9, 0.8, 0.6, 0.06), mat(0x5b8c6e), 0, 0.4, -0.12);
      put(g, rbox(0.96, 0.06, 0.68, 0.03), mat(CREAM), 0, 0.83, -0.12);
      put(g, cyl(0.16, 0.17, 0.34), mat(0xc77d4a, 0.35), -0.2, 1.03, -0.16);
      put(g, sph(0.15), mat(0xc77d4a, 0.35), -0.2, 1.2, -0.16);
      put(g, sph(0.04, 10), mat(DARK), -0.2, 1.36, -0.16);
      for (let i = 0; i < 3; i++) put(g, cyl(0.055, 0.045, 0.1), mat(WHITE, 0.4), 0.14 + (i % 2) * 0.16, 0.91, -0.22 + i * 0.12);
      put(g, rbox(0.7, 0.3, 0.04, 0.02), mat(0x3f6b52), 0, 0.42, 0.19);
      break;
    }
    case 'snack_machine': {
      put(g, rbox(0.86, 1.6, 0.68, 0.07), mat(0xd98e3a), 0, 0.8, -0.1);
      put(g, rbox(0.62, 0.86, 0.04, 0.02), mat(0xfff3c4, 0.4, 0.35), 0, 1.02, 0.24);
      const snacks = [0xe76f51, 0x8ab17d, 0xe9c46a, 0x5fa8d3, 0xb56576, 0xf4a261];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++)
          put(g, rbox(0.1, 0.14, 0.04, 0.02), mat(snacks[(r * 4 + c) % snacks.length]), -0.21 + c * 0.14, 0.76 + r * 0.26, 0.27);
      put(g, rbox(0.5, 0.14, 0.04, 0.02), mat(DARK), 0, 0.3, 0.24);
      break;
    }
    case 'bin': {
      put(g, cyl(0.21, 0.16, 0.46), mat(0x6c7a89), 0, 0.23, 0);
      const rim = put(g, torus(0.21, 0.03), mat(0x57636f), 0, 0.46, 0);
      rim.rotation.x = Math.PI / 2;
      put(g, cyl(0.18, 0.18, 0.02), mat(0x23272e), 0, 0.455, 0);
      break;
    }
    case 'fountain': {
      const stone = mat(0xbdb6aa, 0.9);
      const water = mat(0x6ec6e6, 0.15, 0.25);
      put(g, cyl(0.44, 0.46, 0.24, 24), stone, 0, 0.12, 0);
      put(g, cyl(0.37, 0.37, 0.02, 24), water, 0, 0.245, 0);
      put(g, cyl(0.08, 0.11, 0.5), stone, 0, 0.45, 0);
      put(g, cyl(0.24, 0.1, 0.12, 24), stone, 0, 0.72, 0);
      put(g, cyl(0.2, 0.2, 0.02, 24), water, 0, 0.785, 0);
      const orb = put(g, sph(0.09), water, 0, 0.9, 0);
      g.userData.orb = orb;
      break;
    }
  }
  g.userData.dims = [ITEMS[type].w, ITEMS[type].h];
  return g;
}

// ---- Characters ------------------------------------------------------------
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
  visual?: Visual;
  cured: boolean;
  scale: number;
  bubbleKey: string;
}

const pickMat = new THREE.MeshBasicMaterial({ visible: false });

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
  if (role === 'receptionist') {
    const scarf = put(torso, torus(0.11, 0.035), accent, 0, 0.42, 0);
    scarf.rotation.x = Math.PI / 2;
  }
  if (role === 'consultant') put(torso, rbox(0.08, 0.14, 0.03, 0.01), accent, 0.08, 0.26, 0.15);
  if (role === 'caretaker') put(torso, rbox(0.2, 0.16, 0.03, 0.01), accent, 0, 0.2, 0.155);

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
  const cap = () =>
    cached('haircap', () => new THREE.SphereGeometry(0.228, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52));
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
    group, body, torso, legL, legR, armL, armR, head, headMesh,
    pick: new THREE.Mesh(cyl(0.34, 0.34, 1.4, 8), pickMat),
    bubble: new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })),
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
    rig.knot = put(torso, cached('knot', () => new THREE.TorusKnotGeometry(0.1, 0.038, 56, 8)), mat(0xd9584a, 0.5), 0, 0.46, -0.19);
  } else if (visual === 'steam') {
    headMesh.material = mat(0xe8836f, 0.65);
    rig.steam = new THREE.Group();
    for (let i = 0; i < 3; i++) put(rig.steam, sph(0.06, 8), mat(0xffffff, 0.9, 0.3), (i - 1) * 0.12, 0, 0).castShadow = false;
    rig.steam.position.y = 0.3;
    head.add(rig.steam);
  }
  return rig;
}

/** Undo the visible symptoms once a guest has been healed. */
export function cureRig(rig: CharRig, look: Look) {
  if (rig.cured) return;
  rig.cured = true;
  if (rig.knot) rig.knot.visible = false;
  if (rig.steam) rig.steam.visible = false;
  rig.headMesh.material = mat(look.skin, 0.65);
}

// ---- Emoji speech bubbles --------------------------------------------------
const bubbleCache = new Map<string, THREE.Texture>();
export function emojiTexture(emoji: string, plain = false): THREE.Texture {
  const key = emoji + (plain ? '|p' : '');
  let t = bubbleCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  if (!plain) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2f4858';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 58, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(48, 100);
    ctx.lineTo(64, 126);
    ctx.lineTo(80, 100);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(46, 92, 36, 12);
  }
  ctx.font = `${plain ? 92 : 62}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, plain ? 70 : 62);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bubbleCache.set(key, t);
  return t;
}

// ---- Scenery ---------------------------------------------------------------
export function buildTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.9 + (seed % 5) * 0.12;
  put(g, cyl(0.09, 0.13, h, 8), mat(0x7a5a3c, 0.9), 0, h / 2, 0);
  const green = [0x5fae5a, 0x4f9a55, 0x74b85c][seed % 3];
  const leaf = cached(`treeleaf${seed % 3}`, () => new THREE.IcosahedronGeometry(1, 1));
  const m = new THREE.MeshStandardMaterial({ color: green, roughness: 0.85, flatShading: true });
  for (const [x, y, z, r] of [[0, h + 0.45, 0, 0.62], [0.35, h + 0.15, 0.1, 0.42], [-0.3, h + 0.2, -0.15, 0.45]]) {
    const b = put(g, leaf, m, x, y, z);
    b.scale.setScalar(r);
  }
  return g;
}

export { rbox, cyl, sph, put, torus };
