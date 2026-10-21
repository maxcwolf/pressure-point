// The game lost: the bank called the overdraft in.

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
      <p>
        The center sat in the red with the books losing money, and the bank has called the overdraft in. The staff have
        walked out, and the Institute is closed.
      </p>
      <p class="sub">{`${s.stats.healed} guests healed, ${money(-s.money)} in the red and ${money(s.loan)} owed.`}</p>{' '}
      <div class="btnrow">
        <Button class="go" onPress={newGame}>
          Start again
        </Button>
        <Button onPress={mainMenu}>Main menu</Button>
      </div>
    </Dialog>
  );
}
