// The announcer's filler lines: none comes round again until many others have played.
import { describe, expect, it } from 'vitest';

import { ANNOUNCEMENTS } from '../../src/core/data';
import { pickFresh, setSeed } from '../../src/core/random';
import { announce } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { newGame } from '../../src/core/state/game';

/** How few other picks came between any pick and the last time it came up. */
function closestRepeat(picks: readonly unknown[]): number {
  let closest = Infinity;
  picks.forEach((p, i) => {
    const before = i > 0 ? picks.lastIndexOf(p, i - 1) : -1;
    if (before >= 0) closest = Math.min(closest, i - before - 1);
  });
  return closest;
}

describe('picking without repeating', () => {
  it('holds back the latest half of the list, so at least that many others come between repeats', () => {
    setSeed(3);
    const recent: number[] = [];
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const picks = Array.from({ length: 200 }, () => pickFresh(list, recent));
    expect(closestRepeat(picks)).toBeGreaterThanOrEqual(5);
    expect(new Set(picks).size).toBe(list.length);
  });

  it('still picks from a list too short to hold anything back', () => {
    expect(pickFresh(['only'], [])).toBe('only');
  });
});

describe('the announcer', () => {
  it('does not say the same filler line again until many others have been said', () => {
    setSeed(5);
    const ctx = createContext(newGame());
    ctx.s.open = true;
    const said: string[] = [];
    for (let i = 0; i < 120; i++) {
      announce(ctx, 100);
      for (const e of drainEvents(ctx)) if (e.type === 'announce') said.push(e.text);
    }
    expect(said.length).toBe(120);
    expect(said.every((t) => ANNOUNCEMENTS.includes(t))).toBe(true);
    expect(closestRepeat(said)).toBeGreaterThanOrEqual(Math.floor(ANNOUNCEMENTS.length / 2));
  });
});
