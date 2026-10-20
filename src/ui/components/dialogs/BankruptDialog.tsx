// The game lost: the wages could not be paid.

import { money } from '../../../core/format';
import { useGame } from '../../hooks/use-hud';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** The center is bankrupt: start again, or go back to the title screen to load a saved game. */
export function BankruptDialog() {
  const { sim, newGame, mainMenu } = useGame();
  const s = sim.s;
  return (
    <Dialog>
      <h2>Bankrupt</h2>
      <p>The wages could not be paid, and the staff have walked out. The Institute is closed.</p>
      <p class="sub">{`${s.stats.healed} guests healed, with ${money(Math.max(0, s.money))} in the bank and ${money(s.loan)} owed.`}</p>{' '}
      <div class="btnrow">
        <Button class="go" onPress={newGame}>
          Start again
        </Button>
        <Button onPress={mainMenu}>Main menu</Button>
      </div>
    </Dialog>
  );
}
