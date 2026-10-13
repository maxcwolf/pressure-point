// People in general, guests and staff alike: finding them, creating them and where they come and go.

import { ENT_IN_Y, ENT_X, SIDEWALK_Y, W } from '../data';
import { pick, random } from '../random';
import type { Char, Guest, Look, Staff } from '../state/types';
import { System } from './system';

export class Chars extends System {
  /** The guest with this id, if there is one. */
  guest(id: number): Guest | undefined {
    return id ? this.s.guests.find((g) => g.id === id) : undefined;
  }

  /** The member of staff with this id, if there is one. */
  staff(id: number): Staff | undefined {
    return id ? this.s.staff.find((g) => g.id === id) : undefined;
  }

  /** The guest or member of staff with this id, if there is one. */
  char(id: number): Char | undefined {
    return this.guest(id) ?? this.staff(id);
  }

  /** What every person starts with, guest or staff, standing on the given tile. */
  create(name: string, look: Look, x: number, y: number) {
    return {
      id: this.s.nextId++,
      name,
      x: x + 0.5,
      y: y + 0.5,
      tx: x,
      ty: y,
      facing: 0,
      path: null,
      dest: null,
      pose: 'stand' as const,
      h: 0,
      busy: false,
      endPose: 'stand' as const,
      endH: 0,
      endFace: 0,
      look,
      bubble: '',
      bubbleT: 0,
      claimItem: 0,
      claimIdx: 0,
      timer: 0,
    };
  }

  /** Show a speech bubble over someone for a few seconds. */
  say(c: Char, icon: string, seconds = 2.2) {
    c.bubble = icon;
    c.bubbleT = seconds;
  }

  /** One end of the sidewalk, picked at random, where people arrive and leave. */
  streetTile(): [number, number] {
    return [random() < 0.5 ? 0 : W - 1, SIDEWALK_Y];
  }

  /** A tile just inside one of the entrances. */
  lobbyTile(): [number, number] {
    return [pick(ENT_X), ENT_IN_Y - 1];
  }
}
