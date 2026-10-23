// Every symptom as a player sees it: a guest with each condition, standing in the sandbox's building, seen from the
// game's usual distance on a 1× screen, where a guest stands 30-odd pixels tall. The model lab shows people about three
// times as big, which is no guide to whether a symptom can be told at a glance. People are held at one moment, so the
// pictures hold still.
import { CONDITIONS } from '../../src/core/data';
import type * as LabPeople from '../../src/lab/people';
import { NOON_AT } from '../../src/render/daylight';
import { expect, test } from '../e2e/fixtures';

/** How many guests stand in each picture, four rows of four, two tiles apart. */
const EACH = 16;

/** The camera's distance when a game starts, which a player mostly plays at. */
const PLAY_DISTANCE = 41;

test.describe('symptoms at play size', () => {
  test.use({ draw: true });
  // sixteen people drawn in software take a while, a frame at a time
  test.setTimeout(300_000);

  for (let n = 0; n * EACH < CONDITIONS.length; n++) {
    const conditions = CONDITIONS.slice(n * EACH, (n + 1) * EACH).map((c) => c.id);
    test(`${n + 1}: ${conditions.join(', ')}`, async ({ game, page }) => {
      await game.start();
      const middle = await page.evaluate(
        async ({ conditions, noon }) => {
          const pp = window.pp;
          if (!pp) throw new Error('no game');
          const { demoGuest, LAB_LOOK } = (await import(
            /* @vite-ignore */ `${location.origin}/src/lab/people.ts`
          )) as typeof LabPeople;
          pp.state.speed = 0;
          pp.state.day = Math.floor(pp.state.day) + noon;
          const w = pp.sim.world;
          // the first open stretch of floor inside the building big enough for them all
          let at: { x: number; y: number } | undefined;
          for (let y = 0; y < w.h - 8 && !at; y++)
            for (let x = 0; x < w.w - 8 && !at; x++) {
              let open = true;
              for (let i = 0; i < 64 && open; i++)
                open = w.walkable(x + (i % 8), y + (i >> 3)) && w.inside(x + (i % 8), y + (i >> 3));
              if (open) at = { x, y };
            }
          if (!at) throw new Error('no room for them');
          const tops = [0xe76f51, 0x3a5fc8, 0xa8d14f, 0xf4a261];
          conditions.forEach((condition, i) => {
            const look = { ...LAB_LOOK, top: tops[i % 4] ?? LAB_LOOK.top, hairStyle: [1, 0, 2, 4][i % 4] ?? 0 };
            const g = { ...demoGuest(look, condition), id: 90000 + i, state: 'waiting' as const };
            Object.assign(g, {
              x: at.x + 0.5 + (i % 4) * 2,
              y: at.y + 0.5 + Math.floor(i / 4) * 2,
              tx: at.x + (i % 4) * 2,
              ty: at.y + Math.floor(i / 4) * 2,
              facing: Math.PI / 4,
            });
            pp.state.guests.push(g);
          });
          return { x: at.x + 4, y: at.y + 4 };
        },
        { conditions, noon: NOON_AT },
      );
      await game.eval(
        (pp, { x, y, dist }) => {
          // straight there, rather than gliding over, which takes a long time drawn in software
          const { rig } = pp.view as unknown as { rig: { target: { set: (...p: number[]) => void }; dist: number } };
          rig.target.set(x, 0, y);
          rig.dist = dist;
        },
        { ...middle, dist: PLAY_DISTANCE },
      );
      await game.eval((pp) => {
        // everyone at the same moment, every frame, put straight into their pose
        const view = pp.view as unknown as { render: (dt: number) => void; time: number };
        const render = view.render.bind(view);
        /** Draw the scene at the one moment. */
        view.render = () => {
          view.time = 100;
          render(1);
        };
      });
      await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
      await game.settle();
      await expect(page).toHaveScreenshot(`symptoms-${n + 1}.png`, {
        clip: { x: 470, y: 250, width: 500, height: 400 },
        timeout: 180_000,
      });
    });
  }
});
