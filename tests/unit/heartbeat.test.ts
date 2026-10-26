// The desktop app's note that it is running, which says at the next launch whether the last run quit cleanly.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BEAT_EVERY_MS, loadHeartbeat, machineRebooted, readHeartbeat, startHeartbeat } from '../../electron/heartbeat';

describe('the running note', () => {
  it('reads back when the run began and when it was last seen, and nothing else', () => {
    expect(readHeartbeat({ started: 1000, last: 5000 })).toEqual({ started: 1000, last: 5000 });
    expect(readHeartbeat({ started: 1000, last: 1000, extra: true })).toEqual({ started: 1000, last: 1000 });
    expect(readHeartbeat({ started: 1000 })).toBeNull();
    expect(readHeartbeat({ started: '1000', last: 5000 })).toBeNull();
    expect(readHeartbeat({ started: 5000, last: 1000 })).toBeNull();
    expect(readHeartbeat({ started: Number.NaN, last: 1000 })).toBeNull();
    expect(readHeartbeat(null)).toBeNull();
    expect(readHeartbeat('{"started":1,"last":2}')).toBeNull();
  });

  it('says the computer went down when it started up again after the app was last seen', () => {
    const last = Date.UTC(2026, 9, 26, 14, 0, 0);
    // the game alone died: the computer has been up for a day, since long before the last beat
    expect(machineRebooted(last, last + 60_000, 24 * 60 * 60)).toBe(false);
    // the whole computer went down: it started up a minute after the last beat and has been up for two minutes
    expect(machineRebooted(last, last + 3 * 60_000, 2 * 60)).toBe(true);
  });

  describe('in a file', () => {
    let dir = '';
    let file = '';
    beforeEach(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'pressure-point-heartbeat-'));
      file = path.join(dir, 'heartbeat.json');
    });
    afterEach(() => {
      vi.useRealTimers();
      rmSync(dir, { recursive: true, force: true });
    });

    it('is nothing when there is no file, or it is not a note', () => {
      expect(loadHeartbeat(file)).toBeNull();
      writeFileSync(file, '{"started": 10');
      expect(loadHeartbeat(file)).toBeNull();
      writeFileSync(file, '');
      expect(loadHeartbeat(file)).toBeNull();
    });

    it('is written at once, kept up to date while the app runs, and deleted when it quits', () => {
      vi.useFakeTimers({ now: 1_000_000 });
      const stop = startHeartbeat(file);
      expect(loadHeartbeat(file)).toEqual({ started: 1_000_000, last: 1_000_000 });
      vi.advanceTimersByTime(BEAT_EVERY_MS * 3);
      expect(loadHeartbeat(file)).toEqual({ started: 1_000_000, last: 1_000_000 + BEAT_EVERY_MS * 3 });
      // written whole, with nothing half-written left behind
      expect(readdirSync(dir)).toEqual(['heartbeat.json']);
      stop();
      expect(existsSync(file)).toBe(false);
      // and once stopped, it is not written again
      vi.advanceTimersByTime(BEAT_EVERY_MS * 3);
      expect(existsSync(file)).toBe(false);
    });

    it('does not throw when the file cannot be written, or deleted', () => {
      expect(() => {
        const stop = startHeartbeat(path.join(dir, 'missing', 'heartbeat.json'));
        stop();
      }).not.toThrow();
    });
  });
});
