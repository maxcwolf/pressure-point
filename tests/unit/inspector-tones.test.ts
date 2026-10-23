// The inspector's tones: how a status line and a bar say whether all is well, worth a look, or trouble.
import { describe, expect, it } from 'vitest';

import { POOR_CONDITION, WEAR_REPAIR } from '../../src/core/data';
import type { Item, Staff } from '../../src/core/state/types';
import { meterPercent, meterTone, meterValue } from '../../src/ui/lib/meters';
import { staffingKind, statusClass, type StatusKind, statusTone } from '../../src/ui/lib/status';
import { staffingStatus } from '../../src/ui/lib/upgrades';

describe('status lines', () => {
  it('put trouble in red, what wants seeing to in amber and plain news on navy', () => {
    /** The tones of several kinds of line. */
    const tones = (kinds: StatusKind[]) => kinds.map(statusTone);
    expect(tones(['broken', 'stopped', 'flooded', 'quitting'])).toEqual(['bad', 'bad', 'bad', 'bad']);
    expect(tones(['unstaffed', 'smoking', 'filthy', 'stale', 'rattled', 'promotion', 'offer', 'miserable'])).toEqual(
      Array(8).fill('warn'),
    );
    expect(tones(['doing', 'staffed', 'installing', 'rattling'])).toEqual(Array(4).fill('neutral'));
    expect(statusTone('award')).toBe('good');
  });

  it('give a line its classes, keeping any of its own', () => {
    expect(statusClass('flooded', 'flooded')).toBe('status bad flooded');
    expect(statusClass('doing')).toBe('status neutral');
    expect(statusClass('miserable', 'quitting', false)).toBe('status warn quitting');
  });

  it('read a station’s staffing line', () => {
    const table = { upgradePaid: false, claimedBy: 0, serving: 0 } as unknown as Item;
    const staff = { name: 'Ada' } as Staff;
    expect(staffingKind(true, staffingStatus(table, staff, 'Massage Therapist'))).toBe('staffed');
    expect(staffingKind(false, staffingStatus(table, undefined, 'Massage Therapist'))).toBe('unstaffed');
    const installing = { upgradePaid: true, claimedBy: 3, serving: 0 } as unknown as Item;
    expect(staffingKind(false, staffingStatus(installing, undefined, 'Massage Therapist'))).toBe('installing');
  });
});

describe('bars', () => {
  it('turn amber before red for a level that empties', () => {
    expect(meterTone('patience', 80)).toBe('good');
    expect(meterTone('patience', 40)).toBe('warn');
    expect(meterTone('patience', 24)).toBe('bad');
    expect(meterTone('condition', POOR_CONDITION)).toBe('warn');
    expect(meterTone('condition', POOR_CONDITION - 1)).toBe('bad');
    expect(meterTone('morale', 29)).toBe('bad');
    expect(meterTone('energy', 30)).toBe('warn');
  });

  it('turn red near full for a need that fills', () => {
    expect(meterTone('need', 20)).toBe('good');
    expect(meterTone('need', 70)).toBe('warn');
    expect(meterTone('need', 90)).toBe('bad');
    expect(meterTone('need', 100)).toBe('bad');
  });

  it('turn an item red once it wants a repair', () => {
    expect(meterTone('wear', 0)).toBe('good');
    expect(meterTone('wear', WEAR_REPAIR - 1)).toBe('warn');
    expect(meterTone('wear', WEAR_REPAIR)).toBe('bad');
  });

  it('show their value rounded, and progress as a percentage', () => {
    expect(meterValue(61.6)).toBe('62');
    expect(meterValue(-3)).toBe('0');
    expect(meterValue(140)).toBe('100');
    expect(meterPercent(33.3)).toBe('33%');
  });
});
