import { beforeEach, describe, expect, it } from 'vitest';

import type { SaveCopy } from '../../electron/api';
import { setSeed } from '../../src/core/random';
import { Sim } from '../../src/core/sim/sim';
import { newGame, SAVE_VERSION } from '../../src/core/state/game';
import {
  archiveAutosave,
  autosave,
  AUTOSAVE_ID,
  defaultSaveName,
  deleteSave,
  exportSave,
  gameDate,
  importSave,
  latestSave,
  listSaves,
  MAX_SAVES,
  openInAutosave,
  PREVIOUS_ID,
  readSave,
  type SaveInfo,
  startBackup,
  timeAgo,
  writeSave,
} from '../../src/storage/saves';
import { copyThumb, readThumb, storeThumb } from '../../src/storage/thumbnails';
import { openCenter, run } from './helpers';

// a stand-in for the browser's storage, with an optional size limit
const store = new Map<string, string>();
let quota = Infinity;
/** Which writes from now on fail, counting from 1, as a browser's can for want of room or a damaged profile. */
let failing = new Set<number>();
let writes = 0;
/** The keys whose values were read. */
let reads: string[] = [];
beforeEach(() => {
  store.clear();
  quota = Infinity;
  failing = new Set();
  writes = 0;
  reads = [];
  globalThis.localStorage = {
    /** How many values are stored. */
    get length() {
      return store.size;
    },
    /** The key stored at a position, or null past the end. */
    key: (i: number) => [...store.keys()][i] ?? null,
    /** Read a stored value, or null if there is none. */
    getItem: (k: string) => {
      reads.push(k);
      return store.get(k) ?? null;
    },
    /** Store a value, failing as a full browser does when over the size limit, or when told to. */
    setItem: (k: string, v: string) => {
      if (failing.has(++writes)) throw new DOMException('write failed', 'UnknownError');
      const size = [...store].reduce((n, [key, val]) => n + (key === k ? 0 : val.length), 0) + v.length;
      if (size > quota) throw new DOMException('quota exceeded', 'QuotaExceededError');
      store.set(k, v);
    },
    /** Forget a stored value. */
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

/** Make the given writes from now on fail, counting from 1. */
const failWrites = (...n: number[]) => {
  writes = 0;
  failing = new Set(n);
};

/** Play a standard center for a while and return its state. */
const game = (seed = 1, seconds = 60) => {
  const { sim, s } = openCenter(seed);
  run(sim, seconds);
  return s;
};
/** Return the details of a save, or fail the test if it was refused. */
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
    expect(listSaves()[0]!.savedAt).toBe(2000);
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

  it('loads a save from before the Recliner was renamed, with the Lounger in its place', () => {
    const old = JSON.parse(JSON.stringify(game())) as Record<string, any>;
    old.version = 37;
    old.items.push({ ...old.items[0], id: 99999, type: 'recliner' });
    store.set('pressure-point-save-v1', JSON.stringify(old));
    const loaded = readSave(AUTOSAVE_ID)!;
    expect(loaded.items.find((it) => it.id === 99999)?.type).toBe('lounger');
    expect(loaded.items.some((it) => (it.type as string) === 'recliner')).toBe(false);
  });

  it('drops list entries whose data has gone missing', () => {
    const s = game();
    const a = ok(writeSave(s, 'Here'));
    const b = ok(writeSave(s, 'Gone'));
    store.delete(`pressure-point-save:${b.id}`);
    expect(listSaves().map((i) => i.id)).toEqual([a.id]);
  });

  it('do not count list entries whose data has gone missing against the limit', () => {
    const s = newGame();
    const first = ok(writeSave(s, 'First'));
    for (let i = 1; i < MAX_SAVES; i++) ok(writeSave(s, `Save ${i}`));
    store.delete(`pressure-point-save:${first.id}`);
    expect(listSaves()).toHaveLength(MAX_SAVES - 1);
    ok(writeSave(s, 'One more'));
  });

  it('survives a mangled list', () => {
    store.set('pressure-point-saves', 'garbage');
    expect(listSaves()).toEqual([]);
    expect(typeof writeSave(game(), 'Fresh')).toBe('object');
    expect(listSaves()).toHaveLength(1);
  });
});

describe('a game saved and loaded', () => {
  it('goes on just as it would have had it never been saved', () => {
    const { sim } = openCenter(3);
    // partway through a day, and between the once-a-second checks
    run(sim, 47.35);
    expect(sim.s.guests.length).toBeGreaterThan(0);
    expect(sim.s.practised).toEqual(['massage']);
    expect(sim.s.slowT).toBeGreaterThan(0);
    autosave(sim.s, 1000);
    const loaded = new Sim(readSave(AUTOSAVE_ID)!);
    // side by side, a tick each in turn, so if they drew on the same random numbers neither would get what it should
    for (let i = 0; i < 1500; i++) {
      sim.tick(0.1);
      loaded.tick(0.1);
    }
    expect(sim.s.stats.healed).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(loaded.s))).toEqual(JSON.parse(JSON.stringify(sim.s)));
  });
});

describe('a save that fails partway', () => {
  it('leaves an overwritten slot with its old game and entry together, whichever write fails', () => {
    for (const fail of [1, 2]) {
      store.clear();
      const s = newGame();
      s.money = 111;
      const old = ok(writeSave(s, 'Old', undefined, 1000));
      const before = new Map(store);
      failWrites(fail);
      s.money = 222;
      expect(writeSave(s, 'New', old.id, 2000), `write ${fail} failing`).toBe('full');
      expect(store, `write ${fail} failing`).toEqual(before);
      expect(readSave(old.id)!.money).toBe(111);
      expect(listSaves()).toEqual([old]);
    }
  });

  it('keeps the last autosave and its time when the next one fails', () => {
    const s = newGame();
    s.money = 111;
    autosave(s, 1000);
    failWrites(2);
    s.money = 222;
    expect(autosave(s, 2000)).toBe(false);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(111);
    expect(latestSave()!.savedAt).toBe(1000);
    // and the next one that works saves as usual
    expect(autosave(s, 3000)).toBe(true);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(222);
    expect(latestSave()!.savedAt).toBe(3000);
  });

  it('leaves nothing of a new save behind, whichever write fails', () => {
    const s = newGame();
    const kept = ok(writeSave(s, 'Kept'));
    for (const fail of [1, 2]) {
      const before = new Map(store);
      failWrites(fail);
      expect(writeSave(s, 'Lost')).toBe('full');
      expect(store).toEqual(before);
      expect(listSaves()).toEqual([kept]);
    }
  });

  it('never lists a game that is not there, or loses one, even if putting the list back fails too', () => {
    const s = newGame();
    s.money = 111;
    const old = ok(writeSave(s, 'Old', undefined, 1000));
    failWrites(2, 3);
    expect(writeSave(s, 'Lost')).toBe('full');
    expect(listSaves().map((i) => i.id)).toEqual([old.id]);
    failWrites(2, 3);
    s.money = 222;
    expect(writeSave(s, 'New', old.id, 2000)).toBe('full');
    expect(readSave(old.id)!.money).toBe(111);
  });
});

describe('the cost of saving', () => {
  it('an autosave reads only the list of saves, not every saved game', () => {
    const s = game();
    for (let i = 0; i < MAX_SAVES; i++) ok(writeSave(s, `Save ${i}`));
    autosave(s);
    archiveAutosave();
    reads = [];
    expect(autosave(s)).toBe(true);
    expect(reads).toEqual(['pressure-point-saves']);
  });

  it('listing the saves reads only the list too', () => {
    const s = game();
    ok(writeSave(s, 'One'));
    autosave(s);
    reads = [];
    expect(listSaves()).toHaveLength(2);
    expect(reads).toEqual(['pressure-point-saves']);
  });
});

describe('the backup', () => {
  /** A backup kept in memory, as the desktop app keeps one in files. */
  const fakeBackup = (copy: SaveCopy = { index: null, saves: {} }) => ({
    copy,
    /** Keep a copy of a save and the list. */
    backupSave(id: string, text: string, index: string) {
      copy.saves[id] = text;
      copy.index = index;
    },
    /** Forget a save's copy, keeping the list. */
    dropBackup(id: string, index: string) {
      copy.saves = Object.fromEntries(Object.entries(copy.saves).filter(([key]) => key !== id));
      copy.index = index;
    },
    /** Everything kept, as the files would give it back. */
    readBackup: () => Promise.resolve(structuredClone(copy)),
  });

  it('keeps a copy of each save and of the list as they are written, and forgets deleted ones', async () => {
    const b = fakeBackup();
    await startBackup(b);
    const s = game();
    autosave(s, 1000);
    const a = ok(writeSave(s, 'Kept', undefined, 2000));
    const gone = ok(writeSave(s, 'Gone', undefined, 3000));
    deleteSave(gone.id);
    expect(b.copy.saves).toEqual({
      [AUTOSAVE_ID]: store.get('pressure-point-save-v1'),
      [a.id]: store.get(`pressure-point-save:${a.id}`),
    });
    expect(b.copy.index).toBe(store.get('pressure-point-saves'));
  });

  it('puts every save back when storage has lost them', async () => {
    const b = fakeBackup();
    await startBackup(b);
    const s = game(2, 120);
    autosave(s, 1000);
    const named = ok(writeSave(s, 'Named', undefined, 2000));
    const saves = listSaves();
    store.clear();
    await startBackup(fakeBackup(b.copy));
    expect(listSaves()).toEqual(saves);
    expect(readSave(named.id)).toEqual(JSON.parse(JSON.stringify(s)));
    expect(readSave(AUTOSAVE_ID)).toEqual(JSON.parse(JSON.stringify(s)));
  });

  it('leaves storage that still has saves as it is', async () => {
    const b = fakeBackup();
    await startBackup(b);
    const s = newGame();
    ok(writeSave(s, 'Only in the backup'));
    const copy = structuredClone(b.copy);
    store.clear();
    await startBackup(fakeBackup({ index: null, saves: {} }));
    const here = ok(writeSave(s, 'Here'));
    await startBackup(fakeBackup(copy));
    expect(listSaves()).toEqual([here]);
  });

  it('copies the saves already in storage the first time it is used', async () => {
    await startBackup(fakeBackup({ index: '[]', saves: {} }));
    const s = newGame();
    autosave(s, 1000);
    const a = ok(writeSave(s, 'From before', undefined, 2000));
    const b = fakeBackup();
    await startBackup(b);
    expect(Object.keys(b.copy.saves).sort()).toEqual([a.id, AUTOSAVE_ID].sort());
    store.clear();
    await startBackup(fakeBackup(b.copy));
    expect(listSaves().map((i) => i.id)).toEqual([a.id, AUTOSAVE_ID]);
  });

  it('never stops the game saving when it fails', async () => {
    /** A backup on a disk that has gone. */
    const broken = () => {
      throw new Error('no disk');
    };
    await startBackup({ backupSave: broken, dropBackup: broken, readBackup: broken });
    const info = ok(writeSave(newGame(), 'Saved anyway'));
    expect(autosave(newGame())).toBe(true);
    deleteSave(info.id);
    expect(listSaves().map((i) => i.id)).toEqual([AUTOSAVE_ID]);
  });
});

describe('starting over', () => {
  it('moves the autosave to the Previous game slot instead of losing it', () => {
    const s = game(4, 200);
    autosave(s, 1000);
    archiveAutosave(2000);
    expect(readSave(AUTOSAVE_ID)).toBeNull();
    const prev = listSaves()[0]!;
    expect(prev.id).toBe(PREVIOUS_ID);
    expect(prev.name).toContain('Previous game');
    expect(readSave(PREVIOUS_ID)!.stats).toEqual(s.stats);
  });

  it('keeps the previous game in storage once it is opened, and the game it swapped with as the previous one', () => {
    setSeed(1);
    const left = newGame();
    left.money = 111;
    autosave(left, 1000);
    const earlier = newGame();
    earlier.money = 222;
    writeSave(earlier, 'Previous game', PREVIOUS_ID, 500);
    const opened = readSave(PREVIOUS_ID)!;
    expect(openInAutosave(opened, 2000)).toBe(true);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(222);
    expect(readSave(PREVIOUS_ID)!.money).toBe(111);
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

  it('sets aside an autosave it cannot open, rather than let the new game write over it', () => {
    const later = JSON.stringify({ ...newGame(), version: SAVE_VERSION + 1 });
    store.set('pressure-point-save-v1', later);
    expect(readSave(AUTOSAVE_ID), 'from a later version').toBeNull();
    expect(archiveAutosave(3000)).toBe(true);
    autosave(newGame(), 4000);
    expect(readSave(AUTOSAVE_ID)).not.toBeNull();
    const kept = [...store].filter(([k, v]) => v === later && k !== 'pressure-point-save-v1');
    expect(kept, 'the unreadable game is still there, under a key of its own').toHaveLength(1);
    // and a second one is kept beside the first, not over it
    store.set('pressure-point-save-v1', `${later} `);
    expect(archiveAutosave(5000)).toBe(true);
    expect([...store].filter(([, v]) => v.startsWith(later))).toHaveLength(2);
  });

  it('will not start a new game over an unreadable autosave it has no room to set aside', () => {
    const later = JSON.stringify({ ...newGame(), version: SAVE_VERSION + 1 });
    store.set('pressure-point-save-v1', later);
    quota = later.length + 10;
    expect(archiveAutosave(3000)).toBe(false);
    expect(store.get('pressure-point-save-v1')).toBe(later);
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

describe('save pictures', () => {
  it('are kept per save and go when the save is deleted', () => {
    const info = ok(writeSave(game(), 'Pictured'));
    storeThumb(info.id, 'data:image/jpeg;base64,AAAA');
    expect(readThumb(info.id)).toBe('data:image/jpeg;base64,AAAA');
    deleteSave(info.id);
    expect(readThumb(info.id)).toBeNull();
  });

  it('move with the autosave into the previous game slot', () => {
    autosave(game(), 1000);
    storeThumb(AUTOSAVE_ID, 'data:image/jpeg;base64,BBBB');
    archiveAutosave(2000);
    expect(readThumb(PREVIOUS_ID)).toBe('data:image/jpeg;base64,BBBB');
    expect(readThumb(AUTOSAVE_ID)).toBeNull();
  });

  it('are not carried over from a save that has none', () => {
    storeThumb(PREVIOUS_ID, 'data:image/jpeg;base64,CCCC');
    copyThumb(AUTOSAVE_ID, PREVIOUS_ID);
    expect(readThumb(PREVIOUS_ID)).toBeNull();
  });

  it('are skipped, not fatal, when storage is full', () => {
    quota = 10;
    storeThumb('x', 'data:image/jpeg;base64,DDDDDDDDDDDD');
    expect(readThumb('x')).toBeNull();
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

  it('reject games with things this version does not know, rather than crash opening them', () => {
    /** A file holding a fresh game with one change made to it. */
    const fileWith = (change: (s: Record<string, any>) => void) => {
      const state = JSON.parse(JSON.stringify(game())) as Record<string, any>;
      change(state);
      return JSON.stringify({ format: 'pressure-point-save', name: 'From the future', state });
    };
    expect(importSave(fileWith((s) => (s.items[0].type = 'hover_table')))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.rooms[0].type = 'float_tank')))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.staff[0].role = 'druid')))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.candidates[0].role = 'druid')))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.staff[0].quals = ['levitation'])))).toBe('invalid');
    expect(importSave(fileWith((s) => s.guests.push({ ...s.guests[0], condition: 'hiccups' })))).toBe('invalid');
    expect(listSaves()).toEqual([]);
    // and the same goes for a game already in storage
    store.set('pressure-point-save-v1', JSON.stringify(JSON.parse(fileWith((s) => (s.items[0].type = 'x'))).state));
    expect(readSave(AUTOSAVE_ID)).toBeNull();
  });

  it('reject games whose headline figures are missing or out of range', () => {
    /** A file holding a brand new game with one change made to it. */
    const fileWith = (change: (s: Record<string, any>) => void) => {
      const state = JSON.parse(JSON.stringify(newGame())) as Record<string, any>;
      change(state);
      return JSON.stringify({ format: 'pressure-point-save', state });
    };
    expect(importSave(fileWith((s) => delete s.stats))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.stars = -1)))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.stars = 99)))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.money = 'lots')))).toBe('invalid');
    expect(importSave(fileWith((s) => (s.day = null)))).toBe('invalid');
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
