import { describe, expect, it } from 'vitest';

import type { Advice } from '../../src/core/sim/advisor';
import { AdviceHold, GONE_FOR, headline, HOLD_FOR, noteKey } from '../../src/ui/lib/advice-hold';

const SHOP: Advice = {
  text: 'Guests wait longest for the Shop Counter: 5 waiting for one Shop Counter. It has been busy 91% of the time.',
  about: { kind: 'item', id: 7 },
  level: 'tip',
};
const UNFED: Advice = { text: '1 staffed treatment station draws no guests.', level: 'tip' };
const QUIT: Advice = { text: 'Ines is about to quit!', about: { kind: 'staff', id: 3 }, level: 'alarm' };
/** Whatever a note is about is still there. */
const there = () => true;

describe('the advisor holds its note', () => {
  it('does not flip between two notes as the advisor does', () => {
    const hold = new AdviceHold();
    let changes = 0;
    let last = 0;
    // the advisor alternating every half second for a minute, as at the Orchard at speed 3
    for (let t = 0; t < 60; t += 0.5) {
      const shown = hold.show(Math.round(t * 2) % 2 ? UNFED : SHOP, t, there);
      if (shown.id !== last) changes++;
      last = shown.id;
    }
    expect(changes).toBeLessThanOrEqual(60 / HOLD_FOR + 1);
  });

  it('holds the figures of the note while it shows', () => {
    const hold = new AdviceHold();
    hold.show(SHOP, 0, there);
    const busier = { ...SHOP, text: SHOP.text.replace('5 waiting', '6 waiting') };
    expect(hold.show(busier, 1, there).text).toBe(SHOP.text);
    expect(hold.show(busier, HOLD_FOR, there).text).toBe(busier.text);
  });

  it('gives way at once to a more pressing note', () => {
    const hold = new AdviceHold();
    hold.show(SHOP, 0, there);
    expect(hold.show(QUIT, 0.2, there).text).toBe(QUIT.text);
    // and an alarm holds against tips
    expect(hold.show(SHOP, 0.4, there).text).toBe(QUIT.text);
  });

  it('moves on once the note is dealt with', () => {
    const hold = new AdviceHold();
    hold.show(QUIT, 0, there);
    expect(hold.show(SHOP, 1, there).text).toBe(QUIT.text);
    expect(hold.show(SHOP, 1 + GONE_FOR, there).text).toBe(SHOP.text);
    // someone who has left is dealt with at once
    hold.show(QUIT, 20, there);
    expect(hold.show(UNFED, 20.1, () => false).text).toBe(UNFED.text);
  });

  it('moves straight on from a step in setting up', () => {
    const hold = new AdviceHold();
    hold.show({ text: 'Place a Reception Desk.', level: 'step' }, 0, there);
    expect(hold.show({ text: 'Hire a Receptionist.', level: 'step' }, 0.2, there).text).toBe('Hire a Receptionist.');
  });
});

describe('the note in parts', () => {
  it('knows a note by its words, not its figures', () => {
    expect(noteKey(SHOP)).toBe(noteKey({ ...SHOP, text: SHOP.text.replace('91%', '88%') }));
    expect(noteKey(SHOP)).not.toBe(noteKey(UNFED));
  });

  it('splits off the first sentence as a headline', () => {
    expect(headline('Ines is about to quit! Select them and give them a raise.')).toEqual({
      head: 'Ines is about to quit!',
      rest: 'Select them and give them a raise.',
    });
    expect(headline('You are $1,080 in the red. A loan is cheaper.').head).toBe('You are $1,080 in the red.');
    expect(headline('Looking good.')).toEqual({ head: 'Looking good.', rest: '' });
  });
});
