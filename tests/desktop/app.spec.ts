// The built desktop app, launched for real. The browser tests cover the game;
// these cover the shell around it: the sandbox, the preload API, quitting and saving.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { ElectronApplication } from '@playwright/test';
import electronPath from 'electron';

import { UPDATE_CHECK_CHANNEL, UPDATE_STATUS_CHANGED_CHANNEL, type UpdateStatus } from '../../electron/api';
import { expect, newGame, openPauseMenu, test } from './fixtures';

test.describe('the desktop shell', () => {
  test('runs one copy at a time, since two would save over each other', async ({ desktop }) => {
    const { app } = await desktop.launch();
    // a second copy on the same profile gives up at once and leaves the first one running
    const second = spawn(electronPath as unknown as string, ['.', `--user-data-dir=${desktop.profile}`], {
      stdio: 'ignore',
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        second.kill();
        reject(new Error('the second copy kept running'));
      }, 15_000);
      second.on('exit', (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
    });
    expect(code).toBe(0);
    expect(app.windows()).toHaveLength(1);
  });

  test('runs the game in a sandboxed page with no access to Node', async ({ desktop }) => {
    const { app, page } = await desktop.launch();
    expect(await page.evaluate(() => [typeof require, typeof process, typeof module])).toEqual([
      'undefined',
      'undefined',
      'undefined',
    ]);
    // Electron reports whether a process is sandboxed on macOS and Windows only
    const pages = await app.evaluate(({ app }) =>
      app
        .getAppMetrics()
        .filter((p) => p.type === 'Tab')
        .map((p) => p.sandboxed),
    );
    expect(pages).toEqual([process.platform === 'linux' ? undefined : true]);
  });

  test('says no when the game is asked whether it may use anything, and connects only to itself', async ({
    desktop,
  }) => {
    const { page } = await desktop.launch();
    const states = await page.evaluate(() =>
      Promise.all(
        (['notifications', 'geolocation', 'camera'] as PermissionName[]).map((name) =>
          navigator.permissions.query({ name }).then((p) => p.state),
        ),
      ),
    );
    expect(states).toEqual(['denied', 'denied', 'denied']);
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toMatch(/localhost|ws:/);
  });

  test('hands the game a small API and nothing else', async ({ desktop }) => {
    const { page } = await desktop.launch();
    const api = await page.evaluate(() =>
      Object.fromEntries(Object.entries(window.desktop ?? {}).map(([key, value]) => [key, typeof value])),
    );
    expect(api).toEqual({
      platform: 'string',
      quit: 'function',
      onUpdateStatus: 'function',
      checkForUpdate: 'function',
      installUpdate: 'function',
      onFullScreen: 'function',
      setFullScreen: 'function',
      backupSave: 'function',
      dropBackup: 'function',
      readBackup: 'function',
    });
    expect(await page.evaluate(() => window.desktop?.platform)).toBe(process.platform);
  });

  test('sends no error reports while the tests drive it', async ({ desktop }) => {
    await desktop.launch();
    // reporting leaves its note and Sentry's folder in the profile as soon as the app starts (electron/reports.ts)
    expect(existsSync(path.join(desktop.profile, 'heartbeat.json'))).toBe(false);
    expect(existsSync(path.join(desktop.profile, 'sentry'))).toBe(false);
  });

  test('loads the game as a file, which is where existing saved games live', async ({ desktop }) => {
    const { page } = await desktop.launch();
    // saved games are kept per address: changing how the game is loaded would hide every save players have
    expect(new URL(page.url()).protocol).toBe('file:');
    expect(page.url()).toMatch(/\/dist\/index\.html$/);
  });

  test('does not let the page go anywhere else or open more windows', async ({ desktop }) => {
    const { app, page } = await desktop.launch();
    const home = page.url();
    expect(await page.evaluate(() => window.open('about:blank'))).toBeNull();
    await page.evaluate(() => {
      location.href = 'https://example.com/';
    });
    // give a navigation the chance to happen before checking that it did not
    await page.waitForTimeout(500);
    // asked of the app itself: Playwright is left waiting for the navigation that was refused
    const after = await app.evaluate(async ({ BrowserWindow }) => {
      const [win, ...others] = BrowserWindow.getAllWindows();
      return {
        url: win?.webContents.getURL(),
        showsTitle: (await win?.webContents.executeJavaScript(
          `!!document.querySelector('#title .title-logo')`,
        )) as boolean,
        otherWindows: others.length,
      };
    });
    expect(after).toEqual({ url: home, showsTitle: true, otherWindows: 0 });
  });
});

test.describe('leaving the desktop app', () => {
  test('Exit on the title screen quits', async ({ desktop }) => {
    const { app, page } = await desktop.launch();
    const closed = app.waitForEvent('close');
    await page.getByRole('button', { name: 'Exit' }).click();
    await closed;
  });

  test('Exit game in the pause menu saves first, so Continue picks the game back up', async ({ desktop }) => {
    const first = await desktop.launch();
    await expect(first.page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    await newGame(first.page);
    await openPauseMenu(first.page);
    const closed = first.app.waitForEvent('close');
    await first.page.getByRole('button', { name: 'Exit game' }).click();
    await closed;

    const second = await desktop.launch();
    await second.page.getByRole('button', { name: 'Continue' }).click();
    await expect(second.page.locator('#stats')).toContainText('$30,000');
  });

  test('closing the window saves the game, since the regular autosave is minutes apart', async ({ desktop }) => {
    const first = await desktop.launch();
    await newGame(first.page);
    const closed = first.app.waitForEvent('close');
    // as the window's close button or Cmd+Q does
    await first.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close();
    });
    await closed;

    const second = await desktop.launch();
    await second.page.getByRole('button', { name: 'Continue' }).click();
    await expect(second.page.locator('#stats')).toContainText('$30,000');
  });

  test('keeps the saves in files too, and puts them back when the page storage loses them', async ({ desktop }) => {
    const first = await desktop.launch();
    await newGame(first.page);
    await openPauseMenu(first.page);
    const closed = first.app.waitForEvent('close');
    await first.page.getByRole('button', { name: 'Exit game' }).click();
    await closed;
    expect(readdirSync(path.join(desktop.profile, 'saved-games')).sort()).toEqual(['index.json', 'save-auto.json']);

    // as if the player cleared the app's data, or its profile was damaged
    const second = await desktop.launch();
    await second.page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('pressure-point-audio', '{"sound":false,"music":false}');
    });
    await second.page.reload();
    await second.page.getByRole('button', { name: 'Continue' }).click();
    await expect(second.page.locator('#stats')).toContainText('$30,000');
  });

  test('Main menu returns to the title screen without leaving the app', async ({ desktop }) => {
    const { page } = await desktop.launch();
    await newGame(page);
    await openPauseMenu(page);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.locator('#title .title-logo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });
});

test.describe('full screen', () => {
  /** Whether the app's window fills the screen. */
  const isFullScreen = (app: ElectronApplication) =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreen());

  test('the setting fills the screen, and the next launch opens the same way', async ({ desktop }) => {
    const first = await desktop.launch();
    expect(await isFullScreen(first.app)).toBe(false);
    await first.page.getByRole('button', { name: 'Settings' }).click();
    const toggle = first.page.getByRole('switch', { name: 'Full screen' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect.poll(() => isFullScreen(first.app)).toBe(true);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await first.app.close();

    // in a game, the pause menu's settings agree
    const second = await desktop.launch();
    await expect.poll(() => isFullScreen(second.app)).toBe(true);
    await newGame(second.page);
    await openPauseMenu(second.page);
    await second.page.getByRole('button', { name: 'Settings' }).click();
    await expect(second.page.getByRole('switch', { name: 'Full screen' })).toHaveAttribute('aria-checked', 'true');
  });

  test('leaving full screen by the window itself switches the setting off for next time', async ({ desktop }) => {
    const first = await desktop.launch();
    await first.page.getByRole('button', { name: 'Settings' }).click();
    const toggle = first.page.getByRole('switch', { name: 'Full screen' });
    await toggle.click();
    await expect.poll(() => isFullScreen(first.app)).toBe(true);
    // as the green button, the menu or its keys would, without the game asking
    await first.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setFullScreen(false));
    await expect.poll(() => isFullScreen(first.app)).toBe(false);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await first.app.close();

    const second = await desktop.launch();
    expect(await isFullScreen(second.app)).toBe(false);
    // and the green button still offers full screen: Electron takes it away from a window opened with it set false
    expect(await second.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreenable())).toBe(
      true,
    );
  });
});

test.describe('updates', () => {
  /** Say how far the look for an update has got, as the updater would: a run from this folder never looks. */
  const tell = (app: ElectronApplication, status: UpdateStatus) =>
    app.evaluate(
      ({ BrowserWindow }, [channel, sent]) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send(channel, sent);
      },
      [UPDATE_STATUS_CHANGED_CHANNEL, status] as const,
    );

  test('the title screen says while it checks, then that this is the latest version', async ({ desktop }) => {
    const { app, page } = await desktop.launch();
    // a run from this folder is not looking, so says nothing
    const note = page.locator('#title').getByRole('status');
    await expect(note).toHaveCount(0);
    await tell(app, { state: 'checking' });
    await expect(note).toHaveText('Checking for updates…');
    await tell(app, { state: 'latest' });
    await expect(note).toHaveText('You’re on the latest version');
    // a newer version says so while it downloads, then gives way to the button that installs it
    await tell(app, { state: 'downloading', version: '9.9.9' });
    await expect(note).toHaveText('Downloading version 9.9.9…');
    await tell(app, { state: 'ready', version: '9.9.9' });
    await expect(page.getByRole('button', { name: 'Update to the latest version' })).toBeVisible();
    await expect(note).toHaveCount(0);
  });

  test('coming back to the title screen looks for an update again, and starting a game does not', async ({
    desktop,
  }) => {
    const { app, page } = await desktop.launch();
    // counted beside the app's own handler, which a run from this folder leaves with no updater to ask
    await app.evaluate(({ ipcMain }, channel) => {
      const seen = globalThis as { asked?: number };
      seen.asked = 0;
      ipcMain.on(channel, () => {
        seen.asked = (seen.asked ?? 0) + 1;
      });
    }, UPDATE_CHECK_CHANNEL);
    /** How many times the game has asked the app to look again. */
    const asked = () => app.evaluate(() => (globalThis as { asked?: number }).asked);

    await newGame(page);
    await openPauseMenu(page);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect.poll(asked).toBe(1);
    // a new game from inside one reloads the page too, but straight into the game
    await page.getByRole('button', { name: 'Continue' }).click();
    await openPauseMenu(page);
    await page.getByRole('button', { name: 'New game' }).click();
    await page.getByRole('button', { name: 'Start a new game' }).click();
    await page.locator('#stats').waitFor();
    await openPauseMenu(page);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect.poll(asked).toBe(2);
  });

  test('a downloaded update is offered on the title screen and in a game', async ({ desktop }) => {
    const { app, page } = await desktop.launch();
    await tell(app, { state: 'ready', version: '9.9.9' });
    // the title screen asks before restarting, and Not now leaves the offer in place
    const offer = page.getByRole('button', { name: 'Update to the latest version' });
    await offer.click();
    await expect(page.getByRole('heading', { name: 'Restart to update?' })).toBeVisible();
    await expect(page.getByText('install version 9.9.9')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart and update' })).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('heading', { name: 'Restart to update?' })).toHaveCount(0);
    await expect(offer).toBeVisible();

    await newGame(page);
    const toast = page.locator('#toasts').getByRole('button', { name: 'Version 9.9.9 is ready to install' });
    await toast.click();
    await expect(page.getByRole('heading', { name: 'Version 9.9.9 is ready' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart now' })).toBeVisible();
    // putting it off leaves the offer in place
    await page.getByRole('button', { name: 'Keep playing' }).click();
    await expect(page.getByRole('heading', { name: 'Version 9.9.9 is ready' })).toHaveCount(0);
    await expect(toast).toBeVisible();
  });
});

test.describe('saved games in the desktop app', () => {
  test('a save can be exported to a file', async ({ desktop }, testInfo) => {
    const { app, page } = await desktop.launch();
    // send the download straight to a file instead of opening the save dialog
    const file = testInfo.outputPath('export.json');
    await app.evaluate(({ session }, target) => {
      session.defaultSession.on('will-download', (_event, item) => {
        item.setSavePath(target);
      });
    }, file);

    await newGame(page);
    await openPauseMenu(page);
    await page.getByRole('button', { name: 'Save or load' }).click();
    await page.getByLabel('Name for this save').fill('Desk copy');
    await page.getByRole('button', { name: 'Save game' }).click();
    await page.locator('.save-list li', { hasText: 'Desk copy' }).getByRole('button', { name: 'Export' }).click();

    await expect.poll(() => existsSync(file)).toBe(true);
    await expect
      .poll(() => {
        try {
          return (JSON.parse(readFileSync(file, 'utf8')) as { name?: string }).name;
        } catch {
          return undefined;
        }
      })
      .toBe('Desk copy');
    expect(path.basename(file)).toBe('export.json');
  });
});
