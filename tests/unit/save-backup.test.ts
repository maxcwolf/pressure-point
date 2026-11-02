// The desktop app's copies of the saved games, kept in files so they outlive the page's storage.
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  backupProfiles,
  backupSave,
  backupsPending,
  backupsWritten,
  dropBackup,
  dropProfile,
  readBackup,
} from '../../electron/backup';

describe('save backup files', () => {
  let root = '';
  let dir = '';
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'pressure-point-backup-'));
    dir = path.join(root, 'saved-games');
  });
  afterEach(async () => {
    await backupsWritten();
    rmSync(root, { recursive: true, force: true });
  });

  it('read back nothing before anything is kept', async () => {
    expect(await readBackup(root, undefined)).toEqual({ index: null, saves: {}, profiles: null });
  });

  it('keep each save and the latest list, and forget a deleted save', async () => {
    backupSave(root, undefined, 'auto', '{"day":1}', '[1]');
    backupSave(root, undefined, 'mf3k2-1a', '{"day":2}', '[1,2]');
    backupSave(root, undefined, 'auto', '{"day":3}', '[1,2,3]');
    expect(await readBackup(root, undefined)).toEqual({
      index: '[1,2,3]',
      saves: { auto: '{"day":3}', 'mf3k2-1a': '{"day":2}' },
      profiles: null,
    });
    dropBackup(root, undefined, 'mf3k2-1a', '[3]');
    expect(await readBackup(root, undefined)).toEqual({ index: '[3]', saves: { auto: '{"day":3}' }, profiles: null });
    // written whole, with nothing half-written left behind
    expect(readdirSync(dir).sort()).toEqual(['index.json', 'save-auto.json']);
  });

  it('refuse anything that is not a save id the game could make, so nothing lands outside the folder', async () => {
    for (const id of ['../escape', 'a/b', 'A', '', 'x'.repeat(65), 7, null, 'auto.json']) {
      backupSave(root, undefined, id, '{}', '[]');
      dropBackup(root, undefined, id, '[]');
    }
    // refused at once, so there is nothing for quitting to wait for
    expect(backupsPending()).toBe(false);
    await backupsWritten();
    expect(readdirSync(root)).toEqual([]);
  });

  it('refuse text that is not text, or too long to have come from the game', async () => {
    backupSave(root, undefined, 'auto', 42, '[]');
    backupSave(root, undefined, 'auto', '{}', { not: 'text' });
    backupSave(root, undefined, 'auto', 'x'.repeat(10 * 1024 * 1024 + 1), '[]');
    expect(await readBackup(root, undefined)).toEqual({ index: null, saves: {}, profiles: null });
  });

  it('keep only so many saves, though the ones kept still update', async () => {
    for (let i = 0; i < 45; i++) backupSave(root, undefined, `s-${i}`, `${i}`, '[]');
    const saves = (await readBackup(root, undefined)).saves;
    expect(Object.keys(saves)).toHaveLength(40);
    // the first forty, as each was counted only once the ones before it were written
    expect(saves['s-39']).toBe('39');
    expect(saves['s-40']).toBeUndefined();
    backupSave(root, undefined, 's-0', 'again', '[]');
    expect((await readBackup(root, undefined)).saves['s-0']).toBe('again');
  });

  it('read back only their own files', async () => {
    backupSave(root, undefined, 'auto', '{}', '[]');
    await backupsWritten();
    writeFileSync(path.join(dir, 'notes.txt'), 'hello');
    writeFileSync(path.join(dir, 'save-auto.json.tmp'), 'half');
    expect(await readBackup(root, undefined)).toEqual({ index: '[]', saves: { auto: '{}' }, profiles: null });
  });

  it('write in the background but in order, and say when quitting would lose a copy', async () => {
    for (let day = 1; day <= 20; day++) backupSave(root, undefined, 'auto', `{"day":${day}}`, `[${day}]`);
    expect(backupsPending()).toBe(true);
    await backupsWritten();
    expect(backupsPending()).toBe(false);
    expect(await readBackup(root, undefined)).toEqual({ index: '[20]', saves: { auto: '{"day":20}' }, profiles: null });
  });

  it('carry on after a copy that will not write', async () => {
    // a file where the folder should be, so nothing can be written into it
    writeFileSync(dir, 'in the way');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    backupSave(root, undefined, 'auto', '{}', '[]');
    await backupsWritten();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
    rmSync(dir);
    backupSave(root, undefined, 'auto', '{"day":2}', '[2]');
    expect(await readBackup(root, undefined)).toEqual({ index: '[2]', saves: { auto: '{"day":2}' }, profiles: null });
  });
});

describe('save backup files for profiles', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'pressure-point-backup-'));
  });
  afterEach(async () => {
    await backupsWritten();
    rmSync(root, { recursive: true, force: true });
  });

  it("keep each profile's copies in a folder of its own, the first's where they always were", async () => {
    backupSave(root, undefined, 'auto', '{"who":"first"}', '[1]');
    backupSave(root, 'k2j3h4g5', 'auto', '{"who":"second"}', '[2]');
    backupProfiles(root, '{"profiles":[]}');
    expect(await readBackup(root, undefined)).toEqual({
      index: '[1]',
      saves: { auto: '{"who":"first"}' },
      profiles: '{"profiles":[]}',
    });
    expect(await readBackup(root, 'k2j3h4g5')).toEqual({
      index: '[2]',
      saves: { auto: '{"who":"second"}' },
      profiles: '{"profiles":[]}',
    });
    expect(readdirSync(root).sort()).toEqual(['profiles', 'profiles.json', 'saved-games']);
    expect(readdirSync(path.join(root, 'profiles'))).toEqual(['k2j3h4g5']);
  });

  it("delete a deleted profile's copies, folder and all, and leave the rest", async () => {
    backupSave(root, undefined, 'auto', '{}', '[1]');
    backupSave(root, 'k2j3h4g5', 'auto', '{}', '[2]');
    dropProfile(root, 'k2j3h4g5');
    expect(await readBackup(root, 'k2j3h4g5')).toEqual({ index: null, saves: {}, profiles: null });
    expect((await readBackup(root, undefined)).index).toBe('[1]');
    // a call that has lost its profile takes nothing; the first's copies go only when it is named
    dropProfile(root, undefined);
    dropProfile(root, null);
    expect((await readBackup(root, 'first')).index).toBe('[1]');
    dropProfile(root, 'first');
    expect(await readBackup(root, undefined)).toEqual({ index: null, saves: {}, profiles: null });
  });

  it('refuse anything that is not a profile id the game could make, so nothing lands outside its folder', async () => {
    for (const profile of ['../escape', 'a/b', 'A', '', 'x'.repeat(17), 7, 'a-b', '..']) {
      backupSave(root, profile, 'auto', '{}', '[]');
      dropBackup(root, profile, 'auto', '[]');
      dropProfile(root, profile);
    }
    backupProfiles(root, { not: 'text' });
    expect(backupsPending()).toBe(false);
    await backupsWritten();
    expect(readdirSync(root)).toEqual([]);
    expect(await readBackup(root, '../escape')).toEqual({ index: null, saves: {}, profiles: null });
  });

  it('keep folders for only so many profiles, though the ones kept still update', async () => {
    for (let i = 0; i < 20; i++) backupSave(root, `p${i}`, 'auto', `${i}`, '[]');
    await backupsWritten();
    expect(readdirSync(path.join(root, 'profiles'))).toHaveLength(16);
    expect((await readBackup(root, 'p16')).saves).toEqual({});
    backupSave(root, 'p0', 'auto', 'again', '[]');
    expect((await readBackup(root, 'p0')).saves).toEqual({ auto: 'again' });
  });
});
