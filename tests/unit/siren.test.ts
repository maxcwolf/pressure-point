// The fire truck's siren: heard in the last seconds before the truck turns into the street and louder as it comes,
// the nearer the camera looks to it, and silent once it has parked and as it leaves.
import { describe, expect, it } from 'vitest';

import { SIREN_AHEAD, SIREN_REACH, sirenLevel } from '../../src/app/siren';
import { BRIGADE_CALL_SECONDS, DAY_SECONDS, ROAD_Y } from '../../src/core/data';
import { freshSim } from './helpers';

/** Where on the road the truck drives, across it. */
const LANE = ROAD_Y[0] + 0.5;

describe('the siren', () => {
  it('is silent with no fire brigade out', () => {
    expect(sirenLevel(freshSim().s, 5, LANE)).toBe(0);
  });

  it('comes up as the truck nears the street, loudest with the camera on it, and falls away with distance', () => {
    const { s } = freshSim();
    const called = s.day;
    s.brigade = { x: 5, state: 'coming', called, crew: [], charged: false, room: 0 };
    /** The siren heard this many seconds after the call, from a spot along the road. */
    const heard = (seconds: number, x = 5) => {
      s.day = called + seconds / DAY_SECONDS;
      return sirenLevel(s, x, LANE);
    };
    expect(heard(0)).toBe(0);
    expect(heard(BRIGADE_CALL_SECONDS - SIREN_AHEAD)).toBe(0);
    expect(heard(BRIGADE_CALL_SECONDS - SIREN_AHEAD / 2)).toBeCloseTo(0.5);
    expect(heard(BRIGADE_CALL_SECONDS)).toBeCloseTo(1);
    expect(heard(BRIGADE_CALL_SECONDS, 5 + SIREN_REACH / 2)).toBeCloseTo(0.5);
    expect(heard(BRIGADE_CALL_SECONDS, 5 + SIREN_REACH)).toBe(0);
  });

  it('stops once the truck has parked, and stays off as it leaves', () => {
    const { s } = freshSim();
    s.brigade = { x: 5, state: 'parked', called: s.day - 1, crew: [], charged: false, room: 0 };
    expect(sirenLevel(s, 5, LANE)).toBe(0);
    s.brigade.state = 'leaving';
    expect(sirenLevel(s, 5, LANE)).toBe(0);
  });
});
