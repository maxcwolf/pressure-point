// Profiles: two or more people on one computer, each with saves, campaign and settings of their own, the first keeping
// everything from before there were profiles.
import { beforeEach, describe, expect, it } from 'vitest';

import type { SaveCopy } from '../../electron/api';
import { type CenterId, FEATURE_ORDER } from '../../src/core/data';
import { setSeed } from '../../src/core/random';
import { newGame } from '../../src/core/state/game';
import type { Template } from '../../src/core/templates';
import { forgetSharing, loadSharing, saveSharing } from '../../src/storage/analytics';
import { buyWithKarma, loadCampaign, recordGame, recordLesson } from '../../src/storage/campaign';
import { DEFAULT_KEYS, forgetControls, loadControls, rebind, saveControls } from '../../src/storage/controls';
import { forgetDisplay, loadDisplay, saveDisplay } from '../../src/storage/display';
import {
  addProfile,
  backupProfile,
  currentProfile,
  currentProfileInfo,
  deleteProfile,
  FIRST_NAME,
  FIRST_PROFILE,
  forgetProfile,
  loadProfiles,
  MAX_PROFILES,
  nextName,
  ownedBy,
  type Profile,
  profileGone,
  readProfiles,
  renameProfile,
  statsName,
  sweepProfiles,
  switchProfile,
} from '../../src/storage/profiles';
import {
  autosave,
  AUTOSAVE_ID,
  isAutosaveKey,
  listSaves,
  openInAutosave,
  PREVIOUS_ID,
  readSave,
  type SaveInfo,
  startBackup,
  storageChange,
  writeSave,
} from '../../src/storage/saves';
import {
  loadAudio,
  loadDisciplinePrefs,
  loadSandbox,
  loadStatsView,
  loadTutorialPref,
  saveAudio,
  saveDisciplinePref,
  saveFeaturePref,
  saveSandbox,
  saveStatsView,
  saveTutorialPref,
} from '../../src/storage/settings';
import { loadTemplates, saveTemplates } from '../../src/storage/templates';
import { readThumb, storeThumb } from '../../src/storage/thumbnails';
import { saveWelcomeSeen, welcomeSeen } from '../../src/storage/welcome';
import { contentsOf, deleteWarning, makeRoom, profileFacts, refusalNote, whoseSaves } from '../../src/ui/lib/profiles';

// stand-ins for the browser's storage: what lasts, and what lasts only as long as the tab
const store = new Map<string, string>();
const tab = new Map<string, string>();
/** A stand-in for one of the browser's stores, kept in a map. */
const fakeStorage = (map: Map<string, string>) =>
  ({
    /** How many values are stored. */
    get length() {
      return map.size;
    },
    /** The key stored at a position, or null past the end. */
    key: (i: number) => [...map.keys()][i] ?? null,
    /** Read a stored value, or null if there is none. */
    getItem: (k: string) => map.get(k) ?? null,
    /** Store a value. */
    setItem: (k: string, v: string) => void map.set(k, v),
    /** Forget a stored value. */
    removeItem: (k: string) => void map.delete(k),
    /** Forget everything. */
    clear: () => {
      map.clear();
    },
  }) as Storage;

/** Forget everything read in, as a new page would. */
const newPage = () => {
  tab.clear();
  forgetProfile();
  forgetControls();
  forgetDisplay();
  forgetSharing();
};

beforeEach(() => {
  store.clear();
  globalThis.localStorage = fakeStorage(store);
  globalThis.sessionStorage = fakeStorage(tab);
  newPage();
  setSeed(1);
});

/** Return a profile, or fail the test if it was refused. */
const made = (r: Profile | string | null): Profile => {
  if (r === null || typeof r === 'string') throw new Error(`refused: ${String(r)}`);
  return r;
};
/** Return the details of a save, or fail the test if it was refused. */
const ok = (r: SaveInfo | string): SaveInfo => {
  if (typeof r === 'string') throw new Error(`save failed: ${r}`);
  return r;
};
/** A new game in a center, told apart by its money. */
const at = (center: CenterId, money: number) => {
  const s = newGame(center);
  s.money = money;
  return s;
};
/** A small massage room as a template, by name. */
const template = (name: string): Template => ({
  id: 0,
  name,
  layout: {
    type: 'massage',
    w: 4,
    h: 3,
    door: { x: 1, y: 2, dx: 0, dy: 1 },
    windows: [],
    items: [{ type: 'massage_table', x: 1, y: 0, rot: 0 }],
  },
});
/** The names of this profile's saves, in alphabetical order, as saves made in the same moment come in any order. */
const names = () =>
  listSaves()
    .map((i) => i.name)
    .sort();
/** Everything in storage, as text, to compare before and after. */
const snapshot = () => new Map(store);
/** The stored keys a profile keeps for itself. */
const keysOf = (profile: string) => [...store.keys()].filter((k) => ownedBy(profile, k)).sort();
/** Switch to a profile as the game does: note it, then start a new page. */
const switchTo = (id: string) => {
  expect(switchProfile(id)).toBe(true);
  forgetControls();
};
/** What another tab deleting a profile leaves in storage, with this page none the wiser: the list without it. */
const deletedElsewhere = (id: string) => {
  const profiles = loadProfiles().profiles.filter((p) => p.id !== id);
  store.set('pressure-point-profiles', JSON.stringify({ profiles, current: profiles[0]!.id }));
  for (const key of keysOf(id)) store.delete(key);
};

/** A computer's storage from before there were profiles: one player's games, campaign, templates and settings. */
function seedOldStorage() {
  autosave(at('willow', 111), 1000);
  ok(writeSave(at('sandbox', 222), 'My sandbox', undefined, 900));
  storeThumb(AUTOSAVE_ID, 'data:image/jpeg;base64,AAAA');
  recordGame({ ...at('willow', 1), stars: 2 });
  recordLesson('first-guest' as never);
  saveTemplates([template('Big massage')]);
  saveWelcomeSeen();
  saveTutorialPref(false);
  saveControls({ ...loadControls(), keys: rebind(DEFAULT_KEYS, 'pause', 'KeyP'), dev: true });
  saveDisciplinePref('acupuncture', false);
  saveFeaturePref(FEATURE_ORDER[0]!, true);
  saveSandbox({ ...loadSandbox(), money: 75000 });
  saveStatsView(['money']);
  saveDisplay({ ...loadDisplay(), uiScale: 1.3 });
  saveAudio({ sound: false, music: true });
  saveSharing(false);
  // as an older version stored them: dev mode in the controls, and no list of profiles
  store.delete('pressure-point-dev');
}

describe('a computer from before profiles', () => {
  it('has one profile, Player 1, which is everything already there, with nothing stored or moved', () => {
    seedOldStorage();
    const before = snapshot();
    newPage();
    expect(loadProfiles()).toEqual({ profiles: [{ id: FIRST_PROFILE, name: FIRST_NAME }], current: FIRST_PROFILE });
    expect(currentProfileInfo()).toEqual({ id: FIRST_PROFILE, name: 'Player 1' });
    expect(listSaves().map((i) => i.name)).toEqual(['Autosave', 'My sandbox']);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(111);
    expect(readThumb(AUTOSAVE_ID)).toBe('data:image/jpeg;base64,AAAA');
    expect(loadCampaign().stars).toEqual({ willow: 2 });
    expect(loadTemplates().map((t) => t.name)).toEqual(['Big massage']);
    expect(welcomeSeen()).toBe(true);
    expect(loadTutorialPref()).toBe(false);
    expect(loadControls().keys.pause).toBe('KeyP');
    expect(loadDisciplinePrefs().acupuncture).toBe(false);
    expect(loadSandbox().money).toBe(75000);
    expect(loadStatsView()).toEqual(['money']);
    // dev mode, which was in the controls, is the computer's now
    expect(loadControls().dev).toBe(true);
    expect(store.get('pressure-point-dev')).toBe('on');
    // nothing else was written, and nothing the old version reads was touched
    expect(new Map([...store].filter(([k]) => k !== 'pressure-point-dev'))).toEqual(before);
    expect(store.has('pressure-point-profiles')).toBe(false);
  });

  it('keeps it all as the first profile once another is added, and finds it there again', () => {
    seedOldStorage();
    newPage();
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    newPage();
    expect(currentProfile()).toBe(sam.id);
    switchTo(FIRST_PROFILE);
    newPage();
    expect(listSaves().map((i) => i.name)).toEqual(['Autosave', 'My sandbox']);
    expect(loadCampaign().stars).toEqual({ willow: 2 });
    expect(loadTemplates()).toHaveLength(1);
    expect(loadControls().keys.pause).toBe('KeyP');
  });
});

describe('a new profile', () => {
  it('starts with no saves, a fresh campaign and settings of its own, and shares the computer’s', () => {
    seedOldStorage();
    newPage();
    const sam = made(addProfile('  Sam  '));
    expect(sam.name).toBe('Sam');
    expect(sam.id).toMatch(/^[a-z0-9]{8}$/);
    switchTo(sam.id);
    newPage();
    expect(listSaves()).toEqual([]);
    expect(readSave(AUTOSAVE_ID)).toBeNull();
    expect(readThumb(AUTOSAVE_ID)).toBeNull();
    expect(loadCampaign().stars).toEqual({});
    expect(loadTemplates()).toEqual([]);
    expect(welcomeSeen()).toBe(false);
    // a new player is walked through the tutorial, whatever the first profile chose
    expect(loadTutorialPref()).toBe(true);
    expect(loadControls().keys).toEqual(DEFAULT_KEYS);
    expect(loadDisciplinePrefs()).toEqual({});
    expect(loadStatsView()).toEqual([]);
    // the computer's own: dev mode, the display, the sound and sharing play statistics
    expect(loadControls().dev).toBe(true);
    expect(loadDisplay().uiScale).toBe(1.3);
    expect(loadAudio()).toEqual({ sound: false, music: true });
    expect(loadSharing()).toBe(false);
  });

  it('keeps everything it stores under its own keys', () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    seedOldStorage();
    const keys = [...store.keys()];
    const machine = [
      'pressure-point-profiles',
      'pressure-point-display',
      'pressure-point-audio',
      'pressure-point-analytics',
    ];
    expect(keys.filter((k) => !machine.includes(k) && !ownedBy(sam.id, k))).toEqual([]);
    expect(keys.filter((k) => ownedBy(FIRST_PROFILE, k))).toEqual([]);
  });

  it('is told apart from the first in play statistics and in the desktop app’s copies', () => {
    const sam = made(addProfile('Sam'));
    expect(statsName(FIRST_PROFILE)).toBe('');
    expect(statsName(sam.id)).toBe(`pressure-point-${sam.id}`);
    expect(backupProfile(FIRST_PROFILE)).toBeUndefined();
    expect(backupProfile(sam.id)).toBe(sam.id);
  });
});

describe("one profile's games", () => {
  it("never read or overwrite another's saves, autosave or Previous game", () => {
    autosave(at('willow', 111), 1000);
    expect(openInAutosave(at('exchange', 222), 'new:exchange', 2000)).toBe(true);
    ok(writeSave(at('sandbox', 333), 'Mine', undefined, 2500));
    const first = snapshot();
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    // Sam's own games: an autosave, a new game moving it to Previous game, and a named save
    expect(readSave(AUTOSAVE_ID)).toBeNull();
    expect(readSave(PREVIOUS_ID)).toBeNull();
    autosave(at('boardwalk', 444), 3000);
    expect(openInAutosave(at('willow', 555), 'new:willow', 4000)).toBe(true);
    ok(writeSave(at('sandbox', 666), 'Theirs', undefined, 4500));
    expect(readSave(AUTOSAVE_ID)!.money).toBe(555);
    expect(readSave(PREVIOUS_ID)!.money).toBe(444);
    expect(names()).toEqual(['Autosave', expect.stringMatching(/^Previous game/), 'Theirs']);
    // nothing the first profile keeps has changed
    for (const [key, value] of first) if (ownedBy(FIRST_PROFILE, key)) expect(store.get(key)).toBe(value);
    switchTo(FIRST_PROFILE);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(222);
    expect(readSave(PREVIOUS_ID)!.money).toBe(111);
    expect(names()).toEqual(['Autosave', 'Mine', expect.stringMatching(/^Previous game/)]);
  });

  it("keep a center's last game when Previous game is replaced, in each profile alone", () => {
    const sam = made(addProfile('Sam'));
    // the first profile has a Willow Lane game in Previous game, and another center in the autosave
    autosave(at('willow', 111), 1000);
    openInAutosave(at('exchange', 222), 'new:exchange', 2000);
    // Sam's games do not count as the first profile's Willow Lane games, nor push them out
    switchTo(sam.id);
    autosave(at('willow', 333), 2500);
    openInAutosave(at('boardwalk', 444), 'new:boardwalk', 2600);
    switchTo(FIRST_PROFILE);
    expect(openInAutosave(at('boardwalk', 555), 'new:boardwalk', 3000)).toBe(true);
    const willow = listSaves().filter((i) => i.center === 'willow');
    expect(willow.map((i) => i.name)).toEqual([expect.stringMatching(/^Willow Lane \(Day/)]);
    expect(readSave(willow[0]!.id)!.money).toBe(111);
    switchTo(sam.id);
    expect(listSaves().map((i) => `${i.center ?? ''}${i.id === PREVIOUS_ID ? ', previous' : ''}`)).toEqual(
      expect.arrayContaining(['boardwalk', 'willow, previous']),
    );
    expect(listSaves()).toHaveLength(2);
  });

  it('only warn about another tab saving over them when it is the same profile', () => {
    const sam = made(addProfile('Sam'));
    expect(isAutosaveKey('pressure-point-save-v1')).toBe(true);
    switchTo(sam.id);
    expect(isAutosaveKey('pressure-point-save-v1')).toBe(false);
    expect(isAutosaveKey(`profile:${sam.id}:pressure-point-save-v1`)).toBe(true);
  });

  it('earn stars, achievements and karma unlocks for their own profile only', () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    recordGame({ ...at('willow', 1), stars: 3, achieved: ['called-in'] } as never);
    expect(buyWithKarma('bonsai')).toBe(true);
    expect(loadCampaign().stars).toEqual({ willow: 3 });
    switchTo(FIRST_PROFILE);
    expect(loadCampaign()).toMatchObject({ stars: {}, achieved: [], unlocked: [] });
    expect(loadCampaign(sam.id)).toMatchObject({ stars: { willow: 3 }, achieved: ['called-in'], unlocked: ['bonsai'] });
  });
});

describe('the page’s profile', () => {
  it('is read once, so a game goes on saving to its own profile whatever another tab switches to', () => {
    const sam = made(addProfile('Sam'));
    expect(currentProfile()).toBe(FIRST_PROFILE);
    // another tab switches the computer to Sam
    store.set('pressure-point-profiles', JSON.stringify({ ...loadProfiles(), current: sam.id }));
    autosave(at('willow', 111), 1000);
    expect(store.has('pressure-point-save-v1')).toBe(true);
    expect(keysOf(sam.id)).toEqual([]);
  });

  it("is this tab's after a reload, and the one played last on the computer in a new tab", () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    const robin = made(addProfile('Robin'));
    // another tab switches the computer to Robin
    store.set('pressure-point-profiles', JSON.stringify({ ...loadProfiles(), current: robin.id }));
    // this tab reloads, leaving a game: still Sam
    forgetProfile();
    expect(currentProfile()).toBe(sam.id);
    // a new tab, or the desktop app opened again: Robin
    newPage();
    expect(currentProfile()).toBe(robin.id);
  });
});

describe('managing profiles', () => {
  it('names a new profile, refusing a name another has or none, and stops at the most there is room for', () => {
    expect(nextName()).toBe('Player 2');
    expect(addProfile('   ')).toBe('empty');
    expect(addProfile('player 1')).toBe('taken');
    made(addProfile('Player 2'));
    expect(nextName()).toBe('Player 3');
    for (let i = 3; i <= MAX_PROFILES; i++) made(addProfile(`P${i}`));
    expect(addProfile('One too many')).toBe('full');
    expect(loadProfiles().profiles).toHaveLength(MAX_PROFILES);
  });

  it('cuts a long name short and tidies its spaces', () => {
    expect(made(addProfile('  A   very   long name that goes on and on  ')).name).toBe('A very long name that go');
  });

  it('renames a profile, the first among them, without touching what it keeps', () => {
    autosave(at('willow', 111), 1000);
    const sam = made(addProfile('Sam'));
    expect(renameProfile(FIRST_PROFILE, 'SAM')).toBe('taken');
    expect(renameProfile(FIRST_PROFILE, '')).toBe('empty');
    expect(renameProfile('nobody', 'Robin')).toBeNull();
    expect(made(renameProfile(FIRST_PROFILE, 'Robin'))).toEqual({ id: FIRST_PROFILE, name: 'Robin' });
    // a profile may take its own name again in other capitals
    expect(made(renameProfile(sam.id, 'SAM')).name).toBe('SAM');
    expect(loadProfiles().profiles.map((p) => p.name)).toEqual(['Robin', 'SAM']);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(111);
  });

  it('switches only to a profile there is', () => {
    expect(switchProfile('nobody')).toBe(false);
    expect(currentProfile()).toBe(FIRST_PROFILE);
  });

  it('never deletes the last profile left', () => {
    expect(deleteProfile(FIRST_PROFILE)).toBe(false);
    const sam = made(addProfile('Sam'));
    expect(deleteProfile(FIRST_PROFILE)).toBe(true);
    expect(deleteProfile(sam.id)).toBe(false);
    expect(loadProfiles().profiles).toEqual([sam]);
  });

  it("deletes a profile's saves, campaign, templates, settings and play statistics id, and nothing else", () => {
    seedOldStorage();
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    seedOldStorage();
    store.set(`ph_${statsName(sam.id)}`, '{"distinct_id":"x"}');
    switchTo(FIRST_PROFILE);
    const first = keysOf(FIRST_PROFILE);
    expect(keysOf(sam.id).length).toBeGreaterThan(10);
    expect(deleteProfile(sam.id)).toBe(true);
    expect(keysOf(sam.id)).toEqual([]);
    expect([...store.keys()].filter((k) => k.includes(sam.id))).toEqual([]);
    expect(keysOf(FIRST_PROFILE)).toEqual(first);
    expect(loadProfiles().profiles.map((p) => p.name)).toEqual(['Player 1']);
  });

  it("deletes the first profile's keys from before profiles, leaving the computer's and the other profiles'", () => {
    seedOldStorage();
    // the title screen reads the controls before anything can be deleted, which keeps dev mode for the computer
    newPage();
    loadControls();
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('willow', 777), 5000);
    const theirs = keysOf(sam.id);
    expect(deleteProfile(FIRST_PROFILE)).toBe(true);
    expect(keysOf(FIRST_PROFILE)).toEqual([]);
    expect(keysOf(sam.id)).toEqual(theirs);
    expect([...store.keys()].filter((k) => !ownedBy(sam.id, k)).sort()).toEqual([
      'pressure-point-analytics',
      'pressure-point-audio',
      'pressure-point-dev',
      'pressure-point-display',
      'pressure-point-profiles',
    ]);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(777);
  });

  it('moves the game to the next profile when the one playing is deleted', () => {
    const sam = made(addProfile('Sam'));
    expect(deleteProfile(FIRST_PROFILE)).toBe(true);
    expect(currentProfile()).toBe(sam.id);
    newPage();
    expect(currentProfile()).toBe(sam.id);
  });

  it("starts a new profile empty even where a profile's keys were left behind", () => {
    store.set('profile:aaaaaaaa:pressure-point-save-v1', 'left behind');
    const sam = made(addProfile('Sam', () => 0));
    expect(sam.id).toBe('00000000');
    store.set('profile:00000000:pressure-point-saves', 'left behind');
    store.set('profile:00000001:pressure-point-saves', 'not this one');
    deleteProfile(sam.id);
    const robin = made(addProfile('Robin', () => 0));
    expect(robin.id).toBe('00000000');
    expect(keysOf(robin.id)).toEqual([]);
    expect(store.get('profile:00000001:pressure-point-saves')).toBe('not this one');
  });
});

describe('a stored list of profiles', () => {
  it('drops anything malformed, falling back to the first profile alone', () => {
    const alone = { profiles: [{ id: FIRST_PROFILE, name: FIRST_NAME }], current: FIRST_PROFILE };
    for (const raw of [null, 7, 'text', {}, { profiles: 'x' }, { profiles: [] }, { profiles: [{ id: '../x' }] }])
      expect(readProfiles(raw)).toEqual(alone);
    expect(
      readProfiles({
        profiles: [
          { id: 'abc12345', name: 'Sam' },
          { id: 'abc12345', name: 'Twice' },
          { id: 'BAD', name: 'Bad id' },
          { id: FIRST_PROFILE },
          'not a profile',
        ],
        current: 'gone',
      }),
    ).toEqual({
      profiles: [
        { id: 'abc12345', name: 'Sam' },
        { id: FIRST_PROFILE, name: 'Player 2' },
      ],
      current: 'abc12345',
    });
  });

  it('is read as the first alone when storage holds rubbish and no other profile keeps anything', () => {
    store.set('pressure-point-profiles', '{not json');
    expect(loadProfiles().profiles).toEqual([{ id: FIRST_PROFILE, name: FIRST_NAME }]);
    expect(currentProfile()).toBe(FIRST_PROFILE);
  });

  it('is worked out again from the profiles’ keys when it will not read, so no profile is lost', () => {
    autosave(at('willow', 1), 1000);
    const sam = made(addProfile('Sam', () => 0.5));
    const robin = made(addProfile('Robin', () => 0.1));
    switchTo(sam.id);
    autosave(at('exchange', 2), 2000);
    switchTo(robin.id);
    saveWelcomeSeen();
    store.set('pressure-point-profiles', '{not json');
    newPage();
    // named by place, in the order of their ids
    expect(loadProfiles()).toEqual({
      profiles: [
        { id: FIRST_PROFILE, name: FIRST_NAME },
        { id: robin.id, name: 'Player 2' },
        { id: sam.id, name: 'Player 3' },
      ],
      current: FIRST_PROFILE,
    });
    // the next change to the list stores every one of them, so none is swept away
    const kim = made(addProfile('Kim'));
    newPage();
    sweepProfiles();
    expect(loadProfiles().profiles.map((p) => p.id)).toEqual([FIRST_PROFILE, robin.id, sam.id, kim.id]);
    switchTo(sam.id);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(2);
  });

  it('is worked out without the first profile when nothing of its is left', () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('exchange', 2), 2000);
    store.set('pressure-point-profiles', JSON.stringify({ profiles: 'broken' }));
    newPage();
    expect(loadProfiles()).toEqual({ profiles: [{ id: sam.id, name: 'Player 1' }], current: sam.id });
    expect(currentProfile()).toBe(sam.id);
  });
});

describe('a profile deleted in another tab', () => {
  it('is no longer saved to by a tab still playing it, which hears of it as that and not as a shared game', () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('willow', 1), 1000);
    const autosaveKey = `profile:${sam.id}:pressure-point-save-v1`;
    expect(profileGone()).toBe(false);
    expect(storageChange(autosaveKey, '{}')).toBe('shared');
    expect(storageChange(autosaveKey, null)).toBeNull();
    expect(storageChange('pressure-point-save-v1', '{}')).toBeNull();
    deletedElsewhere(sam.id);
    expect(profileGone()).toBe(true);
    expect(storageChange('pressure-point-profiles', store.get('pressure-point-profiles')!)).toBe('deleted');
    expect(storageChange(autosaveKey, null)).toBe('deleted');
    expect(writeSave(at('willow', 2), 'Mine', undefined, 2000)).toBe('gone');
    expect(autosave(at('willow', 3), 3000)).toBe(false);
    storeThumb(AUTOSAVE_ID, 'data:image/jpeg;base64,AAAA');
    recordGame({ ...at('willow', 1), stars: 3 });
    expect(saveTemplates([template('A')])).toBe(false);
    expect(keysOf(sam.id)).toEqual([]);
  });

  it('has whatever was still written for it swept away as a page next opens, and nothing else', () => {
    const sam = made(addProfile('Sam'));
    const robin = made(addProfile('Robin'));
    autosave(at('willow', 1), 1000);
    switchTo(robin.id);
    autosave(at('willow', 2), 2000);
    store.set(`ph_pressure-point-${robin.id}`, '{}');
    deletedElsewhere(sam.id);
    // as an older version in a tab still playing Sam, or its play statistics, could write
    store.set(`profile:${sam.id}:pressure-point-save-v1`, '{}');
    store.set(`profile:${sam.id}:pressure-point-thumb:auto`, 'data:image/jpeg;base64,AAAA');
    store.set(`ph_pressure-point-${sam.id}`, '{}');
    const kept = [...store.keys()].filter((k) => !ownedBy(sam.id, k)).sort();
    newPage();
    sweepProfiles();
    expect([...store.keys()].sort()).toEqual(kept);
    expect(keysOf(robin.id)).not.toEqual([]);
  });

  it('has the keys from before profiles swept when it is the first, never the computer’s', () => {
    seedOldStorage();
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('willow', 5), 5000);
    deletedElsewhere(FIRST_PROFILE);
    // a tab still playing Player 1 saves after all
    store.set('pressure-point-save-v1', '{}');
    store.set('pressure-point-thumb:auto', 'data:image/jpeg;base64,AAAA');
    const kept = [...store.keys()].filter((k) => !ownedBy(FIRST_PROFILE, k)).sort();
    expect(kept).toEqual(expect.arrayContaining(['pressure-point-display', 'pressure-point-audio']));
    newPage();
    sweepProfiles();
    expect([...store.keys()].sort()).toEqual(kept);
  });

  it('is never swept for when the list is missing or will not read, as nothing says which profiles there are', () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('willow', 1), 1000);
    for (const list of [null, '{not json', JSON.stringify({ profiles: [] })]) {
      if (list === null) store.delete('pressure-point-profiles');
      else store.set('pressure-point-profiles', list);
      const before = snapshot();
      newPage();
      sweepProfiles();
      expect(store).toEqual(before);
    }
  });
});

describe('the desktop app’s copies', () => {
  /** Copies kept in memory as the desktop app keeps them in files: a folder for each profile, and the list. */
  const fakeBackup = () => {
    const folders = new Map<string, { index: string | null; saves: Record<string, string> }>();
    /** A profile's folder, made the first time it is written to. */
    const folder = (profile?: string) => {
      const name = profile ?? 'saved-games';
      if (!folders.has(name)) folders.set(name, { index: null, saves: {} });
      return folders.get(name)!;
    };
    const b = {
      folders,
      profiles: null as string | null,
      /** Keep a copy of a save and the list. */
      backupSave(id: string, text: string, index: string, profile?: string) {
        folder(profile).saves[id] = text;
        folder(profile).index = index;
      },
      /** Forget a save's copy, keeping the list. */
      dropBackup(id: string, index: string, profile?: string) {
        const f = folder(profile);
        f.saves = Object.fromEntries(Object.entries(f.saves).filter(([key]) => key !== id));
        f.index = index;
      },
      /** Everything kept for a profile, and the list of profiles. */
      readBackup: (profile?: string): Promise<SaveCopy> =>
        Promise.resolve(
          structuredClone({
            ...(folders.get(profile ?? 'saved-games') ?? { index: null, saves: {} }),
            profiles: b.profiles,
          }),
        ),
      /** Keep a copy of the list of profiles. */
      backupProfiles(text: string) {
        b.profiles = text;
      },
      /** Forget a profile's copies, the first's named as 'first'. */
      dropProfileBackup(profile: string) {
        folders.delete(profile === FIRST_PROFILE ? 'saved-games' : profile);
      },
    };
    return b;
  };

  it("keep each profile's saves apart, the first's where they always were, and the list of profiles", async () => {
    const b = fakeBackup();
    await startBackup(b);
    autosave(at('willow', 111), 1000);
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('exchange', 222), 2000);
    expect([...b.folders.keys()]).toEqual(['saved-games', sam.id]);
    expect(JSON.parse(b.folders.get(sam.id)!.saves[AUTOSAVE_ID]!)).toMatchObject({ money: 222 });
    expect(JSON.parse(b.folders.get('saved-games')!.saves[AUTOSAVE_ID]!)).toMatchObject({ money: 111 });
    expect(JSON.parse(b.profiles!)).toEqual(loadProfiles());
    deleteProfile(sam.id);
    expect([...b.folders.keys()]).toEqual(['saved-games']);
    expect(JSON.parse(b.profiles!).profiles).toHaveLength(1);
  });

  it('put every profile back, with its saves, when the page’s storage has lost everything', async () => {
    const b = fakeBackup();
    await startBackup(b);
    autosave(at('willow', 111), 1000);
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('exchange', 222), 2000);
    ok(writeSave(at('sandbox', 333), 'Theirs', undefined, 2500));
    // as if the player cleared the app's data
    store.clear();
    newPage();
    // Sam was played last, so the page is loaded again for Sam, who it plays from then on
    expect(await startBackup(b)).toBe(true);
    expect(loadProfiles().profiles.map((p) => p.name)).toEqual(['Player 1', 'Sam']);
    expect(currentProfile()).toBe(sam.id);
    expect(tab.get('pressure-point-profile')).toBe(sam.id);
    expect(listSaves().map((i) => i.name)).toEqual(['Theirs', 'Autosave']);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(222);
    switchTo(FIRST_PROFILE);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(111);
  });

  it('open on the profile this tab was playing after a wipe, if the copies have it', async () => {
    const b = fakeBackup();
    await startBackup(b);
    const sam = made(addProfile('Sam'));
    const robin = made(addProfile('Robin'));
    switchTo(sam.id);
    // another window went on to Robin
    b.profiles = JSON.stringify({ ...loadProfiles(), current: robin.id });
    // the page's storage is lost, but the tab still says it was playing Sam
    store.clear();
    forgetProfile();
    expect(await startBackup(b)).toBe(true);
    expect(currentProfile()).toBe(sam.id);
    expect(tab.get('pressure-point-profile')).toBe(sam.id);
  });

  it('open on a profile there is after a wipe, when the first had been deleted', async () => {
    const b = fakeBackup();
    await startBackup(b);
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('exchange', 222), 2000);
    expect(deleteProfile(FIRST_PROFILE)).toBe(true);
    store.clear();
    newPage();
    expect(await startBackup(b)).toBe(true);
    expect(loadProfiles().profiles).toEqual([sam]);
    expect(currentProfile()).toBe(sam.id);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(222);
  });

  it('leave the page on its profile when nothing is put back', async () => {
    const b = fakeBackup();
    expect(await startBackup(b)).toBe(false);
    made(addProfile('Sam'));
    newPage();
    expect(await startBackup(b)).toBe(false);
    expect(currentProfile()).toBe(FIRST_PROFILE);
  });

  it('copy the list of profiles the first time, when the copies have none', async () => {
    const sam = made(addProfile('Sam'));
    const b = fakeBackup();
    await startBackup(b);
    expect(JSON.parse(b.profiles!).profiles).toEqual([{ id: FIRST_PROFILE, name: FIRST_NAME }, sam]);
  });

  it('copy the list of profiles from then on, even when the copies will not read', async () => {
    const sam = made(addProfile('Sam'));
    const b = fakeBackup();
    /** Copies that will not read, as a damaged folder gives. */
    b.readBackup = () => Promise.reject(new Error('unreadable'));
    expect(await startBackup(b)).toBe(false);
    expect(JSON.parse(b.profiles!).profiles).toEqual([{ id: FIRST_PROFILE, name: FIRST_NAME }, sam]);
    const robin = made(addProfile('Robin'));
    expect(JSON.parse(b.profiles!).profiles).toContainEqual(robin);
  });

  it('put back the list of profiles over one the page has that will not read', async () => {
    const b = fakeBackup();
    await startBackup(b);
    autosave(at('willow', 111), 1000);
    const sam = made(addProfile('Sam'));
    store.set('pressure-point-profiles', '{not json');
    newPage();
    expect(await startBackup(b)).toBe(false);
    expect(loadProfiles().profiles).toEqual([{ id: FIRST_PROFILE, name: FIRST_NAME }, sam]);
    expect(readSave(AUTOSAVE_ID)!.money).toBe(111);
  });

  it('never copy a list that will not read over a good copy, and replace a copy that will not read', async () => {
    const b = fakeBackup();
    made(addProfile('Sam'));
    await startBackup(b);
    const good = b.profiles;
    store.set('pressure-point-profiles', '{not json');
    newPage();
    await startBackup(b);
    expect(b.profiles).toBe(good);
    // with no copy at all, a list that will not read is not copied either
    b.profiles = null;
    store.set('pressure-point-profiles', '{not json');
    newPage();
    await startBackup(b);
    expect(b.profiles).toBeNull();
    // and a copy that will not read gives way to the page's good list
    store.set('pressure-point-profiles', good!);
    b.profiles = '{broken';
    newPage();
    await startBackup(b);
    expect(b.profiles).toBe(good);
  });

  it('put back no profiles over a list the page still has', async () => {
    const b = fakeBackup();
    await startBackup(b);
    made(addProfile('Sam'));
    const kept = store.get('pressure-point-profiles');
    b.profiles = JSON.stringify({ profiles: [{ id: 'zzzzzzzz', name: 'Stranger' }], current: 'zzzzzzzz' });
    newPage();
    await startBackup(b);
    expect(store.get('pressure-point-profiles')).toBe(kept);
  });
});

describe('the profiles list', () => {
  it('says what a profile has from its own storage, and what deleting it loses', () => {
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('willow', 1), 1000);
    ok(writeSave(at('willow', 2), 'Named', undefined, 2000));
    recordGame({ ...at('willow', 1), stars: 3, achieved: ['called-in'] } as never);
    buyWithKarma('bonsai');
    saveTemplates([template('A'), template('B')]);
    switchTo(FIRST_PROFILE);
    const theirs = contentsOf(sam.id);
    expect(theirs).toEqual({ saves: 2, stars: 3, achievements: 1, unlocks: 1, templates: 2 });
    expect(profileFacts(theirs)).toBe('2 saved games · 3 ★');
    expect(deleteWarning(theirs)).toBe(
      'This deletes its 2 saved games, 3 campaign stars, 1 achievement, 1 karma unlock and 2 room templates, and its settings. It cannot be undone.',
    );
    const mine = contentsOf(FIRST_PROFILE);
    expect(profileFacts(mine)).toBe('No saved games');
    expect(deleteWarning(mine)).toBe('It has no saved games or campaign progress yet, so only its settings go.');
    expect(deleteWarning({ ...mine, saves: 1 })).toBe(
      'This deletes its 1 saved game, and its settings. It cannot be undone.',
    );
  });

  it('says where to make room when storage is full, other profiles’ games among what fills it', () => {
    expect(makeRoom({ mine: true, others: false })).toBe('Delete or export a saved game under Load game');
    expect(makeRoom({ mine: true, others: true })).toBe(
      'Delete or export a saved game under Load game, in this profile or another',
    );
    expect(makeRoom({ mine: false, others: true })).toBe(
      'Other profiles’ games are using the space: switch to one and delete or export a game under Load game',
    );
    const sam = made(addProfile('Sam'));
    switchTo(sam.id);
    autosave(at('willow', 1), 1000);
    switchTo(FIRST_PROFILE);
    expect(whoseSaves()).toEqual({ mine: false, others: true });
    expect(refusalNote('storage', 'Kim')).toBe(
      'Could not keep the change: the browser’s storage is full. Other profiles’ games are using the space: switch to one and delete or export a game under Load game.',
    );
  });

  it('says why a name will not do', () => {
    expect(refusalNote('taken', 'Sam')).toBe('There is a profile called Sam already.');
    expect(refusalNote('full', 'Sam')).toBe(`There is room for ${MAX_PROFILES} profiles. Delete one to add another.`);
    expect(refusalNote('empty', '')).toBe('Type a name for the profile.');
  });
});
