import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTOSAVE_ID,
  MAX_SAVES,
  PREVIOUS_ID,
  archiveAutosave,
  autosave,
  defaultSaveName,
  deleteSave,
  exportSave,
  gameDate,
  importSave,
  latestSave,
  listSaves,
  readSave,
  timeAgo,
  writeSave,
  type SaveInfo,
} from '../../src/saves';
import { SAVE_VERSION, newGame, setSeed } from '../../src/state';
import { openCenter, run } from './helpers';

// a stand-in for the browser's storage, with an optional size limit
const store = new Map<string, string>();
let quota = Infinity;
beforeEach(() => {
  store.clear();
  quota = Infinity;
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const size = [...store].reduce((n, [key, val]) => n + (key === k ? 0 : val.length), 0) + v.length;
      if (size > quota) throw new DOMException('quota exceeded', 'QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

const game = (seed = 1, seconds = 60) => {
  const { sim, s } = openCenter(seed);
  run(sim, seconds);
  return s;
};
const ok = (r: SaveInfo | string): SaveInfo => {
  if (typeof r === 'string') throw new Error(`save failed: ${r}`);
  return r;
};

describe('named saves', () => {
  it('round-trip a running game exactly', () => {
    const s = game(5, 120);
    const info = ok(writeSave(s, 'Before the audit'));
    expect(readSave(info.id)).toEqual(JSON.parse(JSON.stringify(s)));
    expect(info).toMatchObject({
      name: 'Before the audit',
      day: s.day,
      stars: s.stars,
      healed: s.stats.healed,
      money: Math.round(s.money),
    });
  });

  it('are listed newest first, alongside the autosave', () => {
    const s = game();
    ok(writeSave(s, 'First', undefined, 1000));
    ok(writeSave(s, 'Second', undefined, 3000));
    autosave(s, 2000);
    expect(listSaves().map((i) => i.name)).toEqual(['Second', 'Autosave', 'First']);
    expect(latestSave()!.name).toBe('Second');
  });

  it('can be overwritten in place, keeping their slot', () => {
    const s = game();
    const first = ok(writeSave(s, 'Slot', undefined, 1000));
    s.money = 123;
    const again = ok(writeSave(s, 'Slot', first.id, 2000));
    expect(again.id).toBe(first.id);
    expect(listSaves()).toHaveLength(1);
    expect(readSave(first.id)!.money).toBe(123);
    expect(listSaves()[0].savedAt).toBe(2000);
  });

  it('fall back to the game date when given no name, and trim long ones', () => {
    const s = game();
    expect(ok(writeSave(s, '   ')).name).toBe(defaultSaveName(s));
    expect(ok(writeSave(s, 'x'.repeat(200))).name).toHaveLength(60);
  });

  it('can be deleted', () => {
    const s = game();
    const a = ok(writeSave(s, 'Keep'));
    const b = ok(writeSave(s, 'Bin'));
    deleteSave(b.id);
    expect(listSaves().map((i) => i.id)).toEqual([a.id]);
    expect(readSave(b.id)).toBeNull();
  });

  it('are limited in number, but the autosave still works at the limit', () => {
    const s = newGame();
    for (let i = 0; i < MAX_SAVES; i++) ok(writeSave(s, `Save ${i}`, undefined, i));
    expect(writeSave(s, 'One too many')).toBe('full');
    expect(listSaves()).toHaveLength(MAX_SAVES);
    expect(autosave(s)).toBe(true);
    // overwriting an existing slot is still fine
    expect(typeof writeSave(s, 'Save 0', listSaves().at(-1)!.id)).toBe('object');
  });

  it('report a full disk without leaving half a save behind', () => {
    const s = game();
    ok(writeSave(s, 'Fits'));
    quota = [...store.values()].reduce((n, v) => n + v.length, 0) + 100;
    const keys = store.size;
    expect(writeSave(s, 'Does not fit')).toBe('full');
    expect(store.size).toBe(keys);
    expect(listSaves().map((i) => i.name)).toEqual(['Fits']);
    expect(autosave(s)).toBe(false);
  });
});

describe('loading', () => {
  it('returns nothing for a missing, corrupt or too-new save', () => {
    expect(readSave('nope')).toBeNull();
    expect(listSaves()).toEqual([]);
    expect(latestSave()).toBeNull();
    store.set('pressure-point-save-v1', '{not json');
    expect(readSave(AUTOSAVE_ID)).toBeNull();
    store.set('pressure-point-save-v1', JSON.stringify({ ...newGame(), version: SAVE_VERSION + 1 }));
    expect(readSave(AUTOSAVE_ID)).toBeNull();
    store.set('pressure-point-save-v1', JSON.stringify({ hello: 'world' }));
    expect(readSave(AUTOSAVE_ID)).toBeNull();
  });

  it('finds an autosave written before save slots existed', () => {
    const s = game(3);
    store.set('pressure-point-save-v1', JSON.stringify(s));
    const [only] = listSaves();
    expect(only).toMatchObject({ id: AUTOSAVE_ID, name: 'Autosave', day: s.day });
    expect(readSave(AUTOSAVE_ID)!.staff).toHaveLength(s.staff.length);
  });

  it('upgrades an old save as it loads', () => {
    const old = JSON.parse(JSON.stringify(game())) as Record<string, any>;
    old.version = 1;
    delete old.loan;
    for (const st of old.staff) delete st.morale;
    store.set('pressure-point-save-v1', JSON.stringify(old));
    const loaded = readSave(AUTOSAVE_ID)!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.loan).toBe(0);
    expect(loaded.staff.every((x) => x.morale === 75)).toBe(true);
  });

  it('drops list entries whose data has gone missing', () => {
    const s = game();
    const a = ok(writeSave(s, 'Here'));
    const b = ok(writeSave(s, 'Gone'));
    store.delete(`pressure-point-save:${b.id}`);
    expect(listSaves().map((i) => i.id)).toEqual([a.id]);
  });

  it('survives a mangled list', () => {
    store.set('pressure-point-saves', 'garbage');
    expect(listSaves()).toEqual([]);
    expect(typeof writeSave(game(), 'Fresh')).toBe('object');
    expect(listSaves()).toHaveLength(1);
  });
});

describe('starting over', () => {
  it('moves the autosave to the Previous game slot instead of losing it', () => {
    const s = game(4, 200);
    autosave(s, 1000);
    archiveAutosave(2000);
    expect(readSave(AUTOSAVE_ID)).toBeNull();
    const [prev] = listSaves();
    expect(prev.id).toBe(PREVIOUS_ID);
    expect(prev.name).toContain('Previous game');
    expect(readSave(PREVIOUS_ID)!.stats).toEqual(s.stats);
  });

  it('keeps only one previous game, and does nothing without an autosave', () => {
    archiveAutosave();
    expect(listSaves()).toEqual([]);
    setSeed(1);
    const first = newGame();
    first.money = 111;
    autosave(first, 1000);
    archiveAutosave(1500);
    const second = newGame();
    second.money = 222;
    autosave(second, 2000);
    archiveAutosave(2500);
    expect(listSaves()).toHaveLength(1);
    expect(readSave(PREVIOUS_ID)!.money).toBe(222);
  });

  it('does not count the autosave or the previous game against the limit', () => {
    const s = newGame();
    autosave(s);
    archiveAutosave();
    autosave(s);
    for (let i = 0; i < MAX_SAVES; i++) ok(writeSave(s, `Save ${i}`));
    expect(listSaves()).toHaveLength(MAX_SAVES + 2);
  });
});

describe('export and import', () => {
  it('carry a game through a file unchanged', () => {
    const s = game(6, 180);
    const info = ok(writeSave(s, "Max's Center #1"));
    const file = exportSave(info.id)!;
    expect(file.filename).toBe('pressure-point-max-s-center-1.json');
    store.clear();
    const back = ok(importSave(file.text));
    expect(back.name).toBe("Max's Center #1");
    expect(readSave(back.id)).toEqual(JSON.parse(JSON.stringify(s)));
  });

  it('give an imported autosave a name of its own', () => {
    const s = game();
    autosave(s);
    const file = exportSave(AUTOSAVE_ID)!;
    const back = ok(importSave(file.text));
    expect(back.id).not.toBe(AUTOSAVE_ID);
    expect(back.name).toBe(`Imported (${gameDate(s.day)})`);
  });

  it('reject files that are not saves', () => {
    expect(importSave('not json at all')).toBe('invalid');
    expect(importSave('{}')).toBe('invalid');
    expect(importSave(JSON.stringify({ format: 'pressure-point-save', state: { rooms: 'nope' } }))).toBe('invalid');
    expect(importSave(JSON.stringify({ format: 'something-else', state: newGame() }))).toBe('invalid');
    expect(
      importSave(JSON.stringify({ format: 'pressure-point-save', state: { ...newGame(), version: SAVE_VERSION + 5 } })),
    ).toBe('invalid');
    expect(listSaves()).toEqual([]);
  });

  it('upgrade an old exported save on the way in', () => {
    const old = JSON.parse(JSON.stringify(game())) as Record<string, any>;
    old.version = 1;
    delete old.priceLevel;
    const back = ok(importSave(JSON.stringify({ format: 'pressure-point-save', name: 'Old one', state: old })));
    expect(readSave(back.id)!.priceLevel).toBe(1);
  });

  it('return nothing to export for a save that does not exist', () => {
    expect(exportSave('missing')).toBeNull();
  });
});

describe('labels', () => {
  it('describe the game date', () => {
    expect(gameDate(0)).toBe('Day 1, Month 1, Year 1');
    expect(gameDate(29.9)).toBe('Day 30, Month 1, Year 1');
    expect(gameDate(30)).toBe('Day 1, Month 2, Year 1');
    expect(gameDate(365)).toBe('Day 6, Month 1, Year 2');
  });

  it('describe how long ago a save was made', () => {
    const now = 1_000_000_000_000;
    expect(timeAgo(0, now)).toBe('earlier');
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now - 60_000, now)).toBe('1 minute ago');
    expect(timeAgo(now - 5 * 3600_000, now)).toBe('5 hours ago');
    expect(timeAgo(now - 30 * 3600_000, now)).toBe('yesterday');
    expect(timeAgo(now - 5 * 86400_000, now)).toBe('5 days ago');
  });
});
