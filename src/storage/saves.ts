// Saved games: a rolling autosave plus named slots.
//
// Everything lives in localStorage, which both the browser and the desktop app
// have. Saves can also be exported to a file and imported again, for backups
// and for moving a game between the browser and the app. The desktop app also
// keeps a copy of every save in files of its own, which come back should its
// localStorage lose them (see `startBackup`).
import { captureException, logger } from '@sentry/browser';

import type { DesktopApi, SaveCopy } from '../../electron/api';
import { type CenterId, CENTERS, CONDITIONS, DAYS_PER_MONTH, ITEMS, MODALITIES, ROLES, ROOMS } from '../core/data';
import { SAVE_VERSION } from '../core/state/game';
import type { GameState } from '../core/state/types';
import { upgradeSave } from '../core/state/upgrade';
import { isRecord } from './json';
import { copyThumb, dropThumb } from './thumbnails';

export const AUTOSAVE_ID = 'auto';
/** Where the game being replaced by a new one is kept, so starting over never destroys anything. */
export const PREVIOUS_ID = 'previous';
export const MAX_SAVES = 20;
/** Marks a file as one of ours. */
const FILE_FORMAT = 'pressure-point-save';

// the autosave keeps the key of the original single save, so games from before save slots carry over
const AUTOSAVE_KEY = 'pressure-point-save-v1';
const INDEX_KEY = 'pressure-point-saves';
/** Where an autosave that will not open is set aside when a new game starts, followed by when, for a later version. */
const UNREADABLE_KEY = 'pressure-point-save-unreadable';

/** Whether a storage key is the autosave's, as another tab or window writing it reports. */
export function isAutosaveKey(key: string | null): boolean {
  return key === AUTOSAVE_KEY;
}

/** The storage key a save's data is kept under. */
const slotKey = (id: string) => (id === AUTOSAVE_ID ? AUTOSAVE_KEY : `pressure-point-save:${id}`);

export interface SaveInfo {
  id: string;
  name: string;
  /** Milliseconds since the epoch; 0 when unknown. */
  savedAt: number;
  day: number;
  money: number;
  stars: number;
  healed: number;
  /** The center the game is set in; absent in entries written before there were centers, which were sandbox games. */
  center?: CenterId;
}

export type SaveError = 'invalid' | 'full';

/** "Day 12, Month 3, Year 1" for a count of elapsed game days. */
export function gameDate(day: number): string {
  const d = Math.floor(day);
  return `Day ${(d % DAYS_PER_MONTH) + 1}, Month ${(Math.floor(d / DAYS_PER_MONTH) % 12) + 1}, Year ${Math.floor(d / (DAYS_PER_MONTH * 12)) + 1}`;
}
/** The name a save gets when the player gives none: the game date. */
export const defaultSaveName = (s: GameState) => gameDate(s.day);

/** The list entry for a save: its name, time and headline figures. */
function summarize(id: string, name: string, s: GameState, savedAt: number): SaveInfo {
  return {
    id,
    name,
    savedAt,
    day: s.day,
    money: Math.round(s.money),
    stars: s.stars,
    healed: s.stats.healed,
    center: s.center,
  };
}

const CONDITION_IDS = new Set<unknown>(CONDITIONS.map((c) => c.id));

/** A test for whether a value names an entry in one of the content tables. */
const keyOf = (table: object) => (id: unknown) => typeof id === 'string' && Object.hasOwn(table, id);
const knownRoom = keyOf(ROOMS);
const knownItem = keyOf(ITEMS);
const knownRole = keyOf(ROLES);
const knownModality = keyOf(MODALITIES);
const knownCenter = keyOf(CENTERS);
/** Whether a value is a finite number. */
const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** Whether a value is a list whose every entry is a record that passes a test. */
const listOf = (list: unknown, ok: (x: Record<string, unknown>) => boolean) =>
  Array.isArray(list) && list.every((x) => isRecord(x) && ok(x));
/** Whether someone's role and qualifications, if they have any yet, are all ones this version knows. */
const knownPerson = (p: Record<string, unknown>) =>
  knownRole(p.role) && (p.quals === undefined || (Array.isArray(p.quals) && p.quals.every(knownModality)));

/**
 * Whether parsed JSON is a game this version can open: the right shape, its headline figures in range,
 * and nothing in it (rooms, items, staff, treatments, conditions) that this version has never heard of,
 * as a save from a newer version may have.
 */
function isGame(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (!isNumber(value.version) || value.version > SAVE_VERSION) return false;
  if (!isNumber(value.money) || !isNumber(value.day) || !isRecord(value.stats) || !isNumber(value.stats.healed))
    return false;
  const stars = value.stars;
  // a save from before the campaign has no center, and is a sandbox game
  const center = value.center ?? 'sandbox';
  if (!knownCenter(center)) return false;
  const goals = CENTERS[center as keyof typeof CENTERS].goals;
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 0 || stars > goals.length) return false;
  return (
    listOf(value.rooms, (r) => knownRoom(r.type)) &&
    listOf(value.items, (i) => knownItem(i.type)) &&
    listOf(value.staff, knownPerson) &&
    listOf(value.candidates, knownPerson) &&
    listOf(value.guests, (g) => CONDITION_IDS.has(g.condition))
  );
}

/** Turn stored text back into a game, or null if it is not one we can load. Hands any error it hit to `onError`. */
function parseState(raw: string | null, onError?: (err: unknown) => void): GameState | null {
  if (!raw) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!isGame(s)) return null;
    upgradeSave(s);
    return s;
  } catch (err) {
    onError?.(err);
    return null;
  }
}

/** A stored list of saves, dropping any malformed entries. */
function parseIndex(raw: string | null): SaveInfo[] {
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(list) ? list.filter((i): i is SaveInfo => isRecord(i) && typeof i.id === 'string') : [];
  } catch {
    return [];
  }
}
/** The stored list of saves, dropping any malformed entries. */
function readIndex(): SaveInfo[] {
  return parseIndex(localStorage.getItem(INDEX_KEY));
}

/** The keys in storage, found without reading what is stored under them, which for a save is the whole game. */
function storedKeys(): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) keys.add(key);
  }
  return keys;
}

/** The entries whose data is still there, forgetting any that has gone missing. */
function liveEntries(list: SaveInfo[]): SaveInfo[] {
  const keys = storedKeys();
  return list.filter((i) => keys.has(slotKey(i.id)));
}

/** Every saved game, newest first. */
export function listSaves(): SaveInfo[] {
  let list: SaveInfo[];
  try {
    list = liveEntries(readIndex());
    // an autosave from before save slots existed has no entry yet
    if (!list.some((i) => i.id === AUTOSAVE_ID)) {
      const legacy = parseState(localStorage.getItem(AUTOSAVE_KEY));
      if (legacy) list.push(summarize(AUTOSAVE_ID, 'Autosave', legacy, 0));
    }
  } catch {
    return [];
  }
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

/** The most recently saved game, if any. */
export function latestSave(): SaveInfo | null {
  return listSaves()[0] ?? null;
}

/** Load a saved game by id, or null if it is missing or unreadable. */
export function readSave(id: string): GameState | null {
  try {
    const raw = localStorage.getItem(slotKey(id));
    let error: unknown;
    const state = parseState(raw, (err) => {
      error = err;
    });
    if (raw && !state) reportUnreadable(id, raw, error);
    return state;
  } catch {
    return null;
  }
}

/** What kind of slot a save is in, for logs: a manual save's id says nothing useful. */
const slotKind = (id: string) => (id === AUTOSAVE_ID || id === PREVIOUS_ID ? id : 'manual');

/** The saves already reported as unreadable, since the game reads a save several times. */
const reported = new Set<string>();

/**
 * Report a save that is there but will not open: a game the player has lost. An error means damaged text or a bug
 * in bringing an older save up to date; without one, it is not a game this version knows.
 */
function reportUnreadable(id: string, raw: string, error: unknown) {
  if (reported.has(id)) return;
  reported.add(id);
  const slot = slotKind(id);
  if (error) captureException(error, { tags: { slot } });
  else logger.warn('A saved game could not be opened', { slot, length: raw.length });
}

/**
 * Store a game. With no id it goes into a new slot; with one it overwrites that slot.
 * Returns the slot's details, or why it could not be saved.
 *
 * The list goes first and the game second. A game is far bigger than its entry, so it is what runs out of room; when
 * it does, storage still holds the old game, and the old list is put back beside it. Either way a slot and its entry
 * agree: both as they were, or both new.
 */
export function writeSave(s: GameState, name: string, id?: string, now = Date.now()): SaveInfo | SaveError {
  let before: string | null;
  let index: SaveInfo[];
  try {
    before = localStorage.getItem(INDEX_KEY);
    index = liveEntries(parseIndex(before));
  } catch {
    return 'full';
  }
  const manual = index.filter((i) => i.id !== AUTOSAVE_ID && i.id !== PREVIOUS_ID);
  if (!id && manual.length >= MAX_SAVES) return 'full';
  const slot = id ?? `${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const info = summarize(slot, name.trim().slice(0, 60) || defaultSaveName(s), s, now);
  let text: string;
  let list: string;
  try {
    text = JSON.stringify(s);
    list = JSON.stringify([...index.filter((i) => i.id !== slot), info]);
    localStorage.setItem(INDEX_KEY, list);
    try {
      localStorage.setItem(slotKey(slot), text);
    } catch (err) {
      putBack(INDEX_KEY, before);
      throw err;
    }
  } catch (err) {
    logger.warn('A game could not be saved', {
      slot: slotKind(slot),
      error: err instanceof Error ? err.name : String(err),
    });
    return 'full';
  }
  tellBackup((b) => {
    b.backupSave(slot, text, list);
  });
  return info;
}

/**
 * Put a stored value back as it was, ignoring any failure. Should putting the list back fail too, a new slot's entry
 * names a game that is not there, which `liveEntries` forgets; an overwritten slot keeps its old game under the new
 * entry, which is only its name and headline figures.
 */
function putBack(key: string, raw: string | null) {
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    // nothing more to do
  }
}
/** Remove a stored value, ignoring any failure. */
function removeQuietly(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing more to do
  }
}

/** The rolling save the game makes by itself. */
export function autosave(s: GameState, now = Date.now()): boolean {
  return typeof writeSave(s, 'Autosave', AUTOSAVE_ID, now) !== 'string';
}

/** Delete a save and its list entry. */
export function deleteSave(id: string) {
  removeQuietly(slotKey(id));
  dropThumb(id);
  let list: string;
  try {
    list = JSON.stringify(readIndex().filter((i) => i.id !== id));
    localStorage.setItem(INDEX_KEY, list);
  } catch {
    // the entry has no game left, so the list forgets it anyway
    return;
  }
  tellBackup((b) => {
    b.dropBackup(id, list);
  });
}

/**
 * Called when a new game starts: the autosave of the game being left moves into
 * the single "Previous game" slot instead of being overwritten. False if there is no room to keep it, when the
 * new game must not start, or its first autosave would overwrite the old one.
 */
export function archiveAutosave(now = Date.now()): boolean {
  const old = readSave(AUTOSAVE_ID);
  if (!old) return keepUnreadable(now);
  if (typeof writeSave(old, `Previous game (${gameDate(old.day)})`, PREVIOUS_ID, now) === 'string') return false;
  copyThumb(AUTOSAVE_ID, PREVIOUS_ID);
  deleteSave(AUTOSAVE_ID);
  return true;
}

/**
 * Set aside an autosave that is there but will not open, such as one from a later version, so the new game's first
 * autosave does not write over it and a later version can still open it. False if there is no room to keep it.
 */
function keepUnreadable(now: number): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return true;
  }
  if (!raw) return true;
  try {
    localStorage.setItem(`${UNREADABLE_KEY}:${now}`, raw);
  } catch {
    return false;
  }
  deleteSave(AUTOSAVE_ID);
  return true;
}

/** A save as the text of a file, ready to download. */
export function exportSave(id: string): { filename: string; text: string } | null {
  const state = readSave(id);
  const info = listSaves().find((i) => i.id === id);
  if (!state || !info) return null;
  const safe =
    info.name
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'save';
  return {
    filename: `pressure-point-${safe}.json`,
    text: JSON.stringify({ format: FILE_FORMAT, name: info.name, savedAt: info.savedAt, state }),
  };
}

/** Add a game from the text of an exported file as a new slot. */
export function importSave(text: string, now = Date.now()): SaveInfo | SaveError {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return 'invalid';
  }
  if (!isRecord(file) || file.format !== FILE_FORMAT) return 'invalid';
  const state = parseState(JSON.stringify(file.state ?? null));
  if (!state) return 'invalid';
  const name = typeof file.name === 'string' && file.name.trim() ? file.name : defaultSaveName(state);
  return writeSave(state, name === 'Autosave' ? `Imported (${gameDate(state.day)})` : name, undefined, now);
}

/** Somewhere outside localStorage that keeps a copy of every save: the desktop app, in files. */
export type SaveBackup = Pick<DesktopApi, 'backupSave' | 'dropBackup' | 'readBackup'>;

let backup: SaveBackup | undefined;

/** Hand the backup a change, if there is one. A backup that fails never stops the game saving. */
function tellBackup(change: (b: SaveBackup) => void) {
  if (!backup) return;
  try {
    change(backup);
  } catch {
    // the save itself is in localStorage
  }
}

/** What a save's id may be: the ids this file makes are letters, digits and dashes. */
const SAVE_ID = /^[a-z0-9-]{1,64}$/;

/**
 * Keep a copy of every save in a backup from now on. Should localStorage have lost every save (its data cleared,
 * or a damaged profile), the copies are put back first. With no copies yet, as on the first run of a version that
 * keeps them, the saves already in localStorage are copied.
 */
export async function startBackup(b: SaveBackup): Promise<void> {
  backup = b;
  let copy: SaveCopy;
  try {
    copy = await b.readBackup();
  } catch {
    return;
  }
  let keys: Set<string>;
  try {
    keys = storedKeys();
  } catch {
    return;
  }
  if (!keys.has(INDEX_KEY) && !keys.has(AUTOSAVE_KEY)) restore(copy);
  else if (copy.index === null) copyAll();
}

/** Put the backup's saves into an empty localStorage. */
function restore(copy: SaveCopy) {
  if (copy.index === null) return;
  const saves = Object.entries(copy.saves).filter(([id, text]) => SAVE_ID.test(id) && typeof text === 'string');
  try {
    for (const [id, text] of saves) localStorage.setItem(slotKey(id), text);
    localStorage.setItem(INDEX_KEY, copy.index);
  } catch (err) {
    logger.warn('Saved games could not be restored from the backup', {
      error: err instanceof Error ? err.name : String(err),
    });
    return;
  }
  logger.info('Saved games restored from the backup', { saves: saves.length });
}

/** Copy every save in localStorage to the backup. */
function copyAll() {
  const list = listSaves();
  const index = JSON.stringify(list);
  for (const { id } of list) {
    let text: string | null;
    try {
      text = localStorage.getItem(slotKey(id));
    } catch {
      return;
    }
    if (text) {
      tellBackup((b) => {
        b.backupSave(id, text, index);
      });
    }
  }
}

/** "just now", "5 minutes ago", "yesterday"... for the save list. */
export function timeAgo(then: number, now = Date.now()): string {
  if (!then) return 'earlier';
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(then).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
