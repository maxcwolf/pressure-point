// The save version goes up whenever a save could hold something an older version of the game has never heard of.
// Older versions refuse a save with a higher version number; one with the same number but unknown rooms, items or
// people in it would crash them instead.
import { describe, expect, it } from 'vitest';

import { CENTERS, CONDITIONS, ITEMS, MODALITIES, ROLES, ROOMS, TRAITS } from '../../src/core/data';
import { SAVE_VERSION } from '../../src/core/state/game';

/** Every id a save can hold, by kind, sorted. */
function contentIds(): string {
  const kinds: Record<string, string[]> = {
    centers: Object.keys(CENTERS),
    conditions: CONDITIONS.map((c) => c.id),
    items: Object.keys(ITEMS),
    modalities: Object.keys(MODALITIES),
    roles: Object.keys(ROLES),
    rooms: Object.keys(ROOMS),
    traits: TRAITS.map((t) => t.id),
  };
  return Object.entries(kinds)
    .map(([kind, ids]) => `${kind}:${[...ids].sort().join(',')}`)
    .join('|');
}

/** A short, stable fingerprint of some text (FNV-1a). */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

describe('the save version', () => {
  it('goes up with the content a save can hold', () => {
    // When this fails because content was added: raise SAVE_VERSION in src/core/state/game.ts, then put the new
    // version and the fingerprint this test reports here.
    expect({ version: SAVE_VERSION, content: fingerprint(contentIds()) }).toEqual({ version: 44, content: 'e14d3fd4' });
  });
});
