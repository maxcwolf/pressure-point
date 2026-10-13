import { describe, expect, it } from 'vitest';

import { DRAG_PX, isClick, isDragging, QUICK_MS, QUICK_PX } from '../../src/app/click';

describe('telling a click from a drag', () => {
  it('does not call the few pixels of drift in an ordinary click a drag', () => {
    // a hand or a trackpad easily moves this much between press and release
    for (const [dx, dy] of [
      [0, 0],
      [3, 2],
      [6, 4],
      [7, 6],
      [-8, 3],
    ] as const)
      expect(isDragging(dx, dy), `${dx},${dy}`).toBe(false);
    expect(DRAG_PX).toBeGreaterThanOrEqual(10);
  });

  it('calls real movement a drag', () => {
    expect(isDragging(DRAG_PX + 1, 0)).toBe(true);
    expect(isDragging(8, 8)).toBe(true);
    expect(isDragging(0, -40)).toBe(true);
  });

  it('counts a release as a click when the pointer never dragged', () => {
    expect(isClick(false, 50, 4)).toBe(true);
    // however long the button was held
    expect(isClick(false, 5000, 9)).toBe(true);
  });

  it('forgives a fast click that skidded a bit further', () => {
    expect(isClick(true, QUICK_MS - 1, QUICK_PX - 1)).toBe(true);
  });

  it('does not mistake a real drag for a click', () => {
    expect(isClick(true, QUICK_MS - 1, QUICK_PX + 1)).toBe(false);
    expect(isClick(true, QUICK_MS + 1, QUICK_PX - 1)).toBe(false);
    expect(isClick(true, 800, 150)).toBe(false);
  });
});
