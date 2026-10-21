// The machines' gags: every frame of every stage works out to numbers a model can be moved by, every part and emitter a
// gag moves is one its model has, and the fake failure is settled by who and where, never the game's dice.
import { beforeAll, describe, expect, it } from 'vitest';

import { ITEMS, type ItemType } from '../../src/core/data';
import { gagFrame, hiccupOf } from '../../src/render/gags/beats';
import { GAGS } from '../../src/render/gags/scripts';
import type { GagFrame, GagInput, GagStage } from '../../src/render/gags/types';
import { buildItem } from '../../src/render/models/items';
import { partsOf } from '../../src/render/models/parts';

/** Does nothing, for every call a canvas makes that a test has no use for. */
const nothing = () => undefined;
/** A 2D context that accepts every call and does nothing. */
const context = new Proxy(
  {},
  {
    /** Whatever is asked for is a method that does nothing. */
    get: () => nothing,
  },
);
/** A canvas that draws nothing. */
function canvas() {
  return {
    width: 0,
    height: 0,
    style: {},
    /** The one context it has. */
    getContext: () => context,
  };
}

// a few models paint onto canvases, which Node does not have: a canvas that draws nothing will do
beforeAll(() => {
  Object.assign(globalThis, { document: { createElement: canvas } });
});

const STAGES: readonly GagStage[] = ['idle', 'approach', 'running', 'outro'];
const MACHINES = Object.keys(GAGS) as ItemType[];

/** Every frame of a machine's gag worth looking at: each stage, through a session, worked or not, failing or not. */
function* frames(type: ItemType): Generator<[string, GagFrame]> {
  const script = GAGS[type];
  if (!script) return;
  // only a machine that can overload smokes, and only one that wears out breaks down
  const smokes = ITEMS[type].machine?.overload !== undefined;
  const breaks = ITEMS[type].wear !== undefined;
  for (const stage of STAGES)
    for (let k = 0; k <= 20; k++)
      for (const flags of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const input: GagInput = {
          stage,
          progress: k / 20,
          since: (k / 20) * script.outro,
          healed: (flags & 1) > 0,
          hiccup: (flags & 2) > 0,
          t: k * 0.37,
          smoking: smokes && (flags & 4) > 0,
          down: breaks && flags === 7,
        };
        yield [`${stage} ${k / 20} ${flags}`, gagFrame(script, input)];
      }
}

describe('the gags', () => {
  it('are given for every machine', () => {
    for (const t of Object.keys(ITEMS) as ItemType[]) if (ITEMS[t].machine) expect(GAGS[t], t).toBeDefined();
  });

  it('only ever move a part by a finite amount, and puff between none and full', () => {
    for (const type of MACHINES)
      for (const [at, f] of frames(type)) {
        for (const [name, move] of Object.entries(f.parts))
          for (const [k, v] of Object.entries(move))
            if (typeof v === 'number') expect(Number.isFinite(v), `${type} ${name}.${k} at ${at}`).toBe(true);
        for (const [k, v] of Object.entries(f.guest))
          if (typeof v === 'number') expect(Number.isFinite(v), `${type} guest.${k} at ${at}`).toBe(true);
        for (const [name, rate] of Object.entries(f.emit)) {
          expect(rate, `${type} ${name} at ${at}`).toBeGreaterThanOrEqual(0);
          expect(rate, `${type} ${name} at ${at}`).toBeLessThanOrEqual(1);
        }
      }
  });

  it('only move parts and emitters their machine’s model has', () => {
    for (const type of MACHINES) {
      const parts = partsOf(buildItem(type, {}));
      const rig = new Set(Object.keys(parts.rig ?? {}));
      const emitters = new Set(Object.keys(parts.emitters ?? {}));
      for (const [at, f] of frames(type)) {
        for (const name of Object.keys(f.parts)) expect(rig.has(name), `${type} part ${name} at ${at}`).toBe(true);
        for (const [name, rate] of Object.entries(f.emit))
          if (rate > 0) expect(emitters.has(name), `${type} emitter ${name} at ${at}`).toBe(true);
      }
    }
  });

  it('leave a guest where the game put them once the session is over', () => {
    for (const type of MACHINES) {
      const script = GAGS[type];
      if (!script) continue;
      const idle = script.frame({
        stage: 'idle',
        progress: 0,
        since: 0,
        healed: false,
        hiccup: false,
        t: 3,
        smoking: false,
        down: false,
      });
      expect(idle.guest, type).toEqual({});
    }
  });
});

describe('the fake failure', () => {
  it('is the same for the same machine and guest every time', () => {
    for (let i = 1; i < 50; i++) expect(hiccupOf(i, i * 7, 0.3)).toBe(hiccupOf(i, i * 7, 0.3));
  });

  it('plays about as often as its machine says, and never when it says never', () => {
    let played = 0;
    for (let item = 1; item <= 40; item++)
      for (let guest = 1; guest <= 100; guest++) if (hiccupOf(item, guest, 0.25)) played++;
    expect(played / 4000).toBeGreaterThan(0.2);
    expect(played / 4000).toBeLessThan(0.3);
    for (let guest = 1; guest <= 100; guest++) expect(hiccupOf(3, guest, 0)).toBe(false);
  });
});
