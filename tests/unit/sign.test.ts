// The sign on the front lawn stands clear of the building's front wall and of the pavement, for every center.
import { describe, expect, it } from 'vitest';

import { CENTERS, SIDEWALK_Y } from '../../src/core/data';
import { OUTER_T } from '../../src/render/shared';
import { alongSign, SIGN_HALF, SIGN_LEG, signSpot } from '../../src/render/sign';

describe('the sign out front', () => {
  for (const center of Object.values(CENTERS)) {
    it(`stands clear of the wall and the pavement at ${center.name}`, () => {
      const spot = signSpot(center.plot);
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
