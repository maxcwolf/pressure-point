// Procedural models: furniture and the little clay people.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { ITEMS, type ItemType, type Role, ROLES, type Visual } from '../core/data';
import { type Look } from '../core/state/types';
import { at, must } from '../core/util';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** A shared material for a color, roughness and glow, made once and reused. */
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
/** A shared geometry by key, made on first use. */
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}
/** A shared rounded box geometry. */
const rbox = (w: number, h: number, d: number, r = 0.05) =>
  cached(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));
/** A shared cylinder or cone geometry. */
const cyl = (rt: number, rb: number, h: number, seg = 18) =>
  cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
/** A shared sphere geometry. */
const sph = (r: number, seg = 18) =>
  cached(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)));
/** A shared icosahedron geometry. */
const ico = (r: number) => cached(`i${r}`, () => new THREE.IcosahedronGeometry(r, 1));
/** A shared torus geometry. */
const torus = (r: number, t: number) => cached(`t${r}|${t}`, () => new THREE.TorusGeometry(r, t, 10, 24));
/** A shared capsule geometry. */
const capsule = (r: number, len: number) => cached(`k${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));

/** Add a shadow-casting mesh to a parent at a position and return it. */
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

// see-through glass for cupping cups
const GLASS = new THREE.MeshStandardMaterial({ color: 0xd4eef7, transparent: true, opacity: 0.55, roughness: 0.08 });
const LACQUER = 0x5a2e22;
const WOOD = 0xb9834f;
const WOOD_DARK = 0x8f5f38;
const CREAM = 0xf5ecdb;
const CHROME = 0xc5cbd3;
const DARK = 0x3b3f4a;
const WHITE = 0xfbfaf6;

/** Add a swivel chair to a group, with its back toward the given side. */
function chair(g: THREE.Object3D, x: number, z: number, backSign: number, color: number) {
  put(g, cyl(0.04, 0.04, 0.32), mat(DARK), x, 0.16, z);
  put(g, cyl(0.2, 0.22, 0.04), mat(DARK), x, 0.02, z);
  put(g, rbox(0.46, 0.1, 0.46, 0.04), mat(color), x, 0.36, z);
  put(g, rbox(0.46, 0.5, 0.09, 0.04), mat(color), x, 0.66, z + backSign * 0.23);
}

/** Build an item in its local frame: origin at the footprint center, +z is the front. */
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
      for (const [x, z] of [
        [-0.3, -0.75],
        [0.3, -0.75],
        [-0.3, 0.75],
        [0.3, 0.75],
      ])
        put(g, cyl(0.045, 0.045, 0.5), mat(WOOD_DARK), x, 0.25, z);
      put(g, rbox(0.78, 0.06, 1.8, 0.03), mat(WOOD), 0, 0.5, 0);
      put(g, rbox(0.74, 0.12, 1.76, 0.06), mat(CREAM), 0, 0.58, 0);
      put(g, rbox(0.76, 0.03, 0.6, 0.015), mat(0xb9a1e0), 0, 0.645, 0.5);
      const cradle = put(g, torus(0.13, 0.055), mat(CREAM), 0, 0.58, -1.0);
      cradle.rotation.x = Math.PI / 2;
      // hot stones, shown along the guest's back during a Hot Stone session
      const stones = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const stone = put(stones, sph(0.075, 10), mat(0x2f3136, 0.55), i % 2 ? 0.03 : -0.03, 0.95, -0.2 + i * 0.15);
        stone.scale.y = 0.5;
      }
      stones.visible = false;
      g.add(stones);
      // props laid on the guest during a session, keyed by the modality that uses them
      g.userData.session = { stone: stones };
      break;
    }
    case 'oil_trolley': {
      for (const [x, z] of [
        [-0.26, -0.18],
        [0.26, -0.18],
        [-0.26, 0.18],
        [0.26, 0.18],
      ]) {
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
        [0, 0.95, 0, 0.26],
        [0.2, 0.78, 0.05, 0.2],
        [-0.19, 0.8, -0.04, 0.2],
        [0.02, 0.76, -0.2, 0.18],
        [-0.03, 0.75, 0.2, 0.18],
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
      for (let i = 0; i < 3; i++)
        put(g, cyl(0.055, 0.045, 0.1), mat(WHITE, 0.4), 0.14 + (i % 2) * 0.16, 0.91, -0.22 + i * 0.12);
      put(g, rbox(0.7, 0.3, 0.04, 0.02), mat(0x3f6b52), 0, 0.42, 0.19);
      break;
    }
    case 'snack_machine': {
      put(g, rbox(0.86, 1.6, 0.68, 0.07), mat(0xd98e3a), 0, 0.8, -0.1);
      put(g, rbox(0.62, 0.86, 0.04, 0.02), mat(0xfff3c4, 0.4, 0.35), 0, 1.02, 0.24);
      const snacks = [0xe76f51, 0x8ab17d, 0xe9c46a, 0x5fa8d3, 0xb56576, 0xf4a261];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++)
          put(
            g,
            rbox(0.1, 0.14, 0.04, 0.02),
            mat(at(snacks, (r * 4 + c) % snacks.length)),
            -0.21 + c * 0.14,
            0.76 + r * 0.26,
            0.27,
          );
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
    case 'posture_scanner': {
      // console on the left tile, scanning platform on the right
      put(g, rbox(0.7, 0.9, 0.5, 0.06), mat(0x4f66b0), -0.5, 0.45, -0.15);
      const screen = put(g, rbox(0.56, 0.36, 0.05, 0.02), mat(0x9fe8ff, 0.3, 0.5), -0.5, 1.0, 0.02);
      screen.rotation.x = -0.35;
      put(g, rbox(0.5, 0.04, 0.2, 0.02), mat(DARK), -0.5, 0.92, 0.22);
      put(g, cyl(0.42, 0.45, 0.08, 28), mat(0x8d99ae, 0.5), 0.5, 0.04, 0);
      put(g, cyl(0.36, 0.36, 0.02, 28), mat(0x9fe8ff, 0.3, 0.35), 0.5, 0.09, 0);
      for (const x of [0.08, 0.92]) put(g, cyl(0.035, 0.035, 1.5, 10), mat(CHROME, 0.3), x, 0.75, -0.3);
      put(g, rbox(0.9, 0.07, 0.07, 0.02), mat(CHROME, 0.3), 0.5, 1.5, -0.3);
      // the ring sweeps up and down while a scan is running
      const ring = put(g, torus(0.4, 0.03), mat(0x4aa8ff, 0.3, 0.9), 0.5, 0.8, 0);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = false;
      g.userData.ring = ring;
      break;
    }
    case 'salt_lamp': {
      put(g, cyl(0.2, 0.22, 0.08, 16), mat(WOOD_DARK), 0, 0.04, 0);
      const salt = put(g, ico(0.24), mat(0xff9d5c, 0.5, 0.75), 0, 0.3, 0);
      salt.scale.set(0.85, 1.25, 0.85);
      salt.castShadow = false;
      break;
    }
    case 'diffuser': {
      put(g, rbox(0.34, 0.5, 0.34, 0.08), mat(WOOD), 0, 0.25, 0);
      put(g, cyl(0.13, 0.17, 0.26, 16), mat(WHITE, 0.3), 0, 0.63, 0);
      const puffs = new THREE.Group();
      for (let i = 0; i < 3; i++) put(puffs, sph(0.07, 8), mat(0xffffff, 0.9, 0.35), 0, 0, 0).castShadow = false;
      puffs.position.y = 0.8;
      g.add(puffs);
      g.userData.puffs = puffs;
      break;
    }
    case 'statue': {
      const stone = mat(0xb9b2a4, 0.85);
      put(g, rbox(0.7, 0.2, 0.7, 0.04), stone, 0, 0.1, 0);
      put(g, cyl(0.26, 0.32, 0.3, 14), stone, 0, 0.35, 0);
      put(g, capsule(0.19, 0.2), stone, 0, 0.72, 0);
      put(g, sph(0.17, 14), stone, 0, 1.08, 0);
      put(g, sph(0.07, 10), stone, 0, 1.26, 0);
      for (const x of [-0.24, 0.24]) put(g, sph(0.09, 10), stone, x, 0.5, 0.14);
      break;
    }
    case 'rug': {
      put(g, rbox(1.84, 0.03, 1.84, 0.015), mat(0xb5524a, 0.95), 0, 0.016, 0).castShadow = false;
      put(g, rbox(1.5, 0.034, 1.5, 0.015), mat(0xe9c46a, 0.95), 0, 0.018, 0).castShadow = false;
      put(g, rbox(1.16, 0.038, 1.16, 0.015), mat(0x2a9d8f, 0.95), 0, 0.02, 0).castShadow = false;
      const diamond = put(g, rbox(0.56, 0.042, 0.56, 0.015), mat(0xf5ecdb, 0.95), 0, 0.022, 0);
      diamond.rotation.y = Math.PI / 4;
      diamond.castShadow = false;
      break;
    }
    case 'magazine_rack': {
      put(g, rbox(0.7, 0.9, 0.08, 0.03), mat(WOOD_DARK), 0, 0.5, -0.25);
      for (const x of [-0.33, 0.33]) put(g, rbox(0.05, 0.9, 0.4, 0.02), mat(WOOD_DARK), x, 0.5, -0.07);
      const covers = [0xe76f51, 0x5fa8d3, 0xe9c46a, 0x8ab17d, 0xb56576, 0xf4a261];
      for (let row = 0; row < 3; row++) {
        put(g, rbox(0.66, 0.04, 0.28, 0.01), mat(WOOD), 0, 0.2 + row * 0.28, -0.07);
        for (let c = 0; c < 2; c++) {
          const mag = put(
            g,
            rbox(0.26, 0.22, 0.03, 0.01),
            mat(at(covers, (row * 2 + c) % covers.length)),
            -0.15 + c * 0.3,
            0.33 + row * 0.28,
            -0.02,
          );
          mag.rotation.x = -0.25;
        }
      }
      break;
    }
    case 'acu_table': {
      for (const [x, z] of [
        [-0.3, -0.75],
        [0.3, -0.75],
        [-0.3, 0.75],
        [0.3, 0.75],
      ])
        put(g, rbox(0.09, 0.5, 0.09, 0.02), mat(LACQUER), x, 0.25, z);
      put(g, rbox(0.8, 0.07, 1.82, 0.03), mat(LACQUER), 0, 0.5, 0);
      put(g, rbox(0.74, 0.12, 1.76, 0.06), mat(0x9ad0b8), 0, 0.58, 0);
      put(g, rbox(0.7, 0.03, 1.1, 0.015), mat(CREAM), 0, 0.645, 0.2);
      const bolster = put(g, cyl(0.09, 0.09, 0.6, 14), mat(0xb5523e), 0, 0.68, -0.72);
      bolster.rotation.z = Math.PI / 2;
      // what gets put on the guest's back, one set per technique
      /** Stand one needle with a colored tip at a spot. */
      const needle = (parent: THREE.Object3D, x: number, z: number, color: number) => {
        put(parent, cyl(0.007, 0.007, 0.16, 5), mat(CHROME, 0.3), x, 1.0, z).castShadow = false;
        put(parent, sph(0.02, 6), mat(color, 0.4), x, 1.08, z).castShadow = false;
      };
      const spots: [number, number][] = [
        [-0.07, -0.2],
        [0.07, -0.2],
        [-0.08, -0.05],
        [0.08, -0.05],
        [-0.07, 0.1],
        [0.07, 0.1],
        [-0.05, 0.25],
        [0.05, 0.25],
      ];
      const needles = new THREE.Group();
      spots.forEach(([x, z], i) => needle(needles, x, z, at([0xe5484d, 0xf2c14e, 0x4a9fe0], i % 3)));
      const cups = new THREE.Group();
      for (const [x, z] of spots.slice(0, 6)) {
        const cup = put(cups, sph(0.062, 12), GLASS, x, 0.95, z);
        cup.scale.y = 0.8;
        cup.castShadow = false;
      }
      const moxa = new THREE.Group();
      for (const [x, z] of [
        [0, -0.18],
        [0, 0.02],
        [0, 0.22],
      ]) {
        put(moxa, cyl(0.018, 0.03, 0.09, 8), mat(0x6b5a3a, 0.9), x, 0.97, z).castShadow = false;
        put(moxa, sph(0.022, 8), mat(0xff7a2f, 0.4, 1.2), x, 1.02, z).castShadow = false;
      }
      const electro = new THREE.Group();
      spots.slice(0, 4).forEach(([x, z], i) => {
        needle(electro, x, z, i % 2 ? 0x2a2a2e : 0xe5484d);
        const wire = put(electro, cyl(0.006, 0.006, 0.5, 5), mat(i % 2 ? 0x2a2a2e : 0xe5484d), x - 0.25, 1.1, z);
        wire.rotation.z = Math.PI / 2 - 0.12;
        wire.castShadow = false;
      });
      const session = { needling: needles, cupping: cups, moxa, electro };
      for (const group of Object.values(session)) {
        group.visible = false;
        g.add(group);
      }
      g.userData.session = session;
      break;
    }
    case 'needle_cabinet': {
      put(g, rbox(0.88, 1.3, 0.5, 0.04), mat(LACQUER), 0, 0.65, -0.18);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          const x = -0.3 + col * 0.2;
          const y = 0.2 + row * 0.23;
          put(g, rbox(0.17, 0.19, 0.03, 0.01), mat(WOOD), x, y, 0.075);
          put(g, sph(0.018, 6), mat(0xf2c14e, 0.4), x, y, 0.1);
        }
      }
      put(g, cyl(0.07, 0.07, 0.16, 12), GLASS, 0.24, 1.38, -0.18);
      const scroll = put(g, cyl(0.045, 0.045, 0.5, 10), mat(CREAM), -0.12, 1.35, -0.18);
      scroll.rotation.z = Math.PI / 2;
      break;
    }
    case 'cupping_cart': {
      for (const [x, z] of [
        [-0.26, -0.18],
        [0.26, -0.18],
        [-0.26, 0.18],
        [0.26, 0.18],
      ]) {
        put(g, cyl(0.02, 0.02, 0.66, 8), mat(LACQUER), x, 0.4, z);
        put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
      }
      put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(WOOD_DARK), 0, 0.3, 0);
      put(g, rbox(0.62, 0.04, 0.46, 0.02), mat(WOOD_DARK), 0, 0.72, 0);
      for (let i = 0; i < 6; i++) {
        const cup = put(g, sph(0.075, 12), GLASS, -0.19 + (i % 3) * 0.19, 0.8, -0.09 + Math.floor(i / 3) * 0.18);
        cup.scale.y = 0.85;
      }
      put(g, rbox(0.4, 0.1, 0.3, 0.03), mat(WHITE), 0, 0.37, 0);
      break;
    }
    case 'moxa_burner': {
      put(g, cyl(0.2, 0.26, 0.08, 16), mat(LACQUER), 0, 0.04, 0);
      put(g, cyl(0.05, 0.07, 0.5, 10), mat(LACQUER), 0, 0.33, 0);
      put(g, cyl(0.26, 0.15, 0.18, 20), mat(0x2f6f6a, 0.4), 0, 0.67, 0);
      put(g, cyl(0.23, 0.23, 0.02, 20), mat(0x8a8378, 0.95), 0, 0.755, 0);
      for (const [x, z, lean] of [
        [-0.07, 0.02, 0.2],
        [0.06, -0.04, -0.15],
        [0.01, 0.08, 0.05],
      ] as const) {
        const stick = put(g, cyl(0.016, 0.016, 0.22, 6), mat(0x6b5a3a, 0.9), x, 0.86, z);
        stick.rotation.z = lean;
        put(g, sph(0.022, 8), mat(0xff7a2f, 0.4, 1.2), x - lean * 0.11, 0.97, z).castShadow = false;
      }
      const smoke = new THREE.Group();
      for (let i = 0; i < 3; i++) put(smoke, sph(0.06, 8), mat(0xe8e4dc, 0.9, 0.2), 0, 0, 0).castShadow = false;
      smoke.position.y = 1.0;
      g.add(smoke);
      g.userData.puffs = smoke;
      break;
    }
    case 'stim_unit': {
      for (const [x, z] of [
        [-0.24, -0.16],
        [0.24, -0.16],
        [-0.24, 0.16],
        [0.24, 0.16],
      ])
        put(g, sph(0.05, 10), mat(DARK), x, 0.05, z);
      put(g, rbox(0.62, 0.66, 0.46, 0.05), mat(0xd7dce2), 0, 0.42, 0);
      const face = put(g, rbox(0.58, 0.26, 0.05, 0.02), mat(DARK), 0, 0.88, 0.12);
      face.rotation.x = -0.5;
      put(g, rbox(0.2, 0.12, 0.02, 0.01), mat(0x7dffb0, 0.3, 0.8), -0.14, 0.9, 0.16).rotation.x = -0.5;
      for (const x of [0.06, 0.18]) {
        const dial = put(g, cyl(0.04, 0.04, 0.04, 12), mat(0xf2c14e, 0.4), x, 0.89, 0.17);
        dial.rotation.x = Math.PI / 2 - 0.5;
      }
      // each unit owns its light so it can blink independently
      const led = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff3b30, emissiveIntensity: 1 });
      put(g, sph(0.03, 8), led, 0.24, 0.98, 0.1).castShadow = false;
      g.userData.led = led;
      for (const [x, c] of [
        [-0.33, 0xe5484d],
        [0.33, 0x2a2a2e],
      ] as [number, number][]) {
        const coil = put(g, torus(0.09, 0.014), mat(c), x, 0.55, 0.05);
        coil.rotation.y = Math.PI / 2;
      }
      break;
    }
    case 'stone_warmer': {
      put(g, rbox(0.72, 0.5, 0.6, 0.06), mat(0x4a4f5a), 0, 0.25, 0);
      put(g, rbox(0.78, 0.06, 0.66, 0.03), mat(CHROME, 0.35), 0, 0.53, 0);
      put(g, cyl(0.27, 0.22, 0.22, 20), mat(0xb5714a, 0.4), 0, 0.67, 0);
      // each warmer owns its glow so it can cool independently
      const glow = new THREE.MeshStandardMaterial({
        color: 0x2b2b30,
        roughness: 0.5,
        emissive: 0xff5a1f,
        emissiveIntensity: 1,
      });
      g.userData.glow = glow;
      put(g, cyl(0.24, 0.24, 0.02, 20), glow, 0, 0.775, 0);
      for (const [x, z] of [
        [0, 0],
        [0.12, 0.08],
        [-0.11, 0.07],
        [0.04, -0.13],
        [-0.09, -0.09],
      ]) {
        const stone = put(g, sph(0.075, 10), mat(0x2f3136, 0.55), x, 0.81, z);
        stone.scale.y = 0.5;
      }
      const dial = put(g, cyl(0.055, 0.055, 0.03, 12), mat(0xe9c46a, 0.4), 0.2, 0.3, 0.31);
      dial.rotation.x = Math.PI / 2;
      break;
    }
    case 'stretch_rack': {
      for (const x of [-0.37, 0.37]) put(g, rbox(0.06, 1.2, 0.42, 0.02), mat(WOOD_DARK), x, 0.6, -0.1);
      for (const y of [0.22, 0.6, 0.98]) put(g, rbox(0.76, 0.04, 0.42, 0.02), mat(WOOD), 0, y, -0.1);
      const rolls: [number, number, number, number][] = [
        [0.33, -0.18, 0x8a6fd1, 0.09],
        [0.33, 0, 0x2fa8a0, 0.09],
        [0.71, -0.16, 0xe76f51, 0.09],
        [0.71, 0.02, 0xe9c46a, 0.09],
        [1.1, -0.1, 0x4a9fe0, 0.1],
      ];
      for (const [y, z, c, r] of rolls) {
        const roll = put(g, cyl(r, r, 0.62, 14), mat(c, 0.85), 0, y, z);
        roll.rotation.z = Math.PI / 2;
      }
      for (const [y, c] of [
        [0.85, 0xe5484d],
        [0.62, 0x3bb273],
      ] as [number, number][]) {
        const band = put(g, torus(0.085, 0.018), mat(c), 0.42, y, 0);
        band.rotation.y = Math.PI / 2;
      }
      break;
    }
    case 'whiteboard': {
      put(g, rbox(1.82, 1.04, 0.05, 0.03), mat(0x8d99ae), 0, 1.15, -0.29);
      put(g, rbox(1.7, 0.92, 0.04, 0.02), mat(WHITE, 0.35), 0, 1.15, -0.26);
      put(g, rbox(1.3, 0.04, 0.1, 0.02), mat(0x8d99ae), 0, 0.64, -0.22);
      for (const x of [-0.78, 0.78]) {
        put(g, cyl(0.03, 0.03, 1.6, 8), mat(0x8d99ae), x, 0.8, -0.3);
        put(g, rbox(0.08, 0.05, 0.5, 0.02), mat(DARK), x, 0.03, -0.3);
      }
      // a diagram of a shoulder with arrows pointing at it
      const blob = put(g, torus(0.17, 0.02), mat(0xe5484d), -0.4, 1.2, -0.235);
      blob.scale.y = 0.75;
      put(g, rbox(0.3, 0.025, 0.01, 0.005), mat(0x3f7fb5), -0.02, 1.3, -0.235).rotation.z = -0.5;
      put(g, rbox(0.3, 0.025, 0.01, 0.005), mat(0x3f7fb5), -0.02, 1.08, -0.235).rotation.z = 0.5;
      for (let i = 0; i < 4; i++)
        put(
          g,
          rbox(0.5 - (i % 2) * 0.14, 0.022, 0.01, 0.005),
          mat(DARK),
          0.45 - (i % 2) * 0.07,
          1.36 - i * 0.12,
          -0.235,
        );
      put(g, rbox(0.1, 0.04, 0.06, 0.01), mat(0xe5484d), -0.3, 0.68, -0.22);
      put(g, rbox(0.1, 0.04, 0.06, 0.01), mat(0x3f7fb5), -0.1, 0.68, -0.22);
      break;
    }
    case 'study_desk': {
      put(g, rbox(0.84, 0.06, 0.54, 0.03), mat(WOOD), 0, 0.62, -0.02);
      for (const [x, z] of [
        [-0.36, -0.22],
        [0.36, -0.22],
        [-0.36, 0.18],
        [0.36, 0.18],
      ])
        put(g, cyl(0.03, 0.03, 0.6, 8), mat(DARK), x, 0.3, z);
      put(g, rbox(0.3, 0.05, 0.22, 0.02), mat(0x5f9440), -0.12, 0.68, 0);
      put(g, rbox(0.26, 0.04, 0.2, 0.02), mat(0xe76f51), -0.1, 0.725, 0.01).rotation.y = 0.3;
      put(g, cyl(0.045, 0.04, 0.1, 10), mat(WHITE, 0.4), 0.26, 0.7, -0.08);
      chair(g, 0, 0.82, 1, 0x5f9440);
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
    bubble: new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })),
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
    rig.blink = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff3b30, emissiveIntensity: 1 });
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

// ---- Emoji speech bubbles --------------------------------------------------
const bubbleCache = new Map<string, THREE.Texture>();
/** A cached texture of an emoji, in a speech bubble unless plain. */
export function emojiTexture(emoji: string, plain = false): THREE.Texture {
  const key = emoji + (plain ? '|p' : '');
  let t = bubbleCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = must(c.getContext('2d'), '2D canvas');
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
/** Build a tree whose height and color vary with the seed. */
export function buildTree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.9 + (seed % 5) * 0.12;
  put(g, cyl(0.09, 0.13, h, 8), mat(0x7a5a3c, 0.9), 0, h / 2, 0);
  const green = at([0x5fae5a, 0x4f9a55, 0x74b85c], seed % 3);
  const leaf = cached(`treeleaf${seed % 3}`, () => new THREE.IcosahedronGeometry(1, 1));
  const m = new THREE.MeshStandardMaterial({ color: green, roughness: 0.85, flatShading: true });
  for (const [x, y, z, r] of [
    [0, h + 0.45, 0, 0.62],
    [0.35, h + 0.15, 0.1, 0.42],
    [-0.3, h + 0.2, -0.15, 0.45],
  ] as const) {
    const b = put(g, leaf, m, x, y, z);
    b.scale.setScalar(r);
  }
  return g;
}

export { cyl, put, rbox, sph, torus };
