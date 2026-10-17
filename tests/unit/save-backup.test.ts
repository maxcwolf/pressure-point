// The desktop app's copies of the saved games, kept in files so they outlive the page's storage.
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { backupSave, dropBackup, readBackup } from '../../electron/backup';

describe('save backup files', () => {
  let root = '';
  let dir = '';
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'pressure-point-backup-'));
    dir = path.join(root, 'saved-games');
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('read back nothing before anything is kept', () => {
    expect(readBackup(dir)).toEqual({ index: null, saves: {} });
  });

  it('keep each save and the latest list, and forget a deleted save', () => {
    backupSave(dir, 'auto', '{"day":1}', '[1]');
    backupSave(dir, 'mf3k2-1a', '{"day":2}', '[1,2]');
    backupSave(dir, 'auto', '{"day":3}', '[1,2,3]');
    expect(readBackup(dir)).toEqual({ index: '[1,2,3]', saves: { auto: '{"day":3}', 'mf3k2-1a': '{"day":2}' } });
    dropBackup(dir, 'mf3k2-1a', '[3]');
    expect(readBackup(dir)).toEqual({ index: '[3]', saves: { auto: '{"day":3}' } });
    // written whole, with nothing half-written left behind
    expect(readdirSync(dir).sort()).toEqual(['index.json', 'save-auto.json']);
  });

  it('refuse anything that is not a save id the game could make, so nothing lands outside the folder', () => {
    for (const id of ['../escape', 'a/b', 'A', '', 'x'.repeat(65), 7, null, 'auto.json']) {
      backupSave(dir, id, '{}', '[]');
      dropBackup(dir, id, '[]');
    }
    expect(readdirSync(root)).toEqual([]);
  });

  it('refuse text that is not text, or too long to have come from the game', () => {
    backupSave(dir, 'auto', 42, '[]');
    backupSave(dir, 'auto', '{}', { not: 'text' });
    backupSave(dir, 'auto', 'x'.repeat(10 * 1024 * 1024 + 1), '[]');
    expect(readBackup(dir)).toEqual({ index: null, saves: {} });
  });

  it('keep only so many saves, though the ones kept still update', () => {
    for (let i = 0; i < 45; i++) backupSave(dir, `s-${i}`, `${i}`, '[]');
    const saves = readBackup(dir).saves;
    expect(Object.keys(saves)).toHaveLength(40);
    backupSave(dir, 's-0', 'again', '[]');
    expect(readBackup(dir).saves['s-0']).toBe('again');
  });

  it('read back only their own files', () => {
    backupSave(dir, 'auto', '{}', '[]');
    writeFileSync(path.join(dir, 'notes.txt'), 'hello');
    writeFileSync(path.join(dir, 'save-auto.json.tmp'), 'half');
    expect(readBackup(dir)).toEqual({ index: '[]', saves: { auto: '{}' } });
  });
});
