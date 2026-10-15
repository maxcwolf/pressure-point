// Performance checks on the real game in a browser.
//
// Timings under software WebGL vary from run to run and machine to machine, so what is checked
// here is what does not: how many draw calls a frame takes, whether GPU memory stays level over
// a long session, and how much work the interface does while it sits still. Frame times are
// measured too, and reported, but only a runaway fails the test.
import type { Page } from '@playwright/test';

import { expect, type Game, test } from '../e2e/fixtures';

/** What the renderer is holding and how much it drew last frame. */
interface RendererInfo {
  memory: { geometries: number; textures: number };
  render: { calls: number; triangles: number };
  programs: unknown[] | null;
}

/** Let no one new in and wait for every guest to be seen to and gone. */
async function emptyOfGuests(game: Game) {
  await game.eval((pp) => (pp.state.spawnT = 1e9));
  for (let i = 0; i < 60 && (await game.eval((pp) => pp.state.guests.length)) > 0; i++) await game.fastForward(15);
  expect(await game.eval((pp) => pp.state.guests.length), 'every guest has left').toBe(0);
}

/** The renderer's counters after drawing the next frame. */
async function rendererInfo(page: Page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return page.evaluate(async () => {
    const info = (window.pp!.view as unknown as { renderer: { info: RendererInfo } }).renderer.info;
    // the game's own module, as served by the dev server, so this is the very cache the game uses
    const emoji = (await import(/* @vite-ignore */ `${location.origin}/src/render/models/emoji.ts`)) as {
      emojiTextures: () => number;
    };
    const parts = (await import(/* @vite-ignore */ `${location.origin}/src/render/models/parts.ts`)) as {
      cachedShapes: () => number;
    };
    return {
      // shared shapes are made the first time something needs them and kept, like emoji
      geometries: info.memory.geometries - parts.cachedShapes(),
      // emoji are drawn once each and kept, so a new one turning up late in a session is not a leak
      textures: info.memory.textures - emoji.emojiTextures(),
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
    };
  });
}

test.describe('performance', () => {
  test('draws a working center in a modest number of draw calls', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    // stopped before any guest arrives, so the scene is the same every run: the building, three rooms and three staff
    await game.eval((pp) => (pp.state.speed = 0));
    const info = await rendererInfo(page);
    test.info().annotations.push({ type: 'draw calls', description: String(info.calls) });
    // about 150 when this was written; about 250 before the walls of rooms and the building were merged, about 310
    // before the still parts of items were, about 410 while every small part cast a shadow, and about 1090 before the
    // lawn's trees were instanced
    expect(info.calls).toBeLessThan(200);
  });

  test('draws a crowd in hardly more draw calls than a few people', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.eval((pp) => (pp.state.speed = 0));
    const few = await rendererInfo(page);
    // forty guests arrive at once, each with a condition and a look of their own
    await game.eval(async (pp) => {
      const guests = (await import(/* @vite-ignore */ `${location.origin}/src/core/sim/guests.ts`)) as {
        spawnGuest: (ctx: unknown) => unknown;
      };
      const ctx = (pp.sim as unknown as { ctx: unknown }).ctx;
      for (let i = 0; i < 40; i++) guests.spawnGuest(ctx);
    });
    const crowd = await rendererInfo(page);
    const guests = await game.eval((pp) => pp.state.guests.length);
    test.info().annotations.push({
      type: 'draw calls',
      description: JSON.stringify({ few: few.calls, crowd: crowd.calls, guests }),
    });
    expect(guests).toBeGreaterThanOrEqual(40);
    // the same part of different people is drawn in one go, so only a new shape or a glowing symptom adds a call:
    // about 30 more when this was written, and about 545 more while each person's every part was drawn alone
    expect(crowd.calls - few.calls).toBeLessThan(80);
  });

  test('keeps GPU memory level through a long, busy session', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    // warm up: everything that is drawn once and kept, such as each kind of model and emoji, is made now
    await game.fastForward(120);
    // compared with the center emptied of guests each time, so what is measured is what lasts, not who is in
    await emptyOfGuests(game);
    const before = await rendererInfo(page);
    // ten minutes of play, drawn as it goes, with guests checked in, diagnosed and treated throughout
    await game.eval((pp) => (pp.state.spawnT = 1));
    for (let i = 0; i < 20; i++) await game.fastForward(30);
    const served = await game.eval((pp) => pp.state.stats.healed + pp.state.stats.failed);
    await emptyOfGuests(game);
    const after = await rendererInfo(page);
    test.info().annotations.push({ type: 'gpu memory', description: JSON.stringify({ before, after, served }) });
    expect(served, 'guests were treated, so the busy parts of the scene ran').toBeGreaterThan(5);
    // with every guest gone again, whatever they alone were drawn with should have gone with them
    expect(after.geometries - before.geometries).toBeLessThan(3);
    expect(after.textures - before.textures).toBeLessThan(5);
    // a shader is compiled the first time each kind of material is drawn, and one may first turn up late
    expect(after.programs - before.programs).toBeLessThanOrEqual(2);
  });

  test('does not keep rereading saved games while the Saves dialog is open', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    // a full list of saves, as a long-time player would have
    await game.eval(async (pp) => {
      const saves = (await import(/* @vite-ignore */ `${location.origin}/src/storage/saves.ts`)) as {
        writeSave: (state: object, name: string) => unknown;
      };
      for (let i = 0; i < 15; i++) saves.writeSave(pp.state, `Save ${i}`);
    });
    await page.locator('#sys').getByTitle('Menu').click();
    await page.getByRole('button', { name: 'Save or load' }).click();
    await expect(page.locator('.saves')).toBeVisible();
    // count every character read from storage while the dialog just sits there
    const read = await page.evaluate(async () => {
      let chars = 0;
      type GetItem = (this: Storage, key: string) => string | null;
      const get = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!.value as GetItem;
      /** Read a stored value as usual, counting its length. */
      function counted(this: Storage, key: string) {
        const value = get.call(this, key);
        chars += value?.length ?? 0;
        return value;
      }
      Object.defineProperty(Storage.prototype, 'getItem', { value: counted, configurable: true, writable: true });
      await new Promise((done) => setTimeout(done, 3000));
      Object.defineProperty(Storage.prototype, 'getItem', { value: get, configurable: true, writable: true });
      return chars;
    });
    test.info().annotations.push({ type: 'chars read in 3 s', description: String(read) });
    expect(read).toBeLessThan(20_000);
  });

  test('reports how long frames take', async ({ game, page }) => {
    await game.start();
    await game.buildCenter();
    await game.fastForward(60);
    const frames = await page.evaluate(
      () =>
        new Promise<number[]>((done) => {
          const times: number[] = [];
          let last = performance.now();
          /** Note the time since the last frame, until there are enough. */
          const tick = (now: number) => {
            times.push(now - last);
            last = now;
            if (times.length < 180) requestAnimationFrame(tick);
            else done(times);
          };
          requestAnimationFrame(tick);
        }),
    );
    const sorted = frames.slice(1).sort((a, b) => a - b);
    /** The frame time below which this fraction of frames came in. */
    const pct = (p: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!);
    const summary = { median: pct(0.5), p95: pct(0.95), worst: pct(1) };
    test.info().annotations.push({ type: 'frame ms', description: JSON.stringify(summary) });
    // software rendering is slow, so only a runaway fails: the numbers are for watching over time
    expect(summary.median).toBeLessThan(500);
  });
});
