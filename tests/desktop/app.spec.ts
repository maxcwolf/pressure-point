// The built desktop app, launched for real. The browser tests cover the game;
// these cover the shell around it: the sandbox, the preload API, quitting and saving.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import electronPath from 'electron';

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

  test('hands the game a small API and nothing else', async ({ desktop }) => {
    const { page } = await desktop.launch();
    const api = await page.evaluate(() =>
      Object.fromEntries(Object.entries(window.desktop ?? {}).map(([key, value]) => [key, typeof value])),
    );
    expect(api).toEqual({ platform: 'string', quit: 'function' });
    expect(await page.evaluate(() => window.desktop?.platform)).toBe(process.platform);
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

  test('Main menu returns to the title screen without leaving the app', async ({ desktop }) => {
    const { page } = await desktop.launch();
    await newGame(page);
    await openPauseMenu(page);
    await page.getByRole('button', { name: 'Main menu' }).click();
    await expect(page.locator('#title .title-logo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
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
