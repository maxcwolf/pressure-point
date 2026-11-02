// Profiles: two or more people playing on one computer, each with saved games, campaign progress and settings of
// their own. A profile keeps its own copy of every key in `PROFILE_KEYS` and `PROFILE_PREFIXES`; the rest (the display,
// the sound, dev mode and whether play statistics are shared) are kept for the computer.
//
// The first profile keeps the keys the game has always used, so everything played on a computer before there were
// profiles is its own with nothing moved, and an older version opened again still finds it. Every other profile keeps
// the same keys after `profile:<id>:`. Until a profile is added or renamed nothing about profiles is stored: with no
// list, there is one profile, the first, called "Player 1".
//
// The profile a page plays is read once and kept, so a game goes on saving to its own profile whatever another tab or
// window switches to. Switching reloads the page, which reads it again.
import type { DesktopApi } from '../../electron/api';
import { isRecord } from './json';

export interface Profile {
  id: string;
  name: string;
}

/** The profiles on this computer, and the one played last. */
export interface ProfileList {
  profiles: Profile[];
  current: string;
}

/** Why a profile could not be added or renamed: no name, a name another has, no room for more, or storage failing. */
export type ProfileRefusal = 'empty' | 'taken' | 'full' | 'storage';

/** The first profile's id: the one that keeps the keys from before there were profiles. */
export const FIRST_PROFILE = 'first';
/** What the first profile is called until it is renamed: nothing personal, since it is made for whoever played before. */
export const FIRST_NAME = 'Player 1';
/** No more profiles than this on one computer. */
export const MAX_PROFILES = 8;
/** No profile's name longer than this. */
export const MAX_NAME = 24;

const KEY = 'pressure-point-profiles';
/** The profile this tab plays, so leaving a game, which reloads the page, comes back to it whatever another tab chose. */
const TAB_KEY = 'pressure-point-profile';
/** What a profile's id may be: the ids `addProfile` makes are eight letters and digits, and the first's is 'first'. */
const PROFILE_ID = /^[a-z0-9]{1,16}$/;

/** The keys each profile keeps for itself: its saves' list and autosave, campaign, templates and settings. */
export const PROFILE_KEYS: readonly string[] = [
  'pressure-point-save-v1',
  'pressure-point-saves',
  'pressure-point-campaign',
  'pressure-point-room-templates',
  'pressure-point-welcomed',
  'pressure-point-tutorial',
  'pressure-point-controls',
  'pressure-point-settings',
  'pressure-point-features',
  'pressure-point-sandbox',
  'pressure-point-stats-view',
];
/** The beginnings of the keys each profile keeps one of for every save: the save, its picture, an autosave set aside. */
export const PROFILE_PREFIXES: readonly string[] = [
  'pressure-point-save:',
  'pressure-point-thumb:',
  'pressure-point-save-unreadable:',
];

/** Whether a value is an id a profile could have. */
const isProfileId = (id: unknown): id is string => typeof id === 'string' && PROFILE_ID.test(id);

/** A name as typed, with its spaces tidied and cut to length. */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim();

/** The first profile alone, as a computer with nothing stored about profiles has. */
const firstAlone = (): ProfileList => ({
  profiles: [{ id: FIRST_PROFILE, name: FIRST_NAME }],
  current: FIRST_PROFILE,
});

/** A list of profiles read back from storage, dropping anything malformed, or the first alone if nothing is left. */
export function readProfiles(raw: unknown): ProfileList {
  if (!isRecord(raw) || !Array.isArray(raw.profiles)) return firstAlone();
  const profiles: Profile[] = [];
  for (const p of raw.profiles as unknown[]) {
    if (!isRecord(p) || !isProfileId(p.id) || profiles.some((q) => q.id === p.id)) continue;
    const name = typeof p.name === 'string' ? cleanName(p.name) : '';
    profiles.push({ id: p.id, name: name || `Player ${profiles.length + 1}` });
  }
  const first = profiles[0];
  if (!first) return firstAlone();
  const current = profiles.find((p) => p.id === raw.current)?.id ?? first.id;
  return { profiles, current };
}

/** The profiles on this computer. */
export function loadProfiles(): ProfileList {
  try {
    return readProfiles(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return firstAlone();
  }
}

/** Store the list of profiles, with a copy for the desktop app. False if storage would not take it. */
function storeProfiles(list: ProfileList): boolean {
  const text = JSON.stringify(list);
  try {
    localStorage.setItem(KEY, text);
  } catch {
    return false;
  }
  tellBackup((b) => {
    b.backupProfiles(text);
  });
  return true;
}

/** The profile this page plays, once read. */
let current: string | null = null;

/** The profile this tab was playing before the page was reloaded, if it says. */
function tabProfile(): string | null {
  try {
    return sessionStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

/** Note the profile this tab plays, for the page that loads after it. */
function pinTab(id: string) {
  try {
    sessionStorage.setItem(TAB_KEY, id);
  } catch {
    // without it, a reload comes back to the profile played last on this computer, as a new window does
  }
}

/** The id of the profile this page plays: this tab's before a reload, or else the one played last on this computer. */
export function currentProfile(): string {
  if (current !== null) return current;
  const list = loadProfiles();
  const pinned = tabProfile();
  current = list.profiles.find((p) => p.id === pinned)?.id ?? list.current;
  pinTab(current);
  return current;
}

/** The profile this page plays, with its name. */
export function currentProfileInfo(): Profile {
  const id = currentProfile();
  return loadProfiles().profiles.find((p) => p.id === id) ?? { id, name: FIRST_NAME };
}

/** The key a profile keeps something under: the key itself for the first profile, and after its prefix for the rest. */
export const scoped = (profile: string, key: string) => (profile === FIRST_PROFILE ? key : `profile:${profile}:${key}`);

/** The key this page's profile keeps something under. */
export const profileKey = (key: string) => scoped(currentProfile(), key);

/** The name PostHog keeps a profile's anonymous id under: '' for the first profile, which keeps the id it always had. */
export const statsName = (profile = currentProfile()) => (profile === FIRST_PROFILE ? '' : `pressure-point-${profile}`);

/**
 * The profile the desktop app's copies of a profile's saves are kept for: none for the first profile, whose copies are
 * where they always were, and its id for the rest.
 */
export const backupProfile = (profile = currentProfile()) => (profile === FIRST_PROFILE ? undefined : profile);

/** Whether a name is another profile's already, whatever its capitals. */
const nameTaken = (list: ProfileList, name: string, except = '') =>
  list.profiles.some((p) => p.id !== except && p.name.toLowerCase() === name.toLowerCase());

/** The name a new profile is given when none is typed: the first "Player N" no profile has. */
export function nextName(list = loadProfiles()): string {
  let n = list.profiles.length + 1;
  while (nameTaken(list, `Player ${n}`)) n++;
  return `Player ${n}`;
}

/** A new profile's id: eight letters and digits, so never the first's. */
const newId = (random: () => number) =>
  Array.from({ length: 8 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 36)]).join('');

/** Add a profile with nothing in it yet, under a name no other profile has. */
export function addProfile(name: string, random = Math.random): Profile | ProfileRefusal {
  const list = loadProfiles();
  const clean = cleanName(name);
  if (!clean) return 'empty';
  if (list.profiles.length >= MAX_PROFILES) return 'full';
  if (nameTaken(list, clean)) return 'taken';
  let id = newId(random);
  while (list.profiles.some((p) => p.id === id)) id = newId(random);
  // anything left under the id by a profile that was not wholly deleted is not this one's
  removeKeys(id);
  const profile = { id, name: clean };
  return storeProfiles({ ...list, profiles: [...list.profiles, profile] }) ? profile : 'storage';
}

/** Give a profile another name, one no other profile has. Null if there is no such profile. */
export function renameProfile(id: string, name: string): Profile | ProfileRefusal | null {
  const list = loadProfiles();
  if (!list.profiles.some((p) => p.id === id)) return null;
  const clean = cleanName(name);
  if (!clean) return 'empty';
  if (nameTaken(list, clean, id)) return 'taken';
  const profile = { id, name: clean };
  const profiles = list.profiles.map((p) => (p.id === id ? profile : p));
  return storeProfiles({ ...list, profiles }) ? profile : 'storage';
}

/**
 * Make a profile the one this page plays, and the one the game opens on next. The page has to be reloaded for it to
 * take, as everything read for the profile before is kept. False if there is no such profile.
 */
export function switchProfile(id: string): boolean {
  const list = loadProfiles();
  if (!list.profiles.some((p) => p.id === id)) return false;
  // with no room to note it for next time, the page still switches
  if (list.current !== id) storeProfiles({ ...list, current: id });
  current = id;
  pinTab(id);
  return true;
}

/**
 * Delete a profile and everything it keeps: its saves, campaign, templates and settings, and the desktop app's copies.
 * The last profile left cannot be. A profile deleted while played leaves the game on the first one left, after a
 * reload. False if it was not deleted.
 */
export function deleteProfile(id: string): boolean {
  const list = loadProfiles();
  const profiles = list.profiles.filter((p) => p.id !== id);
  const next = profiles[0];
  if (!next || profiles.length === list.profiles.length) return false;
  // the list goes first, so storage that will not take it leaves the profile whole
  if (!storeProfiles({ profiles, current: list.current === id ? next.id : list.current })) return false;
  removeKeys(id);
  tellBackup((b) => {
    b.dropProfileBackup(backupProfile(id));
  });
  if (current === id) {
    current = next.id;
    pinTab(next.id);
  }
  return true;
}

/** Whether a stored key is one a profile keeps for itself. */
export function ownedBy(profile: string, key: string): boolean {
  if (profile !== FIRST_PROFILE) return key.startsWith(`profile:${profile}:`) || key === `ph_${statsName(profile)}`;
  return PROFILE_KEYS.includes(key) || PROFILE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Remove everything a profile keeps for itself, ignoring any failure. */
function removeKeys(profile: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && ownedBy(profile, key)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // what is left behind belongs to no profile, so nothing reads it
  }
}

/** The desktop app, which keeps a copy of the list of profiles in a file and each one's saves in a folder. */
export type ProfileBackup = Pick<DesktopApi, 'backupProfiles' | 'dropProfileBackup'>;

let backup: ProfileBackup | undefined;

/** Hand the backup a change, if there is one. A backup that fails never stops the profiles changing. */
function tellBackup(change: (b: ProfileBackup) => void) {
  if (!backup) return;
  try {
    change(backup);
  } catch {
    // the profiles themselves are in localStorage
  }
}

/** Keep a copy of the list of profiles in the desktop app from now on, starting with the list as it is, if stored. */
export function backupProfiles(b: ProfileBackup, copied: boolean) {
  backup = b;
  if (copied) return;
  let text: string | null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (text !== null) {
    tellBackup((to) => {
      to.backupProfiles(text);
    });
  }
}

/**
 * Put back the list of profiles the desktop app kept, when the page's storage has lost its own, and read the profile
 * this page plays again from it. True if it did.
 */
export function restoreProfiles(text: string | null): boolean {
  if (text === null) return false;
  let list: ProfileList;
  try {
    if (localStorage.getItem(KEY) !== null) return false;
    list = readProfiles(JSON.parse(text));
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  current = null;
  return true;
}

/** Forget the profile read in, so the next look reads storage again. For tests. */
export function forgetProfile() {
  current = null;
}
