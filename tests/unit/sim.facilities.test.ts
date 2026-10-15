import { describe, expect, it } from 'vitest';

import { openCenter, runUntil } from './helpers';

describe('facilities guests use', () => {
  // Tea stations and snack machines had a wear rate in their data, but wear was only ever added to
  // the stations staff work at, so they never wore out.
  it('wear out with use, as their wear rate says', () => {
    const { sim, s, consultant } = openCenter(5);
    const tea = sim.placeItem('tea_station', 18, 13, 0);
    if (!tea) throw new Error('could not place the tea station');
    // with nobody to see them, guests wait in line, which is when they look for a drink
    sim.fire(consultant.id);
    runUntil(sim, () => s.guests.some((g) => g.state === 'waiting'), 300);
    for (const g of s.guests) g.thirst = 100;
    runUntil(sim, () => s.ledger.vending > 0, 120);
    expect(s.ledger.vending).toBeGreaterThan(0);
    expect(tea.wear).toBeGreaterThan(0);
  });
});
