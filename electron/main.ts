// The desktop app's main process: one window that shows the game.
import path from 'node:path';

import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions, session, shell } from 'electron';

import { QUIT_CHANNEL } from './api';

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

/** Open the game window and load the game into it. */
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#a8d8c8',
    title: 'Pressure Point Institute',
    ...(devIcon && { icon: devIcon }),
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

  // The built game is loaded as a file on purpose: saved games are kept per address,
  // so serving it from anywhere else would hide every save a player already has.
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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

const gameMenu: MenuItemConstructorOptions[] = [
  { role: 'togglefullscreen' },
  { role: 'reload', label: 'Restart Renderer' },
  { role: 'toggleDevTools' },
];
if (!isMac) gameMenu.push({ type: 'separator' }, { role: 'quit' });

const menu: MenuItemConstructorOptions[] = [{ label: 'Game', submenu: gameMenu }, { role: 'windowMenu' }];
if (isMac) menu.unshift({ role: 'appMenu' });
Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

// One copy of the game at a time: two would autosave over each other's game. A second copy hands over to the
// first, which comes to the front, and quits.
const firstCopy = app.requestSingleInstanceLock();
if (!firstCopy) app.quit();
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
  createWindow();
});

// one window, one game: closing it (or choosing Exit in the game) quits on every platform
app.on('window-all-closed', () => {
  app.quit();
});
