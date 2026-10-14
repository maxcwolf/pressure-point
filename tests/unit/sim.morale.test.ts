// Low morale: the countdown to quitting, and the warnings on the way.
import { describe, expect, it } from 'vitest';

import { DAY_SECONDS, MISERABLE_MORALE, QUIT_AFTER, QUIT_WARNING } from '../../src/core/data';
import { aboutToQuit, daysUntilQuit } from '../../src/core/sim/staffing';
import type { Staff } from '../../src/core/state/types';
import { moraleLook, quitWarning } from '../../src/ui/lib/status';
import { openCenter, runUntil } from './helpers';

/** A member of staff with this morale, miserable for this many seconds. */
const unhappy = (morale: number, unhappyT: number) => ({ morale, unhappyT, state: 'atPost' }) as Staff;

describe('the countdown to quitting', () => {
  it('only runs for the miserable', () => {
    expect(daysUntilQuit(unhappy(60, 0))).toBeNull();
    expect(daysUntilQuit(unhappy(MISERABLE_MORALE, 30))).toBeNull();
    expect(daysUntilQuit({ ...unhappy(10, 30), state: 'leaving' })).toBeNull();
    expect(daysUntilQuit(unhappy(10, 30))).toBe((QUIT_AFTER - 30) / DAY_SECONDS);
  });

  it('raises the alarm in the last two days', () => {
    expect(aboutToQuit(unhappy(10, QUIT_AFTER - QUIT_WARNING - 1))).toBe(false);
    expect(aboutToQuit(unhappy(10, QUIT_AFTER - QUIT_WARNING))).toBe(true);
    expect(aboutToQuit(unhappy(40, QUIT_AFTER - 1))).toBe(false);
  });

  it('is described plainly, more urgently near the end', () => {
    expect(quitWarning(null)).toBe('');
    expect(quitWarning(6.2)).toBe('😠 Miserable: will quit in 7 days');
    expect(quitWarning(1.5)).toBe('⚠️ About to quit: 2 days left');
    expect(quitWarning(0.2)).toBe('⚠️ About to quit: 1 day left');
  });

  it('turns the morale bar red when it is low', () => {
    expect(moraleLook(80)).toBe('gold');
    expect(moraleLook(20)).toBe('bad');
  });
});

describe('a member of staff on their way out', () => {
  it('sounds the alarm once, has the advisor point at them, and quits if ignored', () => {
    const { sim, s, therapist } = openCenter(1);
    // badly paid and run ragged, so morale keeps falling
    therapist.salary = 100;
    therapist.morale = 5;
    therapist.unhappyT = QUIT_AFTER - QUIT_WARNING - 3;
    sim.drain();
    runUntil(sim, () => sim.aboutToQuit(therapist), 30);
    const alarms = sim.drain().filter((e) => e.type === 'toast' && e.text.includes('will quit within two days'));
    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toMatchObject({ kind: 'bad', about: { kind: 'staff', id: therapist.id } });
    expect(sim.adviceNote()).toMatchObject({
      text: expect.stringContaining(`${therapist.name} is about to quit`),
      about: { kind: 'staff', id: therapist.id },
    });
    runUntil(sim, () => therapist.state === 'leaving', 60);
    expect(s.staff.filter((x) => x.state !== 'leaving')).not.toContain(therapist);
  });

  it('stops counting down once given a raise', () => {
    const { sim, therapist } = openCenter(1);
    therapist.salary = 100;
    therapist.morale = 5;
    therapist.unhappyT = QUIT_AFTER - 5;
    expect(sim.aboutToQuit(therapist)).toBe(true);
    sim.giveRaise(therapist.id);
    expect(sim.daysUntilQuit(therapist)).toBeNull();
    expect(sim.adviceNote().text).not.toMatch(/about to quit/);
  });
});
