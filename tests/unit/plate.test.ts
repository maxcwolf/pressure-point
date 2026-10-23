// The plate on upgraded equipment says how far it has been upgraded, so its stars must be countable at the default
// zoom, where a meter is about 30 pixels on a 1× screen: each star a few pixels across, apart from the next, on the plate.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { upgradePlate } from '../../src/render/models/plate';

/** The size of an object's box, in its plate's own space. */
function size(o: THREE.Object3D) {
  return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
}

describe('an upgrade plate', () => {
  for (const level of [1, 2, 3]) {
    it(`shows ${level} star${level > 1 ? 's' : ''} big enough to count at the default zoom`, () => {
      const plate = upgradePlate('massage_table', level);
      if (!plate) throw new Error('no plate');
      plate.position.set(0, 0, 0);
      plate.updateMatrixWorld(true);
      const [back, ...rest] = plate.children;
      if (!back) throw new Error('an empty plate');
      // the stars are the parts in front of the plate's face, smaller than it
      const stars = rest.filter((s) => size(s).x < size(back).x / 2);
      expect(stars).toHaveLength(level);
      for (const star of stars) expect(size(star).x, 'a star point to point').toBeGreaterThanOrEqual(0.1);
      const xs = stars.map((s) => s.position.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++)
        expect((xs[i] ?? 0) - (xs[i - 1] ?? 0), 'from one star to the next').toBeGreaterThanOrEqual(0.13);
      expect(size(back).x, 'the plate').toBeGreaterThan((xs.at(-1) ?? 0) - (xs[0] ?? 0) + 0.1);
    });
  }
});
