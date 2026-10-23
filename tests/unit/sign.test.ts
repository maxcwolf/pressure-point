// The sign on the front lawn stands clear of the building's front wall and of the pavement, for every center, and
// reads from behind as well as from the street.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { CENTERS, SIDEWALK_Y } from '../../src/core/data';
import { doorstep, footprintOf } from '../../src/core/footprint';
import { CameraRig } from '../../src/render/camera';
import { buildSign } from '../../src/render/scenery';
import { OUTER_T } from '../../src/render/shared';
import { alongSign, SIGN_HALF, SIGN_LEG, signSpot } from '../../src/render/sign';

describe('the sign out front', () => {
  for (const center of Object.values(CENTERS)) {
    it(`stands clear of the wall and the pavement at ${center.name}`, () => {
      const spot = signSpot(footprintOf(center.plot));
      // the outside face of the front wall, and the near edge of the pavement
      const wall = center.plot.y1 + 1 + OUTER_T;
      for (const d of [-SIGN_HALF, -SIGN_LEG, SIGN_LEG, SIGN_HALF]) {
        const [, z] = alongSign(spot, d);
        expect(z, `${d} along the sign`).toBeGreaterThan(wall + 0.15);
        expect(z, `${d} along the sign`).toBeLessThan(SIDEWALK_Y - 0.1);
      }
    });
  }
});

/** Does nothing, for every call the sign makes to draw on its canvas. */
const nothing = () => undefined;
/** A 2D context whose every method does nothing. */
const context = new Proxy(
  {},
  {
    /** Whatever is asked for is a method that does nothing. */
    get: () => nothing,
  },
);
/** A canvas that draws nothing. */
function canvas() {
  return {
    /** The one context it has. */
    getContext: () => context,
  };
}

describe("the sign's back", () => {
  // the sign is printed on a canvas, which Node has not got: one that draws nothing will do
  beforeAll(() => {
    Object.assign(globalThis, { document: { createElement: canvas } });
  });

  it('is printed like its front, not left plain, so the sign reads when the camera looks from the north', () => {
    const sign = buildSign(footprintOf(CENTERS.willow.plot));
    const board = sign.getObjectByName('sign-board') as THREE.Mesh;
    const faces = board.material as THREE.MeshStandardMaterial[];
    // a box's front and back are its fifth and sixth faces
    const [front, back] = [faces[4], faces[5]];
    expect(front?.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(back?.map).toBe(front?.map);
  });
});

describe('the sign, from the camera', () => {
  beforeAll(() => {
    Object.assign(globalThis, { document: { createElement: canvas } });
  });

  // It used to stand back by the front wall, and at the default camera its board hid the front tile of the room by
  // the door and the people in it.
  it('leaves the room by the door in sight over its board, hiding at most a sliver along the front wall', () => {
    const rig = new CameraRig(footprintOf(CENTERS.willow.plot));
    rig.update(1 / 60);
    // the way the camera looks, and how far across the ground a point a meter up hides what is behind it
    const look = rig.target.clone().sub(rig.camera.position).normalize();
    const reach = Math.hypot(look.x, look.z) / -look.y;
    const north = (reach * -look.z) / Math.hypot(look.x, look.z);
    for (const center of Object.values(CENTERS)) {
      const fp = footprintOf(center.plot);
      const sign = buildSign(fp);
      const board = sign.getObjectByName('sign-board') as THREE.Mesh;
      const top = board.position.y + 0.5;
      // the inside of the front wall, where the rooms by the door begin
      const inside = doorstep(fp);
      for (const d of [-SIGN_HALF, 0, SIGN_HALF]) {
        const [, z] = alongSign(signSpot(fp), d);
        expect(z - top * north, `${center.name}, ${d} along the sign`).toBeGreaterThan(inside - 0.3);
      }
    }
  });
});
