import { describe, expect, it } from 'vitest';

import { coverCrop } from '../../src/render/cover-crop';

describe('cropping a picture to fill another shape', () => {
  it('trims the sides of a wider picture, keeping the middle', () => {
    expect(coverCrop(1600, 800, 320, 200)).toEqual({ sx: 160, sy: 0, sw: 1280, sh: 800 });
  });

  it('trims the top and bottom of a taller picture', () => {
    expect(coverCrop(800, 800, 320, 200)).toEqual({ sx: 0, sy: 150, sw: 800, sh: 500 });
  });

  it('keeps the whole of a picture already the right shape', () => {
    expect(coverCrop(640, 400, 320, 200)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 400 });
  });
});
