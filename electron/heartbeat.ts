// A note the installed app keeps in a file beside the window settings while it runs: when the run began and when the
// app was last seen running, rewritten every few seconds and deleted when the app quits as it should. So a note found
// at launch says the last run ended some other way: the app was killed or died outright, or the whole computer went
// down, none of which leaves the app a moment to report it at the time. Error reports send that at the next launch.
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

/** How often the note is rewritten while the app runs. */
export const BEAT_EVERY_MS = 10_000;

/** What the note says, in milliseconds since 1970. */
export interface Heartbeat {
  /** When the run began. */
  started: number;
  /** When the app was last seen running. */
  last: number;
}

/** A note read back from the file, or null if it is not one: a note cut short as the computer went down, say. */
export function readHeartbeat(raw: unknown): Heartbeat | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { started, last } = raw as Record<string, unknown>;
  if (typeof started !== 'number' || typeof last !== 'number') return null;
  if (!Number.isFinite(started) || !Number.isFinite(last) || last < started) return null;
  return { started, last };
}

/** The note left in a file, or null if there is none or it cannot be read. */
export function loadHeartbeat(file: string): Heartbeat | null {
  try {
    return readHeartbeat(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

/**
 * Whether the computer has started up since the app was last seen running: so the whole machine went down, not just
 * the app. It started up `uptimeSeconds` before `now`.
 */
export function machineRebooted(last: number, now: number, uptimeSeconds: number): boolean {
  return now - uptimeSeconds * 1000 > last;
}

/**
 * Keep the note while the app runs: written now, then every few seconds. Returns what stops it and deletes the note,
 * for when the app quits as it should. A note that will not write is no concern of the player's.
 */
export function startHeartbeat(file: string, now: () => number = Date.now): () => void {
  const started = now();
  const temp = `${file}.tmp`;
  /**
   * Say the app is still running: in a file of its own first, then moved over the note in one step, so the computer
   * going down mid-write cannot leave half a note.
   */
  const beat = () => {
    try {
      writeFileSync(temp, JSON.stringify({ started, last: now() } satisfies Heartbeat));
      renameSync(temp, file);
    } catch {
      // the next beat tries again
    }
  };
  beat();
  const timer = setInterval(beat, BEAT_EVERY_MS);
  // the note never keeps the app running by itself
  timer.unref();
  return () => {
    clearInterval(timer);
    try {
      rmSync(file, { force: true });
    } catch {
      // left behind, it reports this run as one that did not quit cleanly, which is the lesser harm
    }
  };
}
