// Wear and tear: equipment wearing out, plants drying and warm stones cooling.

import { ITEMS } from '../data';
import { type Item } from '../state/types';
import { itemCenter } from '../world';
import { System } from './system';

export class Upkeep extends System {
  /** Plants dry out and warm stones cool as time passes. */
  decay(dt: number) {
    for (const it of this.s.items) {
      if (it.type === 'plant') it.water = Math.max(0, it.water - dt * 0.3);
      else if (it.type === 'stone_warmer') it.water = Math.max(0, it.water - dt * 0.08);
    }
  }

  wear(it: Item) {
    const add = ITEMS[it.type].wear ?? 0;
    if (!add || it.wear >= 100) return;
    it.wear = Math.min(100, it.wear + add);
    if (it.wear < 100) return;
    // broken: nobody can use it until a Janitor has been
    this.world.version++;
    const [cx, cy] = itemCenter(it);
    this.sim.events.emit({ type: 'float', text: 'Broken!', x: cx, y: cy, kind: 'bad' });
    this.sim.events.emit({ type: 'sfx', name: 'fail' });
    this.sim.events.toast(
      `A ${ITEMS[it.type].name} has broken down. It is out of action until a Janitor repairs it.`,
      'bad',
    );
  }
}
