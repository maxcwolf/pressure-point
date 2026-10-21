// A copy of every saved game in files, beside the window settings. The game keeps its saves in the page's storage,
// which a player loses by clearing the app's data or with a damaged profile; from these files the game puts them back.
//
// The page asks for these through the preload script, so nothing it sends is trusted: a save id has to look like one
// of the game's own before it names a file, and the folder only ever holds so many files of so much text.
//
// The files are written in the background, so an autosave never holds up the main process, but one after another in
// the order the game sent them. The app waits for the last of them before it quits: see backupsPending.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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

/**
 * Every change to the files, each started only once the one before it has finished. So two autosaves land in the
 * order they were made, and the count of saves kept is never read halfway through another change.
 */
let queue: Promise<void> = Promise.resolve();
/** How many changes are queued and not yet finished. */
let pending = 0;

/**
 * Queue a change behind the ones before it. It never fails: a change that will not write only leaves a warning, as the
 * save itself is in the page's storage.
 */
function enqueue(change: () => Promise<void>, warning: string) {
  pending++;
  queue = queue
    .then(change)
    .catch((err: unknown) => {
      console.warn(warning, err);
    })
    .finally(() => {
      pending--;
    });
}

/** Whether a change to the files is still waiting to be written, so quitting now could lose it. */
export const backupsPending = (): boolean => pending > 0;

/** Wait until every change queued so far has been written, or given up on. Never fails. */
export const backupsWritten = (): Promise<void> => queue;

/** The names of the files in the folder, or none if there is no folder yet. */
const filesIn = (dir: string): Promise<string[]> => readdir(dir).catch(() => []);

/** Write a file whole or not at all: to a file of its own first, then moved over the old one in one step. */
async function writeWhole(dir: string, name: string, text: string) {
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `${name}.tmp`);
  await writeFile(temp, text);
  await rename(temp, path.join(dir, name));
}

/**
 * Keep a copy of a saved game and of the list of saves. Written in the background, but the app does not quit until
 * it is done, so quitting just after a save, as Exit game does, cannot lose the copy.
 */
export function backupSave(dir: string, id: unknown, text: unknown, index: unknown) {
  if (!isSaveId(id) || !isText(text) || !isText(index)) return;
  enqueue(async () => {
    const file = saveFile(id);
    const names = await filesIn(dir);
    if (!names.includes(file) && names.filter((name) => SAVE_FILE.test(name)).length >= MAX_SAVES) return;
    await writeWhole(dir, file, text);
    await writeWhole(dir, INDEX_FILE, index);
  }, 'Could not keep a copy of a saved game:');
}

/** Delete the copy of a deleted save, and keep the list of saves as it now stands. */
export function dropBackup(dir: string, id: unknown, index: unknown) {
  if (!isSaveId(id) || !isText(index)) return;
  enqueue(async () => {
    await rm(path.join(dir, saveFile(id)), { force: true });
    await writeWhole(dir, INDEX_FILE, index);
  }, 'Could not delete the copy of a saved game:');
}

/**
 * Every copy kept: the list, if there is one, and each save's text by id. Read once the changes already queued are
 * written, so it never misses a save the game has just made. Files that will not read are left out.
 */
export async function readBackup(dir: string): Promise<SaveCopy> {
  await backupsWritten();
  const out: SaveCopy = { index: null, saves: {} };
  await Promise.all(
    (await filesIn(dir)).map(async (name) => {
      const id = SAVE_FILE.exec(name)?.[1];
      if (!id && name !== INDEX_FILE) return;
      try {
        const text = await readFile(path.join(dir, name), 'utf8');
        if (id) out.saves[id] = text;
        else out.index = text;
      } catch {
        // one unreadable file does not stop the rest coming back
      }
    }),
  );
  return out;
}
