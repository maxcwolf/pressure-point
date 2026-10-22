// The words the pill for a guest on a really bad trip shows: who, how long until the door, and who to send.
import { describe, expect, it } from 'vitest';

import { DAY_SECONDS, RUNAWAY_SECONDS } from '../../src/core/data';
import type { Guest } from '../../src/core/state/types';
import { daysToDoor, doorShare, RUNNER_PILLS, runnerLine, runnersShown, sendLabel } from '../../src/ui/lib/calming';

describe('the time a runner has before the door', () => {
  it('is said in whole days, a part day counting as one, and less than a day at the end', () => {
    expect(daysToDoor(RUNAWAY_SECONDS)).toBe('10 days');
    expect(daysToDoor(6.5 * DAY_SECONDS)).toBe('7 days');
    expect(daysToDoor(DAY_SECONDS)).toBe('1 day');
    expect(daysToDoor(DAY_SECONDS * 0.4)).toBe('less than a day');
  });

  it('fills the bar by the share of the run left', () => {
    expect(doorShare(RUNAWAY_SECONDS)).toBe(1);
    expect(doorShare(RUNAWAY_SECONDS / 4)).toBe(0.25);
    expect(doorShare(-1)).toBe(0);
  });
});

describe("the runner's pill", () => {
  it('names them and the days to the door', () => {
    expect(runnerLine('Fern', 6.5 * DAY_SECONDS)).toBe('Fern is on a really bad trip: 7 days to the door');
    expect(runnerLine('Fern', 6.5 * DAY_SECONDS, 2)).toBe('Fern is on a really bad trip: 7 days to the door (+2 more)');
    expect(sendLabel('Priya')).toBe('Send Priya');
  });

  it('shows the newest three runners, and counts the rest', () => {
    const runners = [10, 50, 30, 60, 20].map((runaway, i) => ({ id: i, runaway }) as Guest);
    const { shown, more } = runnersShown(runners);
    expect(shown.map((g) => g.runaway)).toEqual([60, 50, 30]);
    expect(shown).toHaveLength(RUNNER_PILLS);
    expect(more).toBe(2);
    expect(runnersShown(runners.slice(0, 2)).more).toBe(0);
  });
});
