// Saved games: a rolling autosave plus named slots.
//
// Everything lives in localStorage, which both the browser and the desktop app
// have. Saves can also be exported to a file and imported again, for backups
// and for moving a game between the browser and the app.
import { DAYS_PER_MONTH } from '../core/data';
import { SAVE_VERSION } from '../core/state/game';
import type { GameState } from '../core/state/types';
import { upgradeSave } from '../core/state/upgrade';
import { isRecord } from './json';

export const AUTOSAVE_ID = 'auto';
/** Where the game being replaced by a new one is kept, so starting over never destroys anything. */
export const PREVIOUS_ID = 'previous';
export const MAX_SAVES = 20;
/** Marks a file as one of ours. */
const FILE_FORMAT = 'pressure-point-save';

// the autosave keeps the key of the original single save, so games from before save slots carry over
const AUTOSAVE_KEY = 'pressure-point-save-v1';
const INDEX_KEY = 'pressure-point-saves';
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
  return { id, name, savedAt, day: s.day, money: Math.round(s.money), stars: s.stars, healed: s.stats.healed };
}

/** Whether parsed JSON has the shape of a game this version can open. */
function isGame(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.rooms) || !Array.isArray(value.staff) || !Array.isArray(value.guests)) return false;
  return typeof value.version === 'number' && value.version <= SAVE_VERSION;
}

/** Turn stored text back into a game, or null if it is not one we can load. */
function parseState(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!isGame(s)) return null;
    upgradeSave(s);
    return s;
  } catch {
    return null;
  }
}

/** The stored list of saves, dropping any malformed entries. */
function readIndex(): SaveInfo[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((i): i is SaveInfo => isRecord(i) && typeof i.id === 'string') : [];
  } catch {
    return [];
  }
}
/** Store the list of saves. */
function writeIndex(list: SaveInfo[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

/** Every saved game, newest first. */
export function listSaves(): SaveInfo[] {
  let list: SaveInfo[];
  try {
    // forget entries whose data has gone missing
    list = readIndex().filter((i) => localStorage.getItem(slotKey(i.id)) !== null);
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
    return parseState(localStorage.getItem(slotKey(id)));
  } catch {
    return null;
  }
}

/**
 * Store a game. With no id it goes into a new slot; with one it overwrites that slot.
 * Returns the slot's details, or why it could not be saved.
 */
export function writeSave(s: GameState, name: string, id?: string, now = Date.now()): SaveInfo | SaveError {
  const index = readIndexSafe();
  const manual = index.filter((i) => i.id !== AUTOSAVE_ID && i.id !== PREVIOUS_ID);
  if (!id && manual.length >= MAX_SAVES) return 'full';
  const slot = id ?? `${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const info = summarize(slot, name.trim().slice(0, 60) || defaultSaveName(s), s, now);
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(s));
    writeIndex([...index.filter((i) => i.id !== slot), info]);
  } catch {
    // out of room: do not leave half a save behind
    if (!id) removeQuietly(slotKey(slot));
    return 'full';
  }
  return info;
}

/** The stored list of saves, or an empty one if storage cannot be read. */
function readIndexSafe(): SaveInfo[] {
  try {
    return readIndex();
  } catch {
    return [];
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
  try {
    writeIndex(readIndex().filter((i) => i.id !== id));
  } catch {
    // nothing more to do
  }
}

/**
 * Called when a new game starts: the autosave of the game being left moves into
 * the single "Previous game" slot instead of being overwritten.
 */
export function archiveAutosave(now = Date.now()) {
  const old = readSave(AUTOSAVE_ID);
  if (!old) return;
  if (typeof writeSave(old, `Previous game (${gameDate(old.day)})`, PREVIOUS_ID, now) !== 'string')
    deleteSave(AUTOSAVE_ID);
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
