// Error reports from the installed desktop app, sent to Sentry with the game's own. The game's page can only report
// what goes wrong in its JavaScript (src/app/sentry.ts). From here the app also reports what the page cannot see: a
// crash of the app or of any of its processes, the app or the game's window hanging, and a run that never quit
// cleanly, as when the whole computer goes down. The page's reports come through here too, and go on from here.
//
// A run from this folder reports nothing, and nor does an installed app while the desktop tests drive it.
import os from 'node:os';
import path from 'node:path';

import * as Sentry from '@sentry/electron/main';
import { anrIntegration } from '@sentry/node';
import { app, type BrowserWindow, powerMonitor } from 'electron';

import { loadHeartbeat, machineRebooted, startHeartbeat } from './heartbeat';

/** Where the reports go: the game's own project, as in src/app/sentry.ts. A DSN only says where to send. */
const DSN = 'https://447a312d7f3f9ceddd763bcd504e2ab8@o4511475793068032.ingest.us.sentry.io/4512262151405568';

/** Whether this run reports: an installed app, unless the desktop tests set PP_NO_REPORTS (tests/desktop/fixtures.ts). */
const reporting = app.isPackaged && !process.env.PP_NO_REPORTS;

/** The note that says this run is still going (electron/heartbeat.ts), beside the window settings. */
const heartbeatFile = () => path.join(app.getPath('userData'), 'heartbeat.json');

/** Stops the note and deletes it, once the app is reporting. */
let stopHeartbeat: (() => void) | undefined;

/**
 * Start reporting, as early as the app starts, so the rest of the start-up is covered too. Call it once the app knows
 * it is the only copy running: a second copy only hands over to the first and quits, and must leave its reports alone.
 */
export function startReports() {
  if (!reporting) return;
  // A hang of this process freezes the whole app. The SDK's own watch for it needs a native addon, so this one, which
  // runs on a worker thread, is used instead. It sends no stack trace, which would need a debugging port opened.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- its replacement is the one that needs a native addon
  const mainHang = anrIntegration({ captureStackTrace: false });
  Sentry.init({
    dsn: DSN,
    environment: 'desktop',
    // the same release as the game's page, and as the build uploads the source maps to (scripts/build-desktop.mjs)
    release: `pressure-point@${__APP_VERSION__}`,
    // the page's reports come through a protocol of the SDK's own, which needs nothing from the preload script
    ipcMode: Sentry.IPCMode.Protocol,
    // these hooks instrument server libraries as they load, and the app loads none
    enableRuntimeChannelInjection: false,
    initialScope: { tags: { platform: process.platform } },
    integrations: [
      // Besides the crashes, which come with a crash dump of their own, a child process the system kills is reported
      // too: it leaves no dump.
      Sentry.childProcessIntegration({ events: ['abnormal-exit', 'launch-failed', 'integrity-failure', 'killed'] }),
      mainHang,
    ],
  });
  // a computer asleep or locked holds up this process without it hanging
  void app.whenReady().then(() => {
    powerMonitor.on('suspend', mainHang.stopWorker);
    powerMonitor.on('lock-screen', mainHang.stopWorker);
    powerMonitor.on('resume', mainHang.startWorker);
    powerMonitor.on('unlock-screen', mainHang.startWorker);
  });

  // A note left over from the last run says it never quit cleanly. Sent as an event of its own rather than with
  // captureMessage, which would add where this code is and name the issue after it.
  const file = heartbeatFile();
  const last = loadHeartbeat(file);
  if (last) {
    Sentry.captureEvent({
      message: 'Previous run did not quit cleanly',
      level: 'warning',
      // whether the whole computer went down, or the app alone
      tags: { machine_rebooted: machineRebooted(last.last, Date.now(), os.uptime()) },
      extra: {
        ran_for_seconds: Math.round((last.last - last.started) / 1000),
        last_heartbeat: new Date(last.last).toISOString(),
      },
    });
  }
  stopHeartbeat = startHeartbeat(file);
  // once the app has quit as it should, nothing is left to say otherwise
  app.on('quit', stopHeartbeat);
}

/**
 * Report the game's window hanging: a warning with how long it hung once it responds again, or once it is closed
 * still hung. Electron only says it has stopped responding some fifteen seconds in, so that is where the count starts.
 */
export function watchWindow(win: BrowserWindow) {
  if (!reporting) return;
  /** When the window stopped responding, while it has not. */
  let hungSince: number | null = null;
  /** How long the window has gone without responding, in whole seconds. */
  const hungFor = (since: number) => Math.round((Date.now() - since) / 1000);
  /** Send the warning for a hang that has ended. */
  const report = (since: number, recovered: boolean) => {
    const seconds = hungFor(since);
    Sentry.captureEvent({
      message: `The game window stopped responding for ${seconds} seconds`,
      level: 'warning',
      // one issue for every hang, however long
      fingerprint: ['game-window-unresponsive'],
      extra: { hung_seconds: seconds, recovered },
    });
  };
  win.on('unresponsive', () => {
    hungSince ??= Date.now();
    Sentry.addBreadcrumb({ category: 'window', level: 'warning', message: 'The game window stopped responding' });
  });
  win.on('responsive', () => {
    if (hungSince === null) return;
    const since = hungSince;
    hungSince = null;
    report(since, true);
    Sentry.addBreadcrumb({
      category: 'window',
      level: 'info',
      message: `The game window is responding again, after ${hungFor(since)} seconds`,
    });
  });
  win.on('closed', () => {
    if (hungSince !== null) report(hungSince, false);
  });
  // Windows ends the app without quitting it when the computer shuts down or the player signs out. That is no fault
  // of the app's, so it is a clean end.
  win.on('session-end', () => {
    stopHeartbeat?.();
  });
}
