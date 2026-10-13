const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const isMac = process.platform === 'darwin';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#a8d8c8',
    title: 'Pressure Point Institute',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.PP_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

Menu.setApplicationMenu(
  Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Game',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'reload', label: 'Restart Renderer' },
        { role: 'toggleDevTools' },
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    { role: 'windowMenu' },
  ]),
);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
