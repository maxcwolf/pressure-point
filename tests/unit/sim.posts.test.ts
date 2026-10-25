// Staff at a quiet station going to another of theirs where guests are waiting, without going back and forth.
import { describe, expect, it } from 'vitest';

import { inconsistencies, openCenter, run, runUntil } from './helpers';

/** The center with a Shop Counter for its one receptionist to work besides the Reception Desk. */
function withShop() {
  const c = openCenter(1);
  c.s.stars = 1;
  const shop = c.sim.placeItem('shop_counter', 18, 13, 0);
  const desk = c.s.items.find((it) => it.type === 'reception_desk');
  if (!shop || !desk) throw new Error('no shop counter or reception desk');
  return { ...c, shop, desk };
}

describe('staff moving between stations', () => {
  it('sends a lone receptionist from an empty Shop Counter back to a Reception Desk with a line', () => {
    const { sim, s, receptionist, shop, desk } = withShop();
    // kept from reception, they take up the shop, and a line builds at the desk with nobody at it
    sim.setDuty(receptionist.id, 'reception', false);
    runUntil(sim, () => receptionist.post === shop.id && receptionist.state === 'atPost');
    runUntil(sim, () => desk.queue.length >= 2 && !shop.serving && !shop.queue.length);
    sim.setDuty(receptionist.id, 'reception', true);
    // back on reception, and nobody at the shop: off to the desk, rather than stand at the counter for good
    runUntil(sim, () => receptionist.post === desk.id && receptionist.state === 'atPost', 30);
    expect(inconsistencies(sim)).toEqual([]);
    expect(s.guests.length).toBeGreaterThan(0);
  });

  it('leaves a lone receptionist where they are while neither station has anyone waiting', () => {
    const { sim, s, receptionist } = withShop();
    // open already, so no guest is ever on their way
    s.open = true;
    s.spawnT = 1e9;
    runUntil(sim, () => receptionist.state === 'atPost');
    const post = receptionist.post;
    let moves = 0;
    for (let i = 0; i < 1200; i++) {
      run(sim, 0.1);
      if (receptionist.post !== post || receptionist.state !== 'atPost') moves++;
    }
    expect(s.guests).toEqual([]);
    expect(moves).toBe(0);
  });
});
