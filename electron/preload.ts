// Runs in the game's page before the game does, with the sandbox on.
// It hands the game a small, fixed set of things it may ask of the desktop app, and nothing else.
import { contextBridge, ipcRenderer } from 'electron';

import { type DesktopApi, QUIT_CHANNEL } from './api';

const api: DesktopApi = {
  platform: process.platform,
  quit: () => {
    ipcRenderer.send(QUIT_CHANNEL);
  },
};

contextBridge.exposeInMainWorld('desktop', api);
