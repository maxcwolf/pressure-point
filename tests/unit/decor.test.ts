// Decorating rooms: floors and walls chosen per room or for every room of a kind, carried along by copies, moves and
// templates, and the patterns karma unlocks.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CampaignProgress,
  cannotBuyDecor,
  decorOpen,
  freshCampaign,
  karmaLeft,
  withDecorUnlock,
} from '../../src/core/campaign';
import {
  decorDef,
  type DecorKey,
  decorLabel,
  FLOOR_ORDER,
  FLOORS,
  KARMA_DECOR,
  WALL_ORDER,
  WALLS,
} from '../../src/core/data';
import { layoutOf, placeLayout, turnLayout } from '../../src/core/room-layout';
import { itemsInRoom } from '../../src/core/sim/building';
import { createContext } from '../../src/core/sim/context';
import { decorChange, decorFor, withDecor } from '../../src/core/sim/decor';
import { openDecor, readLayout } from '../../src/core/templates';
import { buyDecorWithKarma, loadCampaign } from '../../src/storage/campaign';
import { decorCards } from '../../src/ui/lib/karma';
import { LAYOUT, openCenter } from './helpers';

/** Floor in the standard test center that nothing is built on: where the Staff Room and Restroom would go. */
const FREE = { x: 17, y: 5 };

describe('the floors and walls', () => {
  it('offers three of each free, standard first, and the rest for 13 karma in all', () => {
    expect(FLOOR_ORDER[0]).toBe('standard');
    expect(WALL_ORDER[0]).toBe('standard');
    expect(FLOOR_ORDER.filter((id) => FLOORS[id].karma === undefined)).toEqual(['standard', 'oak', 'slate']);
    expect(WALL_ORDER.filter((id) => WALLS[id].karma === undefined)).toEqual(['standard', 'sage', 'sky']);
    expect(KARMA_DECOR).toHaveLength(9);
    expect(KARMA_DECOR.reduce((sum, key) => sum + (decorDef(key).karma ?? 0), 0)).toBe(13);
  });

  it('names each one in a sentence', () => {
    expect(decorLabel('floor:starry')).toBe('the Starry night floor');
    expect(decorLabel('wall:paneling')).toBe('the Wood paneling walls');
  });
});

describe("a room's look", () => {
  it('changes one part at a time, and leaves a part chosen as standard unset', () => {
    expect(withDecor({}, { floor: 'oak' })).toEqual({ floor: 'oak' });
    expect(withDecor({ floor: 'oak', wall: 'sage' }, { wall: 'sky' })).toEqual({ floor: 'oak', wall: 'sky' });
    expect(withDecor({ floor: 'oak', wall: 'sage' }, { floor: 'standard' })).toEqual({ wall: 'sage' });
    expect(decorChange('floor:bamboo')).toEqual({ floor: 'bamboo' });
    expect(decorChange('wall:tiedye')).toEqual({ wall: 'tiedye' });
  });

  it('starts new rooms of a kind as every room like them was last decorated, or standard', () => {
    expect(decorFor(undefined, 'massage')).toEqual({});
    expect(decorFor({ massage: { floor: 'oak' } }, 'massage')).toEqual({ floor: 'oak' });
    expect(decorFor({ massage: { floor: 'oak' } }, 'consult')).toEqual({});
  });
});

describe('decorating', () => {
  it('changes one room, and draws the floor and walls again', () => {
    const { sim, massage, consult } = openCenter(1);
    const version = sim.world.version;
    expect(sim.decorateRoom(massage.id, { floor: 'oak' })).toBe(true);
    expect(sim.decorateRoom(massage.id, { wall: 'sage' })).toBe(true);
    expect(massage).toMatchObject({ floor: 'oak', wall: 'sage' });
    expect(consult.floor).toBeUndefined();
    expect(sim.world.version).toBeGreaterThan(version);
    sim.decorateRoom(massage.id, { floor: 'standard' });
    expect('floor' in massage).toBe(false);
    expect(sim.decorateRoom(9999, { floor: 'oak' })).toBe(false);
  });

  it('can give every room of a kind the same look, and new ones too, leaving other kinds alone', () => {
    const { sim, s, massage, consult } = openCenter(2);
    const copy = sim.copyRoom(massage.id, placeLayout(sim.roomLayout(massage), FREE.x, FREE.y))!;
    sim.decorateRoom(massage.id, { floor: 'slate', wall: 'sky' }, true);
    expect(copy).toMatchObject({ floor: 'slate', wall: 'sky' });
    expect(consult.floor).toBeUndefined();
    expect(s.roomDecor).toEqual({ massage: { floor: 'slate', wall: 'sky' } });
    const later = sim.createRoom('massage', { x: 21, y: 5, w: 3, h: 3 }, { x: 22, y: 7, dx: 0, dy: 1 });
    expect(later).toMatchObject({ floor: 'slate', wall: 'sky' });
    const restroom = sim.createRoom('restroom', LAYOUT.restroom.rect, LAYOUT.restroom.door);
    expect(restroom.floor).toBeUndefined();
  });
});

describe('copies, moves and templates', () => {
  it('copy a room with its look, and a move keeps it', () => {
    const { sim, s, massage } = openCenter(3);
    sim.decorateRoom(massage.id, { floor: 'terrazzo', wall: 'botanical' });
    const layout = sim.roomLayout(massage);
    expect(layout).toMatchObject({ floor: 'terrazzo', wall: 'botanical' });
    expect(turnLayout(layout)).toMatchObject({ floor: 'terrazzo', wall: 'botanical' });
    const copy = sim.copyRoom(massage.id, placeLayout(layout, FREE.x, FREE.y))!;
    expect(copy).toMatchObject({ floor: 'terrazzo', wall: 'botanical' });
    const items = itemsInRoom(createContext(s), copy);
    expect(sim.moveRoom(copy.id, placeLayout(layoutOf(copy, items), 21, 9))).toBe(true);
    expect(copy).toMatchObject({ floor: 'terrazzo', wall: 'botanical' });
  });

  it('keep a template’s look, and leave a floor or walls this version does not know standard', () => {
    const { sim, massage } = openCenter(4);
    sim.decorateRoom(massage.id, { floor: 'starry', wall: 'tiedye' });
    const layout = sim.roomLayout(massage);
    expect(readLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout);
    const unknown = readLayout({ ...layout, floor: 'lava', wall: 42 });
    expect(unknown).not.toBeNull();
    expect(unknown).not.toHaveProperty('floor');
    expect(unknown).not.toHaveProperty('wall');
  });

  it('build a template plainer where its floor or walls are not unlocked in this game', () => {
    const { sim, massage } = openCenter(5);
    sim.decorateRoom(massage.id, { floor: 'starry', wall: 'sage' });
    const layout = sim.roomLayout(massage);
    expect(openDecor(layout, () => true)).toMatchObject({ floor: 'starry', wall: 'sage' });
    /** Only the free floors and walls are open. */
    const free = (key: DecorKey) => decorDef(key).karma === undefined;
    const plain = openDecor(layout, free);
    expect(plain).not.toHaveProperty('floor');
    expect(plain).toMatchObject({ wall: 'sage' });
    const room = sim.buildTemplate('Suite', plain, placeLayout(plain, FREE.x, FREE.y))!;
    expect(room.floor).toBeUndefined();
    expect(room.wall).toBe('sage');
  });
});

describe('unlocking floors and walls with karma', () => {
  /** A campaign with some stars and nothing spent. */
  const rich = (): CampaignProgress => ({ ...freshCampaign(), stars: { willow: 3 } });

  it('spends karma on them as on items, once each, and never on the free ones', () => {
    const p = rich();
    expect(karmaLeft(p)).toBe(6);
    expect(cannotBuyDecor(p, 'floor:starry')).toBe('');
    expect(cannotBuyDecor(p, 'floor:oak')).toBe('not-for-karma');
    const after = withDecorUnlock(p, 'floor:starry');
    expect(after.decor).toEqual(['floor:starry']);
    expect(karmaLeft(after)).toBe(4);
    expect(cannotBuyDecor(after, 'floor:starry')).toBe('owned');
    expect(withDecorUnlock(after, 'floor:starry')).toBe(after);
    expect(cannotBuyDecor(freshCampaign(), 'wall:tiedye')).toBe('short');
  });

  it('lets a game use the free ones, the unlocked ones, and every one when everything is unlocked', () => {
    expect(decorOpen('floor:oak', 0, [])).toBe(true);
    expect(decorOpen('floor:starry', 3, [])).toBe(false);
    expect(decorOpen('floor:starry', 3, ['floor:starry'])).toBe(true);
    expect(decorOpen('wall:tiedye', Infinity, [])).toBe(true);
  });

  it('lists them in the karma shop, floors first, as owned, for sale, or out of reach', () => {
    const cards = decorCards(withDecorUnlock(rich(), 'floor:terrazzo'));
    expect(cards.map((c) => c.key)).toEqual(KARMA_DECOR);
    expect(cards[0]).toMatchObject({ key: 'floor:terrazzo', name: 'Terrazzo', part: 'Floor', state: 'owned' });
    expect(cards.find((c) => c.key === 'wall:tiedye')).toMatchObject({ part: 'Walls', karma: 2, state: 'buy' });
    expect(decorCards(freshCampaign()).every((c) => c.state === 'short')).toBe(true);
  });

  describe('kept between games', () => {
    const store = new Map<string, string>();
    beforeEach(() => {
      store.clear();
      globalThis.localStorage = {
        /** Read a stored value, or null if there is none. */
        getItem: (k: string) => store.get(k) ?? null,
        /** Store a value. */
        setItem: (k: string, v: string) => void store.set(k, v),
        /** Forget a stored value. */
        removeItem: (k: string) => void store.delete(k),
      } as Storage;
    });

    it('stores what is unlocked, and drops anything this version does not know or gives away', () => {
      store.set('pressure-point-campaign', JSON.stringify({ stars: { willow: 3 }, decor: ['floor:oak', 'wall:lava'] }));
      expect(loadCampaign().decor).toEqual([]);
      expect(buyDecorWithKarma('wall:paneling')).toBe(true);
      expect(buyDecorWithKarma('wall:paneling')).toBe(false);
      expect(buyDecorWithKarma('floor:oak')).toBe(false);
      expect(loadCampaign().decor).toEqual(['wall:paneling']);
      expect(karmaLeft(loadCampaign())).toBe(5);
    });
  });
});
