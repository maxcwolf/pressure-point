// Runs in the game's page before the game does, with the sandbox on.
// It hands the game a small, fixed set of things it may ask of the desktop app, and nothing else.
import { contextBridge, ipcRenderer } from 'electron';

import {
  BACKUP_DROP_CHANNEL,
  BACKUP_READ_CHANNEL,
  BACKUP_SAVE_CHANNEL,
  type DesktopApi,
  FULL_SCREEN_CHANGED_CHANNEL,
  FULL_SCREEN_SET_CHANNEL,
  FULL_SCREEN_STATE_CHANNEL,
  QUIT_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_READY_CHANNEL,
  UPDATE_VERSION_CHANNEL,
} from './api';

const api: DesktopApi = {
  platform: process.platform,
  /** Ask the desktop app to quit. */
  quit: () => {
    ipcRenderer.send(QUIT_CHANNEL);
  },
  /** Hear about a downloaded update: one that finished before this page loaded, then any that finishes later. */
  onUpdateReady: (listener) => {
    ipcRenderer.on(UPDATE_READY_CHANNEL, (_event, version: string) => {
      listener(version);
    });
    void ipcRenderer.invoke(UPDATE_VERSION_CHANNEL).then((version: string | null) => {
      if (version) listener(version);
    });
  },
  /** Ask the desktop app to install the downloaded update. */
  installUpdate: () => {
    ipcRenderer.send(UPDATE_INSTALL_CHANNEL);
  },
  /** Hear whether the window fills the screen: as it is now, then each time that changes. */
  onFullScreen: (listener) => {
    ipcRenderer.on(FULL_SCREEN_CHANGED_CHANNEL, (_event, on: boolean) => {
      listener(on);
    });
    void ipcRenderer.invoke(FULL_SCREEN_STATE_CHANNEL).then((on: boolean) => {
      listener(on);
    });
  },
  /** Ask the desktop app to fill the screen with the window, or to leave it. */
  setFullScreen: (on) => {
    ipcRenderer.send(FULL_SCREEN_SET_CHANNEL, on);
  },
  /** Hand the desktop app a saved game to keep a copy of. */
  backupSave: (id, text, index) => {
    ipcRenderer.send(BACKUP_SAVE_CHANNEL, id, text, index);
  },
  /** Tell the desktop app a save was deleted. */
  dropBackup: (id, index) => {
    ipcRenderer.send(BACKUP_DROP_CHANNEL, id, index);
  },
  /** Ask the desktop app for every copy it keeps. */
  readBackup: () => ipcRenderer.invoke(BACKUP_READ_CHANNEL),
};

contextBridge.exposeInMainWorld('desktop', api);
