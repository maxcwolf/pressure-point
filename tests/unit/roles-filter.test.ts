// The Staff menu's job filter: each role someone holds, with its headcount, and what the list falls back to.
import { describe, expect, it } from 'vitest';

import { headcounts, jobChoices, shownRole } from '../../src/ui/lib/roles';
import { hire, openCenter } from './helpers';

describe('the job filter in the Staff menu', () => {
  it('offers everyone, then each role someone holds, in the usual order, with its headcount', () => {
    const { sim, s } = openCenter();
    hire(sim, 'caretaker');
    hire(sim, 'therapist');
    expect(headcounts(s.staff)).toEqual([
      { role: 'receptionist', count: 1 },
      { role: 'consultant', count: 1 },
      { role: 'therapist', count: 2 },
      { role: 'caretaker', count: 1 },
    ]);
    expect(jobChoices(s.staff)).toEqual([
      { id: 'all', name: 'All (5)' },
      { id: 'receptionist', name: 'Receptionist (1)' },
      { id: 'consultant', name: 'Wellness Consultant (1)' },
      { id: 'therapist', name: 'Massage Therapist (2)' },
      { id: 'caretaker', name: 'Caretaker (1)' },
    ]);
  });

  it('keeps the job picked while someone holds it, and shows everyone once nobody does', () => {
    const { s } = openCenter();
    expect(shownRole(s.staff, 'therapist')).toBe('therapist');
    expect(shownRole(s.staff, null)).toBeNull();
    expect(shownRole(s.staff, 'caretaker')).toBeNull();
  });
});
