// A copy of every saved game in files, beside the window settings. The game keeps its saves in the page's storage,
// which a player loses by clearing the app's data or with a damaged profile; from these files the game puts them back.
//
// Each player's profile has a folder of its own: the first profile's is `saved-games`, where the copies were before
// there were profiles, and every other's is `profiles/<id>`. The list of profiles is kept beside them, in
// `profiles.json`, so a page that has lost its storage gets its profiles back as well as their saves.
//
// The page asks for these through the preload script, so nothing it sends is trusted: a save id or a profile id has to
// look like one of the game's own before it names a file or a folder, and the folders only ever hold so many files of
// so much text.
//
// The files are written in the background, so an autosave never holds up the main process, but one after another in
// the order the game sent them. The app waits for the last of them before it quits: see backupsPending.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SaveCopy } from './api';

/** What a save id may be: the game's own are letters, digits and dashes, so none can reach outside the folder. */
const SAVE_ID = /^[a-z0-9-]{1,64}$/;
/** What a profile id may be: the game's own are letters and digits. */
const PROFILE_ID = /^[a-z0-9]{1,16}$/;
/** A save's file, and the id back from one. */
const saveFile = (id: string) => `save-${id}.json`;
const SAVE_FILE = /^save-([a-z0-9-]{1,64})\.json$/;
/** The list of saves, with each one's name and headline figures. */
const INDEX_FILE = 'index.json';
/** The first profile's folder, which held every copy before there were profiles. */
const FIRST_FOLDER = 'saved-games';
/** The folder holding a folder for every other profile. */
const PROFILES_FOLDER = 'profiles';
/** The list of profiles, with their names. */
const PROFILES_FILE = 'profiles.json';
/** No more saves than this are kept for a profile: the game has twenty of its own, the autosave and the previous game. */
const MAX_SAVES = 40;
/** No more profiles than this: the game allows eight. */
const MAX_PROFILES = 16;
/** Nor any text longer than the page's own storage could hold. */
const MAX_LENGTH = 10 * 1024 * 1024;

/** Whether a value is a save id the game could have made. */
const isSaveId = (id: unknown): id is string => typeof id === 'string' && SAVE_ID.test(id);
/** Whether a value is text short enough to keep. */
const isText = (text: unknown): text is string => typeof text === 'string' && text.length <= MAX_LENGTH;

/**
 * The folder a profile's copies are kept in: the first profile's when none is named, or null when what is named is not
 * a profile id the game could have made.
 */
function folderOf(root: string, profile: unknown): string | null {
  if (profile === undefined || profile === null) return path.join(root, FIRST_FOLDER);
  return typeof profile === 'string' && PROFILE_ID.test(profile) ? path.join(root, PROFILES_FOLDER, profile) : null;
}

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

/** Whether a profile's folder is there already, or there is room for one more. */
async function roomFor(root: string, dir: string): Promise<boolean> {
  if (path.dirname(dir) !== path.join(root, PROFILES_FOLDER)) return true;
  const folders = await filesIn(path.dirname(dir));
  return folders.includes(path.basename(dir)) || folders.length < MAX_PROFILES;
}

/**
 * Keep a copy of a profile's saved game and of its list of saves. Written in the background, but the app does not quit
 * until it is done, so quitting just after a save, as Exit game does, cannot lose the copy.
 */
export function backupSave(root: string, profile: unknown, id: unknown, text: unknown, index: unknown) {
  const dir = folderOf(root, profile);
  if (!dir || !isSaveId(id) || !isText(text) || !isText(index)) return;
  enqueue(async () => {
    const file = saveFile(id);
    const names = await filesIn(dir);
    if (!names.includes(file) && names.filter((name) => SAVE_FILE.test(name)).length >= MAX_SAVES) return;
    if (!(await roomFor(root, dir))) return;
    await writeWhole(dir, file, text);
    await writeWhole(dir, INDEX_FILE, index);
  }, 'Could not keep a copy of a saved game:');
}

/** Delete the copy of a profile's deleted save, and keep its list of saves as it now stands. */
export function dropBackup(root: string, profile: unknown, id: unknown, index: unknown) {
  const dir = folderOf(root, profile);
  if (!dir || !isSaveId(id) || !isText(index)) return;
  enqueue(async () => {
    if (!(await roomFor(root, dir))) return;
    await rm(path.join(dir, saveFile(id)), { force: true });
    await writeWhole(dir, INDEX_FILE, index);
  }, 'Could not delete the copy of a saved game:');
}

/** Keep a copy of the list of profiles. */
export function backupProfiles(root: string, text: unknown) {
  if (!isText(text)) return;
  enqueue(() => writeWhole(root, PROFILES_FILE, text), 'Could not keep a copy of the profiles:');
}

/** Delete the copies of a deleted profile's saves, folder and all. */
export function dropProfile(root: string, profile: unknown) {
  const dir = folderOf(root, profile);
  if (!dir) return;
  enqueue(() => rm(dir, { recursive: true, force: true }), 'Could not delete the copies of a profile:');
}

/** A file's text, or null if there is none or it will not read. */
const textOf = (file: string): Promise<string | null> => readFile(file, 'utf8').catch(() => null);

/**
 * Every copy kept for a profile: its list, if there is one, and each save's text by id; and the list of profiles, if
 * there is one. Read once the changes already queued are written, so it never misses a save the game has just made.
 * Files that will not read are left out.
 */
export async function readBackup(root: string, profile: unknown): Promise<SaveCopy> {
  await backupsWritten();
  const out: SaveCopy = { index: null, saves: {}, profiles: await textOf(path.join(root, PROFILES_FILE)) };
  const dir = folderOf(root, profile);
  if (!dir) return out;
  await Promise.all(
    (await filesIn(dir)).map(async (name) => {
      const id = SAVE_FILE.exec(name)?.[1];
      if (!id && name !== INDEX_FILE) return;
      const text = await textOf(path.join(dir, name));
      // one unreadable file does not stop the rest coming back
      if (text === null) return;
      if (id) out.saves[id] = text;
      else out.index = text;
    }),
  );
  return out;
}
