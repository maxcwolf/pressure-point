// Warnings in the scene as a player sees them: from where the game starts (distance 41) on a plain 1x screen, not
// zoomed in. A back row of people in trouble right now, in red, or with a need that will become trouble, in amber; a
// front row saying the same sort of thing in white, as the game has them say it or they are already seeing to it; the
// markers over the squares furniture is used from, staff on purple and guests on their own; and markers over
// neighbouring broken and filthy items. The clock is held, so people, bubbles and their pulse stand still.
import { NOON_AT } from '../../src/render/daylight';
import { expect, test } from '../e2e/fixtures';

/** What each person in the rows is going through, back row then front, left to right, and anything they say. */
const PEOPLE: readonly { staff?: true; is: Record<string, number | string>; says?: string }[] = [
  // red: about to quit, fed up with waiting, getting worse while waiting
  { staff: true, is: { morale: 0, unhappyT: 1e9 } },
  { is: { state: 'waiting', patience: 10 } },
  { is: { state: 'waiting', patience: 80, health: 20 } },
  // amber: bursting or parched in the queue, worn out with no break coming
  { is: { state: 'waiting', patience: 80, bladder: 96 } },
  { is: { state: 'waiting', patience: 80, thirst: 96 } },
  { staff: true, is: { energy: 10 } },
  // a treatment that failed
  { is: {}, says: 'bubble-failed' },
  // white: gone home worse, on the way to the toilet, worn out on the way to a break, just eaten, and small talk
  { is: {}, says: 'bubble-hurt' },
  { is: { state: 'toNeed', bladder: 96 }, says: 'bubble-restroom' },
  { staff: true, is: { energy: 10, state: 'toBreak' } },
  { staff: true, is: {}, says: 'bubble-hungry' },
  { is: {}, says: 'bubble-happy' },
  { is: {}, says: 'bubble-sick' },
  { is: {}, says: 'bubble-thanks' },
];

test.describe('alarms in the scene', () => {
  // the scene is the picture
  test.use({ draw: true });
  // people are drawn in software, which takes a while
  test.setTimeout(180_000);

  test('bubbles and markers from where the game starts, at 1:1', async ({ game, page }) => {
    await page.clock.install();
    await game.start();
    await page.addStyleTag({ content: '#ui, #floaters { display: none !important; }' });
    // around where the camera starts looking, so it need not glide (in software, a glide takes minutes)
    const box = await game.eval((pp, at) => {
      pp.state.speed = 0;
      pp.state.day = Math.floor(pp.state.day) + at;
      const [fx, fy] = (pp.view as unknown as { focus(): [number, number] }).focus();
      const x = Math.round(fx);
      const y = Math.round(fy);
      // two plants, one behind the other from the camera, both broken: one marker for the pair, not a tower; and
      // a filthy one on its own
      for (const [px, py, wear, dirt] of [
        [x + 4, y + 1, 100, 0],
        [x + 5, y + 2, 100, 0],
        [x + 4, y + 4, 0, 100],
      ] as const) {
        const plant = pp.sim.placeItem('plant', px, py, 0);
        if (!plant) throw new Error(`no room for a plant at ${px}, ${py}`);
        Object.assign(plant, { wear, dirt });
      }
      const corners = [
        pp.view.project(x - 6, y - 3, 2.8),
        pp.view.project(x + 7, y - 3, 2.8),
        pp.view.project(x - 6, y + 5, 0),
        pp.view.project(x + 7, y + 5, 0),
      ];
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      return { x, y, left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    }, NOON_AT);
    // from here on the game's own frames stop, and the test draws its frames itself, each the same step
    await page.clock.pauseAt(Date.now() + 60_000);
    await page.evaluate(
      async ([people, x, y]) => {
        const { demoGuest, demoStaff, LAB_LOOK } = await import(
          /* @vite-ignore */ `${location.origin}/src/lab/people.ts`
        );
        const pp = window.pp as unknown as {
          state: { guests: object[]; staff: object[] };
          view: { time: number; setMarkers: (m: object[]) => void };
        };
        pp.view.time = 100;
        const tops = [0xe5564d, 0x7a6fbf, 0xf2c14e, 0x4a9fe0];
        people.forEach(({ staff, is, says }, i) => {
          const look = { ...LAB_LOOK, top: tops[i % tops.length], sex: i % 2 ? 'male' : 'female' };
          const c = staff ? demoStaff(look, 'therapist') : demoGuest(look, 'knotted');
          const at = { x: x - 5 + (i % 7) * 1.6, y: y - 2 + Math.floor(i / 7) * 2.5 };
          Object.assign(c, { id: 9000 + i, ...at, h: 0, pose: 'stand', facing: Math.PI / 4 }, is);
          if (says) Object.assign(c, { bubble: says, bubbleT: 1e9 });
          (staff ? pp.state.staff : pp.state.guests).push(c);
        });
        pp.view.setMarkers(
          ['role-therapist', 'role-receptionist', 'marker-staff', 'marker-guest'].map((icon, i) => ({
            x: x - 5 + i * 2,
            y: y + 3,
            icon,
          })),
        );
      },
      [PEOPLE, box.x, box.y] as const,
    );
    // half a second of frames, every bubble popping in and settling, and only the last drawn, as drawing is slow in software
    await game.eval((pp) => {
      const view = pp.view as unknown as { drawing: boolean; render(dt: number): void };
      view.drawing = false;
      for (let i = 0; i < 30; i++) view.render(1 / 60);
      view.drawing = true;
      view.render(1 / 60);
      // then keep that frame on screen while the game's frames run again, as a screenshot waits for frames to come
      view.drawing = false;
    });
    await page.clock.resume();
    await expect(page).toHaveScreenshot('alarms.png', {
      clip: {
        x: Math.round(box.left),
        y: Math.round(box.top),
        width: Math.round(box.right - box.left),
        height: Math.round(box.bottom - box.top),
      },
    });
  });
});
