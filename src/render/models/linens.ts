// A treatment table's linens: their own material, so each table's can grow grubby on its own as they are used.

import * as THREE from 'three';

import { owned } from '../disposal';

/** The dingy gray-beige linens fade toward as they are soiled. */
const GRUBBY = new THREE.Color(0x8d8270);

/** A fresh set of linens in a color, which remembers that color to fade from. */
export function linensMaterial(color: number): THREE.MeshStandardMaterial {
  const m = owned(new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.userData.fresh = new THREE.Color(color);
  return m;
}

/** Tint linens by how soiled they are, from fresh at 0 to grubby at 100. */
export function soilLinens(m: THREE.MeshStandardMaterial, dirt: number) {
  const fresh = m.userData.fresh as THREE.Color;
  m.color.lerpColors(fresh, GRUBBY, Math.max(0, Math.min(1, dirt / 100)) * 0.85);
}
