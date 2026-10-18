// A copy of every saved game in files, beside the window settings. The game keeps its saves in the page's storage,
// which a player loses by clearing the app's data or with a damaged profile; from these files the game puts them back.
//
// The page asks for these through the preload script, so nothing it sends is trusted: a save id has to look like one
// of the game's own before it names a file, and the folder only ever holds so many files of so much text.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { SaveCopy } from './api';

/** What a save id may be: the game's own are letters, digits and dashes, so none can reach outside the folder. */
const SAVE_ID = /^[a-z0-9-]{1,64}$/;
/** A save's file, and the id back from one. */
const saveFile = (id: string) => `save-${id}.json`;
const SAVE_FILE = /^save-([a-z0-9-]{1,64})\.json$/;
/** The list of saves, with each one's name and headline figures. */
const INDEX_FILE = 'index.json';
/** No more saves than this are kept: the game has twenty of its own, the autosave and the previous game. */
const MAX_SAVES = 40;
/** Nor any text longer than the page's own storage could hold. */
const MAX_LENGTH = 10 * 1024 * 1024;

/** Whether a value is a save id the game could have made. */
const isSaveId = (id: unknown): id is string => typeof id === 'string' && SAVE_ID.test(id);
/** Whether a value is text short enough to keep. */
const isText = (text: unknown): text is string => typeof text === 'string' && text.length <= MAX_LENGTH;

/** Write a file whole or not at all: to a file of its own first, then moved over the old one in one step. */
function writeWhole(dir: string, name: string, text: string) {
  mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `${name}.tmp`);
  writeFileSync(temp, text);
  renameSync(temp, path.join(dir, name));
}

/** How many saves have a copy. */
const savesKept = (dir: string) => readdirSync(dir).filter((name) => SAVE_FILE.test(name)).length;

/**
 * Keep a copy of a saved game and of the list of saves. Written straight away rather than in the background, so the
 * app quitting just after a save, as Exit game does, cannot lose the copy.
 */
export function backupSave(dir: string, id: unknown, text: unknown, index: unknown) {
  if (!isSaveId(id) || !isText(text) || !isText(index)) return;
  try {
    const file = saveFile(id);
    if (!existsSync(path.join(dir, file)) && existsSync(dir) && savesKept(dir) >= MAX_SAVES) return;
    writeWhole(dir, file, text);
    writeWhole(dir, INDEX_FILE, index);
  } catch (err) {
    // the save itself is in the page's storage
    console.warn('Could not keep a copy of a saved game:', err);
  }
}

/** Delete the copy of a deleted save, and keep the list of saves as it now stands. */
export function dropBackup(dir: string, id: unknown, index: unknown) {
  if (!isSaveId(id) || !isText(index)) return;
  try {
    rmSync(path.join(dir, saveFile(id)), { force: true });
    writeWhole(dir, INDEX_FILE, index);
  } catch (err) {
    console.warn('Could not delete the copy of a saved game:', err);
  }
}

/** Every copy kept: the list, if there is one, and each save's text by id. Files that will not read are left out. */
export function readBackup(dir: string): SaveCopy {
  const out: SaveCopy = { index: null, saves: {} };
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const id = SAVE_FILE.exec(name)?.[1];
    if (!id && name !== INDEX_FILE) continue;
    try {
      const text = readFileSync(path.join(dir, name), 'utf8');
      if (id) out.saves[id] = text;
      else out.index = text;
    } catch {
      // one unreadable file does not stop the rest coming back
    }
  }
  return out;
}
