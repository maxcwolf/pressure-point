// Helpers for driving the real game in a browser.
import { expect, test as base, type Page } from '@playwright/test';
import type { Sim } from '../../src/sim';
import type { GameState } from '../../src/state';

/** The debug handle the dev build puts on window. */
interface Handle {
  sim: Sim;
  state: GameState;
  view: {
    project(x: number, y: number, h?: number): { x: number; y: number };
    pick(x: number, y: number): { kind: string; id: number } | null;
    dist: number;
    renderer: { info: { render: { triangles: number } } };
  };
  tools: { tool: { kind: string; phase?: string }; hint: string; problem: string };
}
declare global {
  interface Window {
    pp: Handle;
  }
}

export class Game {
  readonly errors: string[] = [];
  constructor(readonly page: Page) {
    page.on('pageerror', (e) => this.errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') this.errors.push(m.text());
    });
  }

  /** Title screen, then a fresh game. */
  async start() {
    await this.page.goto('/');
    await this.page.getByRole('button', { name: 'New game' }).click();
    await this.page.waitForFunction(() => !!window.pp);
  }

  /** Run code against the live game and return what it returns. */
  eval<T, A = undefined>(fn: (pp: Handle, arg: A) => T, arg?: A): Promise<T> {
    return this.page.evaluate(([f, a]) => new Function('pp', 'arg', `return (${f})(pp, arg)`)(window.pp, a), [fn.toString(), arg] as const) as Promise<T>;
  }

  /** Screen position of the middle of a floor tile (or any fractional tile coordinate). */
  at(x: number, y: number) {
    return this.eval((pp, [tx, ty]) => pp.view.project(tx, ty), [x, y] as const);
  }
  async hover(x: number, y: number) {
    const p = await this.at(x, y);
    await this.page.mouse.move(p.x, p.y, { steps: 4 });
  }
  async click(x: number, y: number) {
    const p = await this.at(x, y);
    await this.page.mouse.move(p.x, p.y, { steps: 4 });
    await this.page.mouse.click(p.x, p.y);
  }
  async drag(from: [number, number], to: [number, number]) {
    const a = await this.at(...from);
    const b = await this.at(...to);
    await this.page.mouse.move(a.x, a.y);
    await this.page.mouse.down();
    await this.page.mouse.move(b.x, b.y, { steps: 8 });
    await this.page.mouse.up();
  }

  /** Open one of the round menus along the bottom. */
  async menu(name: 'Rooms' | 'Items' | 'Hire' | 'Staff' | 'Treatments' | 'Money') {
    await this.page.locator('#buildbtns').getByRole('button', { name }).click();
  }
  card(name: string) {
    return this.page.locator('#menu .card').filter({ hasText: name }).first();
  }

  /** Wait until the scene on screen has caught up with the game state. */
  async settle() {
    await this.page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  }

  /** Skip ahead by this many seconds of normal-speed play. */
  async fastForward(seconds: number) {
    await this.eval((pp, secs) => {
      const speed = pp.state.speed;
      pp.state.speed = 1;
      for (let i = 0; i < secs * 10; i++) pp.sim.tick(0.1);
      pp.state.speed = speed;
    }, seconds);
    await this.settle();
  }

  /** Build and staff a working center without going through the menus. */
  buildCenter() {
    return this.eval((pp) => {
      const { sim, state } = pp;
      const room = (type: string, rect: object, door: object, items: [string, number, number][]) => {
        const r = sim.createRoom(type as never, rect as never, door as never);
        for (const [t, x, y] of items) sim.placeItem(t as never, x, y, 0, { free: true, roomId: r.id });
        sim.finishRoom(r);
      };
      state.money = 100000;
      sim.placeItem('reception_desk', 14, 13, 0);
      room('consult', { x: 5, y: 5, w: 4, h: 4 }, { x: 8, y: 7, dx: 1, dy: 0 }, [['consult_desk', 6, 6], ['cabinet', 5, 8]]);
      room('massage', { x: 11, y: 5, w: 4, h: 4 }, { x: 12, y: 8, dx: 0, dy: 1 }, [['massage_table', 12, 5], ['oil_trolley', 14, 5]]);
      room('training', { x: 5, y: 11, w: 4, h: 4 }, { x: 8, y: 12, dx: 1, dy: 0 }, [['whiteboard', 6, 11], ['study_desk', 6, 13]]);
      for (const role of ['receptionist', 'consultant', 'therapist']) {
        const best = state.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
        sim.hire(best.id);
      }
    });
  }
}

export const test = base.extend<{ game: Game }>({
  game: async ({ page }, use) => {
    const game = new Game(page);
    await use(game);
    expect(game.errors, 'errors logged by the page').toEqual([]);
  },
});
export { expect };
