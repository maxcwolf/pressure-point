// Updates for the installed app: look for a newer release on GitHub, download it in the background, and install
// it when the player restarts from the game's prompt or simply quits. The game hears how far each look has got, so
// the title screen can say it is checking, and then that there is nothing newer or that an update is on its way.
// It looks at launch, every so often after, and again each time the player comes back to the title screen.
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { AppUpdater } from 'electron-updater';

import {
  UPDATE_CHECK_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_STATUS_CHANGED_CHANNEL,
  UPDATE_STATUS_CHANNEL,
  type UpdateStatus,
} from './api';

/** How long after the window shows to look the first time, so the game opens before anything else happens. */
const FIRST_CHECK_AFTER_MS = 5000;
/** How often to look again while the game stays open. */
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

/** The updater, once loaded. Only an installed app loads it, and not until the game is on screen. */
let updater: AppUpdater | null = null;
/** How far the look for an update has got. */
let status: UpdateStatus = { state: 'idle' };

/** Whether an IPC message came from the game's own page, not a frame inside it. */
function fromGame(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return event.senderFrame === event.sender.mainFrame;
}

/** Tell the game how far the look has got. A downloaded update stays on offer, whatever a later look finds. */
function tell(next: UpdateStatus) {
  if (status.state === 'ready' && next.state !== 'ready') return;
  status = next;
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(UPDATE_STATUS_CHANGED_CHANNEL, status);
}

/** Look for an update now. Being offline or GitHub being down is no concern of the player's. */
function check(autoUpdater: AppUpdater) {
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.warn('Could not check for updates:', err);
  });
}

/** Load the updater, then look for an update now and every so often after. */
async function begin() {
  const { autoUpdater } = await import('electron-updater');
  updater = autoUpdater;
  // a download the player never restarts for is installed as the app quits
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => {
    tell({ state: 'checking' });
  });
  autoUpdater.on('update-not-available', () => {
    tell({ state: 'latest' });
  });
  autoUpdater.on('update-available', ({ version }) => {
    tell({ state: 'downloading', version });
  });
  autoUpdater.on('update-downloaded', ({ version }) => {
    tell({ state: 'ready', version });
  });
  // without a listener, an 'error' event would crash the app
  autoUpdater.on('error', (err) => {
    console.warn('Update failed:', err);
    tell({ state: 'idle' });
  });
  check(autoUpdater);
  setInterval(() => {
    check(autoUpdater);
  }, CHECK_EVERY_MS);
}

/**
 * Start looking for updates once the game window is showing. Only an installed app updates: a run from this folder
 * has nothing to replace, and one pointed at the dev server is not a release.
 */
export function startUpdates(win: BrowserWindow, devUrl: string | undefined) {
  ipcMain.handle(UPDATE_STATUS_CHANNEL, (event) => (fromGame(event) ? status : { state: 'idle' }));
  ipcMain.on(UPDATE_INSTALL_CHANNEL, (event) => {
    // silently, then open the new version
    if (fromGame(event) && status.state === 'ready') updater?.quitAndInstall(true, true);
  });
  ipcMain.on(UPDATE_CHECK_CHANNEL, (event) => {
    // until the updater has loaded, the first look is still to come; one under way, or one that has found a newer
    // version, has nothing to add
    const settled = status.state === 'latest' || status.state === 'idle';
    if (fromGame(event) && updater && settled) check(updater);
  });
  if (!app.isPackaged || devUrl) return;

  // the first look is only put off, so the title screen says it is checking from the moment it opens
  status = { state: 'checking' };
  win.once('ready-to-show', () => {
    setTimeout(() => {
      begin().catch((err: unknown) => {
        console.warn('Could not start looking for updates:', err);
        tell({ state: 'idle' });
      });
    }, FIRST_CHECK_AFTER_MS);
  });
}
