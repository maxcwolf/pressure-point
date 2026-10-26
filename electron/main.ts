// The desktop app's main process: one window that shows the game.
import path from 'node:path';

import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions, session, shell } from 'electron';

import {
  BACKUP_DROP_CHANNEL,
  BACKUP_READ_CHANNEL,
  BACKUP_SAVE_CHANNEL,
  FULL_SCREEN_CHANGED_CHANNEL,
  FULL_SCREEN_SET_CHANNEL,
  FULL_SCREEN_STATE_CHANNEL,
  QUIT_CHANNEL,
} from './api';
import { backupSave, backupsPending, backupsWritten, dropBackup, readBackup } from './backup';
import { loadWindowPrefs, saveWindowPrefs } from './prefs';
import { startReports, watchWindow } from './reports';
import { startUpdates } from './updates';

// One copy of the game at a time: two would autosave over each other's game. A second copy hands over to the
// first, which comes to the front, and quits.
const firstCopy = app.requestSingleInstanceLock();
if (!firstCopy) app.quit();
// Error reports start before anything else, to cover the rest of the start-up, but only in the first copy: a second
// one would take the first one's run, still going, for one that never quit.
if (firstCopy) startReports();

const isMac = process.platform === 'darwin';
/** Set to the dev server's address to run the game from it instead of from the built files. */
const devUrl = process.env.PP_DEV_URL;
/**
 * The app icon, for runs straight from this folder. Installed apps carry it in their own files, but a dev
 * run is the stock Electron program, which would otherwise show Electron's icon.
 */
const devIcon = app.isPackaged ? undefined : path.join(__dirname, '..', 'build', 'icon.png');
/** The Dock's icon for a dev run: macOS has its own, a rounded square, or it shrinks the icon onto a gray tile. */
const devDockIcon = app.isPackaged ? undefined : path.join(__dirname, '..', 'build', 'icon-mac.png');

/** Where the window's settings are kept, beside the game's saves. */
const prefsFile = () => path.join(app.getPath('userData'), 'window.json');

/**
 * Whether each window has been asked to fill the screen or leave it and has not yet said it got there. macOS drops the
 * request, without a word, for a window whose app is not the active one (opened behind another app, or switched away
 * from as it opened), and Electron then holds up every later request behind the lost one. So the window is only asked
 * while it is focused, and again whenever it is focused until it gets there: after that, how it fills the screen or
 * leaves it is up to the player.
 */
const fullScreenAsked = new WeakMap<BrowserWindow, boolean>();

/** Open the game window, full screen if the player left it that way, and load the game into it. */
function createWindow(): BrowserWindow {
  const prefs = loadWindowPrefs(prefsFile());
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#a8d8c8',
    title: 'Pressure Point Institute',
    ...(devIcon && { icon: devIcon }),
    // Not `fullscreen`, which asks while the window is hidden and its app may not be active yet: macOS can drop that,
    // and then hold up every later ask behind it. Full screen is asked for once the window is focused, below.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => {
    win.show();
  });
  watchWindow(win);
  // full screen if the player left it that way, as soon as it can be
  if (prefs.fullScreen) fullScreenAsked.set(win, true);
  win.on('focus', () => {
    const asked = fullScreenAsked.get(win);
    if (asked !== undefined && asked !== win.isFullScreen()) win.setFullScreen(asked);
  });
  // However the window fills the screen or leaves it (the game's setting, the menu, the green button or its keys),
  // the next launch opens it the same way, and the game's setting follows. Not while it closes, which can take it
  // out of full screen on the way.
  let closing = false;
  win.on('close', () => {
    closing = true;
  });
  /** Remember whether the window fills the screen, and tell the game. */
  const follow = (fullScreen: boolean) => {
    fullScreenAsked.delete(win);
    if (closing) return;
    saveWindowPrefs(prefsFile(), { fullScreen });
    win.webContents.send(FULL_SCREEN_CHANGED_CHANNEL, fullScreen);
  };
  win.on('enter-full-screen', () => {
    follow(true);
  });
  win.on('leave-full-screen', () => {
    follow(false);
  });

  // The built game is loaded as a file on purpose: saved games are kept per address,
  // so serving it from anywhere else would hide every save a player already has.
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return win;
}

/** Whether two addresses are the same page, ignoring anything after `?` or `#`. */
function samePage(a: string, b: string): boolean {
  /** Strip the query and fragment from an address. */
  const page = (url: string) => url.replace(/[?#].*$/, '');
  return page(a) === page(b);
}

/** Whether an address is an ordinary http or https link. */
function isWebLink(url: string): boolean {
  return URL.canParse(url) && ['https:', 'http:'].includes(new URL(url).protocol);
}

// The window only ever shows the game. These apply to every page the app could create.
app.on('web-contents-created', (_event, contents) => {
  // links open in the player's browser, never in a second window
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebLink(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // the game reloads itself to load a save or start over; it may not go anywhere else
  contents.on('will-navigate', (event, url) => {
    if (!samePage(url, contents.getURL())) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});

ipcMain.on(QUIT_CHANNEL, (event) => {
  // only the game's own page may ask, not a frame inside it
  if (event.senderFrame === event.sender.mainFrame) app.quit();
});
ipcMain.handle(FULL_SCREEN_STATE_CHANNEL, (event) => {
  if (event.senderFrame !== event.sender.mainFrame) return false;
  const win = BrowserWindow.fromWebContents(event.sender);
  // what it has been asked for, as the game shows the player's choice at once
  return win ? (fullScreenAsked.get(win) ?? win.isFullScreen()) : false;
});
ipcMain.on(FULL_SCREEN_SET_CHANNEL, (event, on: unknown) => {
  if (event.senderFrame !== event.sender.mainFrame || typeof on !== 'boolean') return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  // already there, so no event will say so, and nothing is left to ask for
  if (on === win.isFullScreen()) {
    fullScreenAsked.delete(win);
    return;
  }
  // saved once the window has got there, by the window's own events
  fullScreenAsked.set(win, on);
  if (win.isFocused()) win.setFullScreen(on);
});

const gameMenu: MenuItemConstructorOptions[] = [{ role: 'togglefullscreen' }];
// for working on the app; players restart the game from its own menus
if (!app.isPackaged) gameMenu.push({ role: 'reload', label: 'Restart Renderer' }, { role: 'toggleDevTools' });
if (!isMac) gameMenu.push({ type: 'separator' }, { role: 'quit' });

const menu: MenuItemConstructorOptions[] = [{ label: 'Game', submenu: gameMenu }, { role: 'windowMenu' }];
if (isMac) menu.unshift({ role: 'appMenu' });
Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

// the first copy comes to the front when a second one hands over to it
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

void app.whenReady().then(() => {
  if (!firstCopy) return;
  // the game asks for nothing: no camera, microphone, location or notifications
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, allow) => {
    allow(false);
  });
  // and when it only asks whether it has one, the answer is no as well
  session.defaultSession.setPermissionCheckHandler(() => false);
  if (devDockIcon && isMac) app.dock?.setIcon(devDockIcon);
  startUpdates(createWindow(), devUrl);
});

// one window, one game: closing it (or choosing Exit in the game) quits on every platform
app.on('window-all-closed', () => {
  app.quit();
});

// Copies of the saved games, in files beside the window settings, so they outlive the page's storage. Only the game's
// own page may ask, not a frame inside it.
/** Where the copies of the saved games are kept. */
const backupDir = () => path.join(app.getPath('userData'), 'saved-games');
ipcMain.on(BACKUP_SAVE_CHANNEL, (event, id: unknown, text: unknown, index: unknown) => {
  if (event.senderFrame === event.sender.mainFrame) backupSave(backupDir(), id, text, index);
});
ipcMain.on(BACKUP_DROP_CHANNEL, (event, id: unknown, index: unknown) => {
  if (event.senderFrame === event.sender.mainFrame) dropBackup(backupDir(), id, index);
});
ipcMain.handle(BACKUP_READ_CHANNEL, (event) =>
  event.senderFrame === event.sender.mainFrame ? readBackup(backupDir()) : { index: null, saves: {} },
);
// The copies are written in the background, and Exit game quits just after it saves: so the app holds off quitting
// until they are all written, then quits again. Not at 'before-quit', which comes before the windows close, and the
// game saves once more as its window closes.
app.on('will-quit', (event) => {
  if (!backupsPending()) return;
  event.preventDefault();
  void backupsWritten().then(() => {
    app.quit();
  });
});
