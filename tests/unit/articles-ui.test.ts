// "a" or "an" before a name the interface says, by how the name sounds.
import { describe, expect, it } from 'vitest';

import { MODALITIES } from '../../src/core/data';
import type { MachineDemand } from '../../src/core/sim/demand';
import type { Item } from '../../src/core/state/types';
import { deliveryNote } from '../../src/ui/lib/delivery';
import { machineNote } from '../../src/ui/lib/demand';
import { kitNote } from '../../src/ui/lib/mishaps';
import { staffingStatus } from '../../src/ui/lib/upgrades';

describe('"a" or "an" before a name in the interface', () => {
  it('says a station needs an Acupuncturist, not "a Acupuncturist"', () => {
    const table = { upgradePaid: false, claimedBy: 0, serving: 0 } as unknown as Item;
    expect(staffingStatus(table, undefined, 'Acupuncturist').text).toBe('Needs an Acupuncturist');
    expect(staffingStatus(table, undefined, 'Massage Therapist').text).toBe('Needs a Massage Therapist');
    // a station with no role to staff it runs itself
    expect(staffingStatus(table, undefined, undefined).text).toBe('Runs itself, with nobody to staff it');
  });

  it('says a treatment needs an item starting with a vowel in the room', () => {
    expect(kitNote('Oil Trolley', false, undefined).text).toBe('Needs an Oil Trolley in the room');
    expect(kitNote('Moxa Burner', false, undefined).text).toBe('Needs a Moxa Burner in the room');
  });

  it('says what equipment a treatment needs, with the right article', () => {
    expect(deliveryNote('no-equipment', MODALITIES.moxa, 'Ada Lovelace')).toBe('needs a Moxa Burner');
  });

  it('names who runs an acupuncture machine as "an Acupuncturist"', () => {
    const press = {
      machine: 'pin_press',
      fed: 1,
      room: { pull: 1 },
      training: 1,
      flavour: 1,
      line: { factor: 1 },
    } as unknown as MachineDemand;
    expect(machineNote(press, 4)).toContain('with an Acupuncturist of its own to run it');
  });
});
