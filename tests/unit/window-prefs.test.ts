// The desktop app's window settings: whether it fills the screen, kept in a file for the next launch.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defaultWindowPrefs, loadWindowPrefs, readWindowPrefs, saveWindowPrefs } from '../../electron/prefs';

describe('window settings', () => {
  it('start in a window of its own', () => {
    expect(defaultWindowPrefs()).toEqual({ fullScreen: false });
  });

  it('keep what was saved and leave anything unusable at its default', () => {
    expect(readWindowPrefs({ fullScreen: true })).toEqual({ fullScreen: true });
    expect(readWindowPrefs({ fullScreen: false })).toEqual({ fullScreen: false });
    expect(readWindowPrefs({ fullScreen: 'yes' })).toEqual({ fullScreen: false });
    expect(readWindowPrefs({})).toEqual({ fullScreen: false });
    expect(readWindowPrefs(null)).toEqual({ fullScreen: false });
    expect(readWindowPrefs('true')).toEqual({ fullScreen: false });
  });

  describe('in a file', () => {
    let dir = '';
    let file = '';
    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'pressure-point-prefs-'));
      file = path.join(dir, 'window.json');
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('come back as they were saved', () => {
      saveWindowPrefs(file, { fullScreen: true });
      expect(loadWindowPrefs(file)).toEqual({ fullScreen: true });
      saveWindowPrefs(file, { fullScreen: false });
      expect(loadWindowPrefs(file)).toEqual({ fullScreen: false });
    });

    it('are the defaults when there is no file yet, or it is not JSON', () => {
      expect(loadWindowPrefs(file)).toEqual({ fullScreen: false });
      writeFileSync(file, '{"fullScreen": tru');
      expect(loadWindowPrefs(file)).toEqual({ fullScreen: false });
    });

    it('do not throw when the file cannot be written', () => {
      expect(() => {
        saveWindowPrefs(path.join(dir, 'missing', 'window.json'), { fullScreen: true });
      }).not.toThrow();
    });
  });
});
