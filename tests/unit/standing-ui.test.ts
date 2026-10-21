// The words and figures the Standing tab and the staff inspector show for standing and the rival.
import { describe, expect, it } from 'vitest';

import { GRADES, RIVAL_NAME } from '../../src/core/data';
import { drawNote, gradeEffects, gradeProgress, offerWarning, rivalOpening } from '../../src/ui/lib/standing';

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
