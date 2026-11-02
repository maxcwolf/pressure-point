// Accidents: a guest bursting in a line with no Restroom to use holds on a while, with the inspector saying why, then
// has an accident on the floor; the messages say what to do, and a Caretaker cleans it up.
import { expect, type Game, test } from './fixtures';

/** The accidents on the floor. */
const accidents = (game: Game) => game.eval((pp) => pp.state.litter.filter((l) => l.accident).length);

test('a guest bursting with no Restroom has an accident on the floor, which a Caretaker cleans up', async ({
  game,
  page,
}) => {
  await game.start();
  await game.buildCenter();
  // the standard center has accidents off; with nobody at Reception, the first guest in line there, bursting, with
  // patience to spare, in the inspector
  const name = await game.eval((pp) => {
    pp.state.accidentsOn = true;
    pp.sim.fire(pp.state.staff.find((st) => st.role === 'receptionist')!.id);
    pp.state.speed = 1;
    /** The first guest in line, if anyone is. */
    const inLine = () => pp.state.guests.find((g) => g.state === 'waiting');
    for (let i = 0; i < 3000 && !inLine(); i++) pp.sim.tick(0.1);
    pp.state.speed = 0;
    const g = inLine();
    if (!g) throw new Error('nobody in line');
    g.bladder = 100;
    g.patience = 100;
    pp.tools.select({ kind: 'guest', id: g.id });
    return g.name;
  });
  await game.fastForward(3);
  await expect(page.locator('#inspector h3')).toHaveText(name);
  await expect(page.locator('#inspector')).toContainText('bursting: there is no Restroom to use');
  expect(await accidents(game)).toBe(0);

  await game.fastForward(15);
  expect(await accidents(game)).toBeGreaterThan(0);
  await expect(page.locator('#toasts')).toContainText('had an accident on the floor. Build a Restroom');
  await expect(page.locator('#toasts')).toContainText('Hire a Caretaker to clean it up');
  expect(await game.eval((pp) => pp.state.stats.accidents)).toBeGreaterThan(0);

  await game.eval((pp) => {
    pp.state.accidentsOn = false;
    const best = pp.state.candidates.filter((c) => c.role === 'caretaker').sort((a, b) => b.skill - a.skill)[0]!;
    pp.sim.hire(best.id);
  });
  await game.fastForward(90);
  expect(await accidents(game)).toBe(0);
});
