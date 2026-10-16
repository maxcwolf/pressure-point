// Rug patterns: picked before a rug is put down, kept by copies and templates, and changed from its inspector.
import { describe, expect, it } from 'vitest';

import { Tools } from '../../src/app/tools/tools';
import { RUG_ORDER, RUG_PATTERNS, rugPattern } from '../../src/core/data';
import { layoutOf, placeLayout, turnLayout } from '../../src/core/room-layout';
import { itemsInRoom } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import { readLayout } from '../../src/core/templates';
import type { GhostSpec } from '../../src/render/overlays';
import type { View } from '../../src/render/view';
import { openCenter } from './helpers';

/** A Tools whose view draws nothing, with the cursor on the ground wherever the pointer says. */
function toolsFor(sim: ReturnType<typeof openCenter>['sim'], ghosts: (GhostSpec | null)[] = []) {
  /** Draw nothing. */
  const nothing = () => undefined;
  const view = {
    selected: null,
    setOverlay: nothing,
    setMarkers: nothing,
    /** Keep each ghost shown, to look at after. */
    setGhost(g: GhostSpec | null) {
      ghosts.push(g);
    },
    setDoor: nothing,
    /** The ground is wherever the pointer says. */
    groundAt(x: number, y: number) {
      return { x, y };
    },
  };
  return new Tools(sim, view as unknown as View, nothing, nothing);
}

describe('rug patterns', () => {
  it('each have a name and a swatch, and an unknown one is the original', () => {
    expect(RUG_ORDER.length).toBeGreaterThanOrEqual(5);
    for (const id of RUG_ORDER) expect(RUG_PATTERNS[id]).toMatchObject({ id, name: expect.any(String) });
    expect(new Set(RUG_ORDER.map((id) => RUG_PATTERNS[id].swatch)).size).toBe(RUG_ORDER.length);
    expect(rugPattern(undefined)).toBe('kilim');
    expect(rugPattern('plaid')).toBe('kilim');
    expect(rugPattern('ocean')).toBe('ocean');
  });

  it('are kept on a rug put down with one, and only on a rug', () => {
    const { sim } = openCenter(1);
    expect(sim.placeItem('rug', 16, 10, 0, { pattern: 'sunset' })).toMatchObject({ pattern: 'sunset' });
    expect(sim.placeItem('rug', 20, 10, 0, { pattern: 'kilim' })).not.toHaveProperty('pattern');
    expect(sim.placeItem('bench', 24, 10, 0, { pattern: 'ocean' })).not.toHaveProperty('pattern');
  });

  it('can be changed on a rug already down, and not on anything else', () => {
    const { sim } = openCenter(1);
    const rug = sim.placeItem('rug', 16, 10, 0)!;
    const version = sim.world.version;
    sim.setRugPattern(rug.id, 'lotus');
    expect(rug.pattern).toBe('lotus');
    expect(sim.world.version, 'so the view draws it afresh').toBeGreaterThan(version);
    sim.setRugPattern(rug.id, 'kilim');
    expect(rug).not.toHaveProperty('pattern');
    const bench = sim.placeItem('bench', 20, 10, 0)!;
    sim.setRugPattern(bench.id, 'lotus');
    expect(bench).not.toHaveProperty('pattern');
  });

  it('go with a rug into a layout, turned, put down and read back from a file', () => {
    const { s, massage } = openCenter(1);
    s.items.push({
      ...s.items.find((i) => i.type === 'oil_trolley')!,
      id: 999,
      type: 'rug',
      x: 11,
      y: 7,
      pattern: 'forest',
    });
    const layout = layoutOf(massage, itemsInRoom(createContext(s), massage));
    const rug = layout.items.find((i) => i.type === 'rug');
    expect(rug).toMatchObject({ pattern: 'forest' });
    expect(turnLayout(layout).items.find((i) => i.type === 'rug')).toMatchObject({ pattern: 'forest' });
    expect(placeLayout(layout, 3, 3).items.find((i) => i.type === 'rug')).toMatchObject({ pattern: 'forest' });
    const read = readLayout(JSON.parse(JSON.stringify(layout)) as unknown)!;
    expect(read.items.find((i) => i.type === 'rug')).toMatchObject({ pattern: 'forest' });
    const odd = readLayout({ ...layout, items: [{ ...rug, pattern: 'plaid' }] })!;
    expect(odd.items[0]).not.toHaveProperty('pattern');
  });

  it('are picked while a rug is in hand, shown on its ghost, and given to the rugs put down', () => {
    const { sim, s } = openCenter(1);
    const ghosts: (GhostSpec | null)[] = [];
    const tools = toolsFor(sim, ghosts);
    expect(tools.holdingRug).toBe(false);
    tools.startItem('bench');
    expect(tools.holdingRug).toBe(false);
    tools.startItem('rug');
    expect(tools.holdingRug).toBe(true);
    tools.pickRugPattern('stripes');
    tools.pointerMove(17, 11);
    expect(ghosts.at(-1)).toMatchObject({ type: 'rug', pattern: 'stripes' });
    tools.pointerUp(17, 11);
    expect(s.items.filter((i) => i.type === 'rug')).toEqual([expect.objectContaining({ pattern: 'stripes' })]);
    // the next rug starts with the same pattern
    tools.back();
    tools.startItem('rug');
    expect(tools.rugPattern).toBe('stripes');
  });
});
