// Freeing a model's own materials when it leaves the scene, and never the shared ones.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { disposeOwned, owned } from '../../src/render/disposal';
import { mat } from '../../src/render/models/parts';

describe('taking a model away', () => {
  it('frees the materials it owns and leaves shared ones for everyone else', () => {
    const freed: string[] = [];
    /** Note when a material is freed. */
    const watch = <T extends THREE.Material>(m: T, name: string) => {
      m.addEventListener('dispose', () => freed.push(name));
      return m;
    };
    const model = new THREE.Group();
    const shared = watch(mat(0x123456), 'shared');
    const own = watch(owned(new THREE.MeshStandardMaterial()), 'own');
    const bubble = watch(owned(new THREE.SpriteMaterial()), 'bubble');
    const part = new THREE.Group();
    part.add(new THREE.Mesh(new THREE.BoxGeometry(), [shared, own]));
    model.add(part, new THREE.Sprite(bubble), new THREE.Mesh(new THREE.BoxGeometry(), shared));
    disposeOwned(model);
    expect(freed.sort()).toEqual(['bubble', 'own']);
  });
});
