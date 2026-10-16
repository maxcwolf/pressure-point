// Updates for the installed app: look for a newer release on GitHub, download it in the background, and install
// it when the player restarts from the game's prompt or simply quits.
import { app, BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { autoUpdater } from 'electron-updater';

import { UPDATE_INSTALL_CHANNEL, UPDATE_READY_CHANNEL, UPDATE_VERSION_CHANNEL } from './api';

/** How often to look again while the game stays open. */
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

/** The version downloaded and waiting to be installed, if any. */
let ready: string | null = null;

/** Whether an IPC message came from the game's own page, not a frame inside it. */
function fromGame(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return event.senderFrame === event.sender.mainFrame;
}

/** Look for an update now. Being offline or GitHub being down is no concern of the player's. */
function check() {
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.warn('Could not check for updates:', err);
  });
}

/**
 * Start looking for updates. Only an installed app updates: a run from this folder has nothing to replace, and
 * one pointed at the dev server is not a release.
 */
export function startUpdates(devUrl: string | undefined) {
  ipcMain.handle(UPDATE_VERSION_CHANNEL, (event) => (fromGame(event) ? ready : null));
  ipcMain.on(UPDATE_INSTALL_CHANNEL, (event) => {
    // silently, then open the new version
    if (fromGame(event) && ready) autoUpdater.quitAndInstall(true, true);
  });
  if (!app.isPackaged || devUrl) return;

  // a download the player never restarts for is installed as the app quits
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', ({ version }) => {
    ready = version;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(UPDATE_READY_CHANNEL, version);
  });
  // without a listener, an 'error' event would crash the app
  autoUpdater.on('error', (err) => {
    console.warn('Update failed:', err);
  });
  check();
  setInterval(check, CHECK_EVERY_MS);
}
