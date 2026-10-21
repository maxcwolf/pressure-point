// The desktop app's copies of the saved games, kept in files so they outlive the page's storage.
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { backupSave, backupsPending, backupsWritten, dropBackup, readBackup } from '../../electron/backup';

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
    expect(await readBackup(dir)).toEqual({ index: null, saves: {} });
  });

  it('keep each save and the latest list, and forget a deleted save', async () => {
    backupSave(dir, 'auto', '{"day":1}', '[1]');
    backupSave(dir, 'mf3k2-1a', '{"day":2}', '[1,2]');
    backupSave(dir, 'auto', '{"day":3}', '[1,2,3]');
    expect(await readBackup(dir)).toEqual({ index: '[1,2,3]', saves: { auto: '{"day":3}', 'mf3k2-1a': '{"day":2}' } });
    dropBackup(dir, 'mf3k2-1a', '[3]');
    expect(await readBackup(dir)).toEqual({ index: '[3]', saves: { auto: '{"day":3}' } });
    // written whole, with nothing half-written left behind
    expect(readdirSync(dir).sort()).toEqual(['index.json', 'save-auto.json']);
  });

  it('refuse anything that is not a save id the game could make, so nothing lands outside the folder', async () => {
    for (const id of ['../escape', 'a/b', 'A', '', 'x'.repeat(65), 7, null, 'auto.json']) {
      backupSave(dir, id, '{}', '[]');
      dropBackup(dir, id, '[]');
    }
    // refused at once, so there is nothing for quitting to wait for
    expect(backupsPending()).toBe(false);
    await backupsWritten();
    expect(readdirSync(root)).toEqual([]);
  });

  it('refuse text that is not text, or too long to have come from the game', async () => {
    backupSave(dir, 'auto', 42, '[]');
    backupSave(dir, 'auto', '{}', { not: 'text' });
    backupSave(dir, 'auto', 'x'.repeat(10 * 1024 * 1024 + 1), '[]');
    expect(await readBackup(dir)).toEqual({ index: null, saves: {} });
  });

  it('keep only so many saves, though the ones kept still update', async () => {
    for (let i = 0; i < 45; i++) backupSave(dir, `s-${i}`, `${i}`, '[]');
    const saves = (await readBackup(dir)).saves;
    expect(Object.keys(saves)).toHaveLength(40);
    // the first forty, as each was counted only once the ones before it were written
    expect(saves['s-39']).toBe('39');
    expect(saves['s-40']).toBeUndefined();
    backupSave(dir, 's-0', 'again', '[]');
    expect((await readBackup(dir)).saves['s-0']).toBe('again');
  });

  it('read back only their own files', async () => {
    backupSave(dir, 'auto', '{}', '[]');
    await backupsWritten();
    writeFileSync(path.join(dir, 'notes.txt'), 'hello');
    writeFileSync(path.join(dir, 'save-auto.json.tmp'), 'half');
    expect(await readBackup(dir)).toEqual({ index: '[]', saves: { auto: '{}' } });
  });

  it('write in the background but in order, and say when quitting would lose a copy', async () => {
    for (let day = 1; day <= 20; day++) backupSave(dir, 'auto', `{"day":${day}}`, `[${day}]`);
    expect(backupsPending()).toBe(true);
    await backupsWritten();
    expect(backupsPending()).toBe(false);
    expect(await readBackup(dir)).toEqual({ index: '[20]', saves: { auto: '{"day":20}' } });
  });

  it('carry on after a copy that will not write', async () => {
    // a file where the folder should be, so nothing can be written into it
    writeFileSync(dir, 'in the way');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    backupSave(dir, 'auto', '{}', '[]');
    await backupsWritten();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
    rmSync(dir);
    backupSave(dir, 'auto', '{"day":2}', '[2]');
    expect(await readBackup(dir)).toEqual({ index: '[2]', saves: { auto: '{"day":2}' } });
  });
});
