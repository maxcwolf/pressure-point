// The words and figures the Standing tab and the staff inspector show for standing and the rival.
import { describe, expect, it } from 'vitest';

import { GRADES, RIVAL_NAME } from '../../src/core/data';
import {
  counterplayLine,
  drawNote,
  gradeEffects,
  gradeProgress,
  offerWarning,
  rivalCourseLine,
  rivalOpening,
  standingLine,
} from '../../src/ui/lib/standing';

describe('the climb to the next grade', () => {
  it('is measured from the grade reached to the next', () => {
    expect(gradeProgress(0, 0)).toEqual({ next: GRADES[1], needed: 80, share: 0 });
    expect(gradeProgress(40, 0)).toMatchObject({ needed: 40, share: 0.5 });
    expect(gradeProgress(250, 2)).toMatchObject({ next: GRADES[3], needed: 70, share: 0.5 });
  });

  it('is full for a grade kept with fewer points than it took, and done at the top', () => {
    expect(gradeProgress(50, 2)).toMatchObject({ needed: 270, share: 0 });
    expect(gradeProgress(900, 4)).toEqual({ next: undefined, needed: 0, share: 1 });
  });
});

describe('what a grade brings', () => {
  it('says how many more guests come, how applicants change, and what guests expect', () => {
    expect(gradeEffects(0)).toEqual([
      'Guests come as reputation brings them',
      'Applicants come as they do anywhere',
      'Guests expect nothing special of the rooms yet',
    ]);
    expect(gradeEffects(1)[0]).toBe('8% more guests than a Back-Room Practice');
    expect(gradeEffects(1)[1]).toBe('Better applicants for each job');
    expect(gradeEffects(4)).toEqual([
      '32% more guests than a Back-Room Practice',
      'More applicants for each job, and better ones',
      'Guests expect treatment rooms of ★★★ prestige or more, and are let down by plainer ones',
    ]);
  });
});

describe('the rival, in words', () => {
  it('says when it opens, or opened, or that there is none', () => {
    expect(rivalOpening(null, false)).toBe('There is no rival in this game.');
    expect(rivalOpening(null, true)).toBe(`A ${RIVAL_NAME} is due to open across the street around day 16 of month 2.`);
    expect(rivalOpening(31, true)).toBe('Open across the street since day 2 of month 2.');
  });

  it('says how many guests it is drawing away', () => {
    expect(drawNote(0)).toBe('Not drawing your guests away at the moment.');
    expect(drawNote(0.35)).toBe('Drawing away about 35% of the guests who would come to you.');
  });

  it('warns how long someone has to be cheered up before taking its offer', () => {
    expect(offerWarning(5)).toBe(
      `${RIVAL_NAME} has offered them a job. Lift their morale above 35 within 5 days, or they will take it.`,
    );
    expect(offerWarning(1)).toContain('above 35 within 1 day,');
    expect(offerWarning(1.4)).toContain('above 35 within 2 days,');
    expect(offerWarning(0.6)).toContain('above 35 today,');
  });
});

describe('where standing comes from, in words', () => {
  it('names each source, and the rooms not in use when there are any', () => {
    const p = { rooms: 28, prestige: 12, staff: 21, heals: 7, total: 68, inUse: 2, idle: 0, unstaffed: 0 };
    expect(standingLine(p)).toBe('Rooms 28 · Prestige 12 · Staff 21 · Guests healed 7');
    expect(standingLine({ ...p, idle: 1, inUse: 1 })).toBe(
      'Rooms 28 (1 in use, 1 not) · Prestige 12 · Staff 21 · Guests healed 7',
    );
  });
});

describe('the rival against its ceiling, and what to do about it', () => {
  it('says which way it is going and how far it can grow', () => {
    expect(rivalCourseLine('growing', 410)).toBe(
      'Growing about 14 points a month, up to 25% more than your own standing: 410 points now.',
    );
    expect(rivalCourseLine('ceiling', 410)).toBe(
      'As big as it gets for now, at 25% more than your own standing: 410 points. It grows again as you do.',
    );
    expect(rivalCourseLine('losing', 410)).toBe('Losing about 15 points a month while your word of mouth runs.');
  });

  it('names the counterplay, and what it has done so far', () => {
    const line =
      'Each VIP you delight takes 8% off it, word of mouth takes about 15 points a month off it while it runs, and winning Center of the Year takes 25% off.';
    expect(counterplayLine(0)).toBe(line);
    expect(counterplayLine(42.4)).toBe(`${line} You have knocked 42 points off it so far.`);
  });
});
